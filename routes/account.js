const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/AccountDB');
const nodemailer = require('../config/nodemailer');
const { authenticateToken } = require('../middleware/auth');
const { blacklistToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'rahasia';

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password FROM account WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const match = await bcrypt.compare(password, result.rows[0].password);
      if (match) {
        const token = jwt.sign({ username }, JWT_SECRET_KEY, { expiresIn: '1h' });
        return res.json({ success: true, username, token });
      }
    }
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Kesalahan server saat login.' });
  }
});

// ========== REGISTER ==========
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const check = await pool.query('SELECT * FROM account WHERE username = $1', [username]);
    if (check.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO account (username, email, password) VALUES ($1, $2, $3)',
        [username, email, hashedPassword]
      );
      return res.json({ success: true, message: 'Registrasi berhasil.' });
    } else {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Kesalahan server saat registrasi.' });
  }
});

// ========== GET ACCOUNT ==========
router.get('/account/:username', authenticateToken, async (req, res) => {
  const { username } = req.params;

  // Validasi bahwa yang mengakses adalah user yang sesuai token
  if (username !== req.user.username) {
    return res.status(403).json({ success: false, message: 'Akses ditolak.' });
  }

  try {
    const result = await pool.query(
      'SELECT username, email FROM account WHERE username = $1',
      [username]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, data: result.rows[0] });
    } else {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Kesalahan server.' });
  }
});


// ========== LOGOUT ==========
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    blacklistToken(token);
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, message: 'Gagal logout.' });
    }
    return res.json({ success: true, message: 'Logout berhasil.' });
  });
});

// ========== EDIT PROFILE ==========
router.put('/account/:username', authenticateToken, async (req, res) => {
  const { username } = req.params;

  // Validasi bahwa user hanya bisa edit profil sendiri
  if (username !== req.user.username) {
    return res.status(403).json({ success: false, message: 'Akses ditolak.' });
  }

  const { newUsername, newEmail, newPassword } = req.body;

  if (!newUsername || !newEmail || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Username, email, dan password baru wajib diisi.'
    });
  }

  try {
    const checkExisting = await pool.query(
      'SELECT * FROM account WHERE username = $1 AND username <> $2',
      [newUsername, username]
    );

    if (checkExisting.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username baru sudah digunakan oleh user lain.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE account
       SET username = $1,
           email = $2,
           password = $3
       WHERE username = $4
       RETURNING username, email`,
      [newUsername, newEmail, hashedPassword, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Edit profile error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
  }
});


// ========== FORGOT PASSWORD ==========
router.post('/forgotpassword', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email wajib diisi.',
    });
  }

  try {
    const user = await pool.query('SELECT * FROM account WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email tidak terdaftar.' });
    }

    const token = jwt.sign({ email }, JWT_SECRET_KEY, { expiresIn: '1h' });
    const resetUrl = `http://localhost:5173/resetpassword?token=${token}`;

    const html = `
      <p>Hai ${user.rows[0].username},</p>
      <p>Klik link berikut untuk mengatur ulang password Anda:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Link ini akan kedaluwarsa dalam 1 jam.</p>
    `;

    await nodemailer.sendMail(email, 'Reset Password', html);

    return res.json({ success: true, message: 'Email reset password berhasil dikirim.' });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengirim email reset.",
      error: error.message
    });
  }
});

// ========== RESET PASSWORD ==========
router.post('/resetpassword', async (req, res) => {
  const { token } = req.query;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Password dan konfirmasi password wajib diisi.',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Konfirmasi password tidak cocok.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'UPDATE account SET password = $1 WHERE email = $2 RETURNING username, email',
      [hashedPassword, decoded.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    return res.json({
      success: true,
      message: 'Password berhasil direset.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Token tidak valid atau expired.' });
  }
});

module.exports = router;
