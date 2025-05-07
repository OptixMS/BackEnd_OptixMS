const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');

router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/signUpPage', authController.showRegister);
router.post('/signUpPage', authController.register);
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      req.flash('error', 'Gagal logout.');
      return res.redirect('/landingpage');
    }
    req.session.username = newUsername;
    s
  });
});

module.exports = router;
