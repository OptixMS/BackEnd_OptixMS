app.use(express.json());

function isAuthenticated(req, res, next) {
    if (req.session.username) {
      next();
    } else {
      res.redirect('/login');
    }
  }
  
  module.exports = (req, res, next) => {
    if (!req.session.username) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Silakan login dulu.' });
    }
    next();
  };
  
  
  