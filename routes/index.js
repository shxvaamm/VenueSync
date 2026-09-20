const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Landing Page
router.get('/', homeController.getHomePage);

// Test Route for Flash Messages Demo
router.get('/test-flash', homeController.getTestFlash);

// Explicit 404 Preview Route
router.get('/404-preview', (req, res, next) => {
  next(); // Passes to 404 handler
});

// Auth Logout helper for role test toggle
router.post('/auth/logout', (req, res) => {
  delete req.session.currentUser;
  req.flash('info_msg', 'You have been logged out successfully.');
  res.redirect('/');
});

module.exports = router;
