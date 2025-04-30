function isAuthenticated(req, res, next) {
    if (req.session.username) {
      next();
    } else {
      res.redirect('/login');
    }
  }
  
  module.exports = (req, res, next) => {
    if (!req.session.userId) {
      req.flash('error', 'You must be logged in to view this page');
      return res.redirect('/login');
    }
    next();
  };
  
  