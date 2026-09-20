const { validationResult } = require('express-validator');
const User = require('../models/User');

/**
 * Render Organiser Registration Page
 */
const getRegister = (req, res) => {
  res.render('pages/auth/register', {
    title: 'Register as Organiser',
    activePage: 'register',
    formData: {},
    errors: {}
  });
};

/**
 * Handle Organiser Registration
 */
const postRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const formData = {
      name: req.body.name || '',
      email: req.body.email || ''
    };

    if (!errors.isEmpty()) {
      const errorMap = {};
      errors.array().forEach(err => {
        errorMap[err.path] = err.msg;
      });

      return res.status(422).render('pages/auth/register', {
        title: 'Register as Organiser',
        activePage: 'register',
        formData,
        errors: errorMap
      });
    }

    // Check for existing user with this email
    const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
    if (existingUser) {
      return res.status(422).render('pages/auth/register', {
        title: 'Register as Organiser',
        activePage: 'register',
        formData,
        errors: {
          email: 'An account with this email already exists. Please log in or use a different email.'
        }
      });
    }

    // Hash password and save new organiser
    const passwordHash = await User.hashPassword(req.body.password);
    await User.create({
      name: req.body.name.trim(),
      email: req.body.email.toLowerCase().trim(),
      passwordHash,
      role: 'organiser'
    });

    req.flash('success_msg', 'Your organiser account has been created successfully. Please log in to continue.');
    res.redirect('/auth/login');
  } catch (err) {
    next(err);
  }
};

/**
 * Render Login Page
 */
const getLogin = (req, res) => {
  res.render('pages/auth/login', {
    title: 'Log In',
    activePage: 'login',
    formData: {},
    errors: {}
  });
};

/**
 * Handle Login with Session Regeneration and Role-Based Redirect
 */
const postLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const formData = { email: req.body.email || '' };

    if (!errors.isEmpty()) {
      const errorMap = {};
      errors.array().forEach(err => {
        errorMap[err.path] = err.msg;
      });

      return res.status(422).render('pages/auth/login', {
        title: 'Log In',
        activePage: 'login',
        formData,
        errors: errorMap
      });
    }

    // Authenticate user
    const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).render('pages/auth/login', {
        title: 'Log In',
        activePage: 'login',
        formData,
        errors: {
          email: 'Invalid email or password. Please verify your credentials and try again.'
        }
      });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.status(401).render('pages/auth/login', {
        title: 'Log In',
        activePage: 'login',
        formData,
        errors: {
          email: 'Invalid email or password. Please verify your credentials and try again.'
        }
      });
    }

    // Regenerate session on login for session fixation protection
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.currentUser = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      };

      req.flash('success_msg', `Welcome back, ${user.name}!`);

      // Role-based redirect
      if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      return res.redirect('/venues');
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle Logout
 */
const postLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Session Destroy Error]:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  postLogout
};
