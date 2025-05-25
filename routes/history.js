const express = require('express');
const router = express.Router();
const pool = require('../config/EncodingDB'); 
const { authenticateToken } = require('../middleware/auth');

// GET /api/history
router.get('/history', authenticateToken, async (req, res) => {
  const username = req.user?.username;

  // Log username dari token
  console.log('🔍 Username dari token JWT:', username);

  if (!username) {
    return res.status(401).json({
      success: false,
      message: 'Username tidak ditemukan dalam token.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         username,
         tanggal,
         "Alarm ID",          -- Pastikan nama kolom ini benar di DB Anda
         "Location Info" AS location, -- Pastikan nama kolom ini benar di DB Anda
         predicted_severity AS severity
       FROM hasil_encoding
       WHERE username = $1
       ORDER BY tanggal DESC`,
      [username]
    );

    console.log(`📦 Jumlah data history ditemukan untuk user '${username}': ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log('Contoh data history pertama:', result.rows[0]);
    } else {
      console.log('Tidak ada data history ditemukan untuk username ini.');
    }


    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Error mengambil history:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data history.' });
  }
});

module.exports = router;