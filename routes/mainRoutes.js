const express = require('express');
const router = express.Router();
const authMiddleware = require('OptixMS/middleware/auth');
const mainRoutes = require('/routes/mainRoutes');
app.use(mainRoutes);

router.get('/', (req, res) => {
    res.render('landingpage'); 
  });

// Protect dashboard route
router.get('/dashboardpage', authMiddleware, (req, res) => {
  res.render('dashboardpage');
});

// Public Pages
router.get('/landingpage', (req, res) => res.render('landingpage'));
router.get('/about', (req, res) => res.render('aboutpage'));
router.get('/map', (req, res) => res.render('mappage'));
router.get('/device', (req, res) => res.render('sitedevicepage'));
router.get('/temperature', (req, res) => res.render('temperaturpage'));
router.get('/dashboardpage', (req, res) => res.render('dashboardpage'));

// Auth
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/signUpPage', authController.showRegister);
router.post('/signUpPage', authController.register);

module.exports = router;
 // login route
 exports.login = async (req, res) => {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM account WHERE username = $1', [username]);
  
    if (result.rows.length > 0) {
      const match = await bcrypt.compare(password, result.rows[0].password);
      if (match) {
        req.session.userId = result.rows[0].id;  // Set user session
        return res.redirect('/dashboardpage');
      }
    }
    req.flash('error', 'Login failed. Please check your credentials.');
    res.redirect('/login');
  };
  
// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Failed to log out.");
      }
      res.redirect('/login');
    });
  });

 
  