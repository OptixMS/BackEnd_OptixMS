const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const router = express.Router();

// Login
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password FROM account WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const match = await bcrypt.compare(password, result.rows[0].password);
      if (match) {
        req.session.username = username;
        return res.json({ success: true, username });
      }
    }
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Kesalahan server saat login.' });
  }
});

// Register
router.post('/api/register', async (req, res) => {
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

// Get account info
router.get('/api/account/:username', async (req, res) => {
  const { username } = req.params;
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

// Logout
router.get('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, message: 'Gagal logout.' });
    }
    return res.json({ success: true });
  });
});

// Edit profile: username, email, password
router.put('/api/account/:username', async (req, res) => {
  const { username } = req.params;
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

    req.session.username = newUsername;

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

module.exports = router;
