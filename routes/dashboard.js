const express = require('express');
const pool = require('../config/AccountDB');
const auth = require('../middleware/auth');
const authenticateToken = auth.authenticateToken;

const router = express.Router();

// Endpoint dashboard: hanya untuk user yang sudah login (pakai token JWT)
console.log('typeof authenticateToken:', typeof authenticateToken);
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;

    const result = await pool.query(
      'SELECT username, email FROM account WHERE username = $1',
      [username]
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        data: result.rows[0],
        message: `Halo ${result.rows[0].username}, selamat datang di dashboard.`
      });
    } else {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
  } catch (err) {
    console.error('Dashboard Error:', err);
    return res.status(500).json({ success: false, message: 'Kesalahan server.' });
  }
});
module.exports = router;
