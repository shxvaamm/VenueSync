const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/auth');
const { registerValidationRules, loginValidationRules } = require('../middleware/validators');

// Registration routes (Organiser self-registration only)
router.get('/register', requireGuest, authController.getRegister);
router.post('/register', requireGuest, registerValidationRules, authController.postRegister);

// Login routes
router.get('/login', requireGuest, authController.getLogin);
router.post('/login', requireGuest, loginValidationRules, authController.postLogin);

// Logout route
router.post('/logout', authController.postLogout);
router.get('/logout', authController.postLogout);

module.exports = router;
