const jwt = require('jsonwebtoken');

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'rahasia';
const blacklist = new Set();

// Fungsi untuk mem-blacklist token (digunakan saat logout)
function blacklistToken(token) {
  blacklist.add(token);
}

// Fungsi middleware untuk memverifikasi token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ada.' });
  }

  if (blacklist.has(token)) {
    return res.status(403).json({ success: false, message: 'Token sudah tidak berlaku (logout).' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau expired.' });
  }
}

module.exports = {
  authenticateToken,
  blacklistToken
};
