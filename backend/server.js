const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

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
    const r = await db.query(
      `INSERT INTO members (name, username, password, role)
       VALUES ($1,$2,$3,'admin') RETURNING *`,
      [name, username, password]
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
    const r = await db.query(
      `INSERT INTO books (title,author,isbn,genre,total,available,year)
       VALUES ($1,$2,$3,$4,$5,$5,$6) RETURNING *`,
      [title, author, isbn||null, genre||null, total, year||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const { title, author, isbn, genre, total, available, year } = req.body;
    const r = await db.query(
      `UPDATE books SET title=$1,author=$2,isbn=$3,genre=$4,
       total=$5,available=$6,year=$7 WHERE id=$8 RETURNING *`,
      [title, author, isbn||null, genre||null, total, available, year||null, req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
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
    const r = await db.query(
      `INSERT INTO members (name,username,email,phone,password,role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, username, email||null, phone||null, password, role||'member']
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

/* ================= LOGIN ================= */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const r = await db.query(
      'SELECT * FROM members WHERE username=$1 AND password=$2 AND role=$3',
      [username, password, role]
    );
    if (r.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials or role' });
    const user = r.rows[0];
    if (user.active === false)
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    res.json(user);
  } catch(e) { res.status(500).json({error: e.message}); }
});

/* ================= TRANSACTIONS ================= */
app.get('/api/transactions', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM transactions ORDER BY id DESC');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Get transactions for a specific member
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

    // Check max 2 books rule
    const activeCheck = await db.query(
      `SELECT COUNT(*) FROM transactions WHERE member_id=$1 AND status='issued'`,
      [member_id]
    );
    if (parseInt(activeCheck.rows[0].count) >= 2) {
      return res.status(400).json({ error: 'Member already has 2 active books. Cannot issue more.' });
    }

    // Check unpaid fine rule
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
    await db.query(
      'UPDATE books SET available = available - 1 WHERE id=$1', [book_id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/transactions/:id/return', async (req, res) => {
  try {
    const { return_date, fine } = req.body;
    const r = await db.query(
      `UPDATE transactions SET return_date=$1, fine=$2, status='returned'
       WHERE id=$3 RETURNING *`,
      [return_date, fine, req.params.id]
    );
    await db.query(
      'UPDATE books SET available = available + 1 WHERE id=$1',
      [r.rows[0].book_id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/transactions/:id/payfine', async (req, res) => {
  try {
    const r = await db.query(
      `UPDATE transactions SET fine_paid=true WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.listen(3000, () => {
  console.log('LibraryOS Server running at http://localhost:3000');
});