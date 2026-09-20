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

module.exports = router;
