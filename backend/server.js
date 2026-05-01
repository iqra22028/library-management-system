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
  password: 'admin123', // ← CHANGE THIS to your PostgreSQL password
});

db.connect((err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to PostgreSQL!');
});

// BOOKS
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

// MEMBERS
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

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const r = await db.query(
      'SELECT * FROM members WHERE username=$1 AND password=$2',
      [username, password]
    );
    if (r.rows.length === 0)
      return res.status(401).json({ error: 'Invalid username or password' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// TRANSACTIONS
app.get('/api/transactions', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM transactions ORDER BY id DESC');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { member_id, book_id, issue_date, due_date } = req.body;
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