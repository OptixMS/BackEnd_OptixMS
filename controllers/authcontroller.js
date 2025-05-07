const pool = require('../config/db');
const bcrypt = require('bcrypt');

exports.showLogin = (req, res) => {
  res.render('loginpage');
};

exports.login = async (req, res) => {
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
};

exports.showRegister = (req, res) => {
  res.render('registerpage');
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const userCheck = await pool.query('SELECT * FROM account WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO account (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);
      req.flash('success', 'Registrasi berhasil. Silakan login.');
      res.redirect('/login');
    } else {
      req.flash('error', 'Username sudah digunakan.');
      res.redirect('/signUpPage');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan saat registrasi.');
    res.redirect('/signUpPage');
  }
};
