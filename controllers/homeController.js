const settings = require('../config/settings');

const getHomePage = (req, res) => {
  // Support preview_role query param for verifying role-based navigation states in Phase 1
  if (req.query.preview_role) {
    if (req.query.preview_role === 'guest') {
      delete req.session.currentUser;
      res.locals.currentUser = null;
    } else if (req.query.preview_role === 'organiser') {
      req.session.currentUser = {
        id: 'mock-org-1',
        name: 'Alex Rivera (Debate Society)',
        email: 'alex@campus.edu',
        role: 'organiser'
      };
      res.locals.currentUser = req.session.currentUser;
    } else if (req.query.preview_role === 'admin') {
      req.session.currentUser = {
        id: 'mock-admin-1',
        name: 'Prof. S. Ramanujan (Venue Admin)',
        email: 'admin@campus.edu',
        role: 'admin'
      };
      res.locals.currentUser = req.session.currentUser;
    }
  }

  res.render('pages/index', {
    title: 'Home - Event & Venue Booking',
    activePage: 'home',
    settings
  });
};

const getTestFlash = (req, res) => {
  req.flash('success_msg', 'Your test request was processed successfully! This demonstrates our green success flash alert.');
  req.flash('error_msg', 'Validation alert: Please ensure booking end time is after start time.');
  req.flash('info_msg', 'Campus facilities will undergo routine maintenance on Sunday from 06:00 to 08:00 IST.');
  res.redirect('/');
};

module.exports = {
  getHomePage,
  getTestFlash
};
