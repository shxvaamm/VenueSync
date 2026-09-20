const { body } = require('express-validator');

const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please provide your full name.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long. Please create a stronger password.'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match. Please ensure both password fields are identical.');
      }
      return true;
    })
];

const loginValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Please enter your password.')
];

module.exports = {
  registerValidationRules,
  loginValidationRules
};
