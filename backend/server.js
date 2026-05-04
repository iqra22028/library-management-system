const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const app = express();
app.use(cors());
app.use(express.json());

const db = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'libraryos',
  user: 'postgres',
  password: 'admin123',
});

db.connect((err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to PostgreSQL!');
});

/* ================= ADMIN CREATE ================= */
app.post('/api/create-admin', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    const check = await db.query(`SELECT * FROM members WHERE role='admin'`);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const r = await db.query(
      `INSERT INTO members (name, username, password, role)
       VALUES ($1,$2,$3,'admin') RETURNING *`,
      [name, username, hashed]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= BOOKS ================= */
app.get('/api/books', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM books ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/books', async (req, res) => {
  try {
    const { title, author, isbn, genre, total, year } = req.body;

    // Input length limits
    if (!title || title.trim().length === 0) return res.status(400).json({ error: 'Title is required.' });
    if (title.length > 200) return res.status(400).json({ error: 'Title cannot exceed 200 characters.' });
    if (!author || author.trim().length === 0) return res.status(400).json({ error: 'Author is required.' });
    if (author.length > 150) return res.status(400).json({ error: 'Author name cannot exceed 150 characters.' });
    if (isbn && isbn.trim().length > 20) return res.status(400).json({ error: 'ISBN cannot exceed 20 characters.' });

    // ISBN digit-only validation
    if (isbn && isbn.trim().length > 0) {
      const isbnClean = isbn.trim().replace(/-/g, '');
      if (!/^\d+$/.test(isbnClean)) {
        return res.status(400).json({ error: 'ISBN must contain numbers only (dashes allowed).' });
      }
      if (isbnClean.length !== 10 && isbnClean.length !== 13) {
        return res.status(400).json({ error: 'ISBN must be 10 or 13 digits long.' });
      }
    }

    // Unique title check
    const titleCheck = await db.query(
      `SELECT * FROM books WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))`, [title.trim()]
    );
    if (titleCheck.rows.length > 0) {
      return res.status(400).json({ error: `A book with the title "${title}" already exists. Please use a different title.` });
    }

    // Unique ISBN check — only if ISBN is actually provided
    if (isbn && isbn.trim().length > 0) {
      const isbnCheck = await db.query(
        `SELECT * FROM books WHERE isbn IS NOT NULL AND TRIM(isbn) = $1`,
        [isbn.trim()]
      );
      if (isbnCheck.rows.length > 0) {
        return res.status(400).json({ error: `A book with ISBN "${isbn.trim()}" already exists. Please use a different ISBN.` });
      }
    }

    const r = await db.query(
      `INSERT INTO books (title,author,isbn,genre,total,available,year)
       VALUES ($1,$2,$3,$4,$5,$5,$6) RETURNING *`,
      [title.trim(), author.trim(), isbn?.trim()||null, genre||null, total, year||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const { title, author, isbn, genre, total, available, year } = req.body;

    if (title && title.length > 200) return res.status(400).json({ error: 'Title cannot exceed 200 characters.' });
    if (author && author.length > 150) return res.status(400).json({ error: 'Author name cannot exceed 150 characters.' });

    // ISBN digit-only validation on edit
    if (isbn && isbn.trim().length > 0) {
      const isbnClean = isbn.trim().replace(/-/g, '');
      if (!/^\d+$/.test(isbnClean)) {
        return res.status(400).json({ error: 'ISBN must contain numbers only (dashes allowed).' });
      }
      if (isbnClean.length !== 10 && isbnClean.length !== 13) {
        return res.status(400).json({ error: 'ISBN must be 10 or 13 digits long.' });
      }
    }

    // Unique title check (exclude self)
    const titleCheck = await db.query(
      `SELECT * FROM books WHERE LOWER(TRIM(title)) = LOWER(TRIM($1)) AND id != $2`,
      [title, req.params.id]
    );
    if (titleCheck.rows.length > 0) {
      return res.status(400).json({ error: `A book with the title "${title}" already exists.` });
    }

    // Unique ISBN check (exclude self) — only if ISBN is actually provided
    if (isbn && isbn.trim().length > 0) {
      const isbnCheck = await db.query(
        `SELECT * FROM books WHERE isbn IS NOT NULL AND TRIM(isbn) = $1 AND id != $2`,
        [isbn.trim(), req.params.id]
      );
      if (isbnCheck.rows.length > 0) {
        return res.status(400).json({ error: `A book with ISBN "${isbn.trim()}" already exists.` });
      }
    }

    const r = await db.query(
      `UPDATE books SET title=$1,author=$2,isbn=$3,genre=$4,
       total=$5,available=$6,year=$7 WHERE id=$8 RETURNING *`,
      [title, author, isbn?.trim()||null, genre||null, total, available, year||null, req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    const activeCheck = await db.query(
      `SELECT * FROM transactions WHERE book_id=$1 AND status='issued'`, [req.params.id]
    );
    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete — this book is currently issued to a member.' });
    }
    await db.query('DELETE FROM books WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({error: e.message}); }
});

/* ================= MEMBERS ================= */
app.get('/api/members', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM members ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/members', async (req, res) => {
  try {
    const { name, username, email, phone, password, role } = req.body;

    // Input length limits
    if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Name is required.' });
    if (name.length > 100) return res.status(400).json({ error: 'Name cannot exceed 100 characters.' });
    if (!username || username.trim().length === 0) return res.status(400).json({ error: 'Username is required.' });
    if (username.length > 50) return res.status(400).json({ error: 'Username cannot exceed 50 characters.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (password.length > 100) return res.status(400).json({ error: 'Password cannot exceed 100 characters.' });
    if (phone && phone.trim().length > 20) return res.status(400).json({ error: 'Phone number cannot exceed 20 characters.' });

    // Unique username check
    const usernameCheck = await db.query(
      `SELECT * FROM members WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))`, [username.trim()]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: `A member with username "${username}" already exists. Try a different username.` });
    }

    // Unique email check — only if email is actually provided
    if (email && email.trim().length > 0) {
      const emailCheck = await db.query(
        `SELECT * FROM members WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1))`,
        [email.trim()]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: `A member with email "${email}" is already registered. Try a different email.` });
      }
    }

    // Unique phone check — only if phone is actually provided
    if (phone && phone.trim().length > 0) {
      const phoneCheck = await db.query(
        `SELECT * FROM members WHERE phone IS NOT NULL AND TRIM(phone) = TRIM($1)`,
        [phone.trim()]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: `A member with phone number "${phone}" is already registered. Try a different phone number.` });
      }
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const r = await db.query(
      `INSERT INTO members (name,username,email,phone,password,role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), username.trim(), email?.trim()||null, phone?.trim()||null, hashed, role||'member']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/members/:id/toggle', async (req, res) => {
  try {
    const r = await db.query(
      `UPDATE members SET active = NOT active WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    const activeCheck = await db.query(
      `SELECT * FROM transactions WHERE member_id=$1 AND status='issued'`, [req.params.id]
    );
    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete — this member has issued books. Return all books first.' });
    }
    await db.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({error: e.message}); }
});

/* ================= LOGIN ================= */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const r = await db.query(
      'SELECT * FROM members WHERE username=$1 AND role=$2',
      [username, role]
    );
    if (r.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials or role.' });

    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid credentials or role.' });

    if (user.active === false)
      return res.status(403).json({ error: 'Your account is deactivated. Kindly contact admin.' });

    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch(e) { res.status(500).json({error: e.message}); }
});

/* ================= TRANSACTIONS ================= */
app.get('/api/transactions', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM transactions ORDER BY id DESC');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/transactions/member/:member_id', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM transactions WHERE member_id=$1 ORDER BY id DESC',
      [req.params.member_id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { member_id, book_id, issue_date, due_date } = req.body;

    const activeCheck = await db.query(
      `SELECT COUNT(*) FROM transactions WHERE member_id=$1 AND status='issued'`, [member_id]
    );
    if (parseInt(activeCheck.rows[0].count) >= 2) {
      return res.status(400).json({ error: 'Member already has 2 active books. Cannot issue more.' });
    }

    const fineCheck = await db.query(
      `SELECT * FROM transactions WHERE member_id=$1 AND fine > 0 AND fine_paid=false AND status='returned'`,
      [member_id]
    );
    if (fineCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Member has unpaid fines. Please clear fines before issuing new books.' });
    }

    const r = await db.query(
      `INSERT INTO transactions (member_id,book_id,issue_date,due_date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [member_id, book_id, issue_date, due_date]
    );
    await db.query('UPDATE books SET available = available - 1 WHERE id=$1', [book_id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/transactions/:id/return', async (req, res) => {
  try {
    const { return_date, fine } = req.body;
    const r = await db.query(
      `UPDATE transactions SET return_date=$1, fine=$2, status='returned' WHERE id=$3 RETURNING *`,
      [return_date, fine, req.params.id]
    );
    await db.query('UPDATE books SET available = available + 1 WHERE id=$1', [r.rows[0].book_id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/transactions/:id/payfine', async (req, res) => {
  try {
    const r = await db.query(
      `UPDATE transactions SET fine_paid=true WHERE id=$1 RETURNING *`, [req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.listen(3000, () => {
  console.log('LibraryOS Server running at http://localhost:3000');
});