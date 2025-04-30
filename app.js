const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('connect-flash');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const upload = multer({ dest: 'uploads/' });
require('dotenv').config();

const app = express();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'accountDB',
  password: '445656',
  port: 5432,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'routes', 'views'));

app.use(session({
  secret: '2LsM~>w=-&24*+x',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

pool.query(`
  CREATE TABLE IF NOT EXISTS account (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    password TEXT NOT NULL
  )
`);

app.get('/', (req, res) => {
  res.send('Response Success!');
});

app.get('/landingpage', (req, res) => {
  res.render('landingpage');
});

app.get('/login', (req, res) => {
  res.render('loginpage');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password FROM account WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const match = await bcrypt.compare(password, result.rows[0].password);
      if (match) {
        return res.redirect(`/${username}/dashboard`);
      }
    }
    req.flash('error', 'Login gagal. Username atau password salah.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan saat login.');
    res.redirect('/login');
  }
});

app.get('/signUpPage', (req, res) => {
  res.render('registerpage');
});

app.post('/signUpPage', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const check = await pool.query('SELECT * FROM account WHERE username = $1', [username]);
    if (check.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO account (username, email, password) VALUES ($1, $2, $3)',
        [username, email, hashedPassword]
      );
      req.flash('success', 'Registrasi berhasil. Silakan login.');
      return res.redirect('/login');
    } else {
      req.flash('error', 'Username sudah digunakan.');
      res.redirect('/signUpPage');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan saat registrasi.');
    res.redirect('/signUpPage');
  }
});

app.get('/:username/dashboard', (req, res) => {
  res.render('dashboard', { username: req.params.username });
});

app.get('/:username/dashboard/temperature', (req, res) => {
  res.render('temperaturpage', { username: req.params.username });
});

app.get('/:username/dashboard/device', (req, res) => {
  res.render('sitedevicepage', { username: req.params.username });
});

app.get('/:username/dashboard/map', (req, res) => {
  res.render('mappage', { username: req.params.username });
});

app.get('/:username/dashboard/about', (req, res) => {
  res.render('aboutpage', { username: req.params.username });
});

// ===== PREDIKSI BERDASARKAN TANGGAL =====
app.post('/:username/dashboard/predictpage', upload.single('dummy_file'), async (req, res) => {
  const { username } = req.params;
  const { tanggal } = req.body;
  const file = req.file;

  if (!tanggal || !file) {
    req.flash('error', 'Tanggal dan file CSV wajib diisi.');
    return res.redirect(`/${username}/dashboard`);
  }

  try {
    const formData = new FormData();
    formData.append('tanggal', tanggal);
    formData.append('dummy_file', fs.createReadStream(file.path));

    const response = await fetch('http://localhost:5002/predict', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const result = await response.json();

    if (result.error) {
      req.flash('error', `Gagal prediksi: ${result.error}`);
      return res.redirect(`/${username}/dashboard`);
    }

    res.render('predictpage', {
      username,
      tanggal: result.tanggal_input,
      rows: result.results  // ← banyak baris
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal menghubungi server Flask.');
    res.redirect(`/${username}/dashboard`);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      req.flash('error', 'Gagal logout.');
      return res.redirect('/landingpage');
    }
    res.redirect('/login');
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});