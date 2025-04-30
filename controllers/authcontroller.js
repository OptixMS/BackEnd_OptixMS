const pool = require('../config/db');
const bcrypt = require('bcrypt');

exports.showLogin = (req, res) => {
  res.render('loginpage');
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT password FROM account WHERE username = $1', [username]);

  if (result.rows.length > 0) {
    const match = await bcrypt.compare(password, result.rows[0].password);
    if (match) {
      return res.redirect('/dashboardpage');
    }
  }
  req.flash('error', 'Login failed. Please check your credentials.');
  res.redirect('/login');
};

exports.showRegister = (req, res) => {
  res.render('registerpage');
};

exports.register = async (req, res) => {
  const { username, password } = req.body;
  const userCheck = await pool.query('SELECT * FROM account WHERE username = $1', [username]);

  if (userCheck.rows.length === 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO account (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  } else {
    req.flash('error', 'Username already exists.');
    res.redirect('/signUpPage');
  }
};
