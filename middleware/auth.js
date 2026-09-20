/**
 * Authentication and Role-Based Authorization Middleware
 */

// Middleware to expose current user from session to all EJS templates
const exposeCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.session.currentUser || null;
  next();
};

// Middleware requiring user to be logged in
const requireLogin = (req, res, next) => {
  if (!req.session || !req.session.currentUser) {
    req.flash('error_msg', 'Please log in to your account to access this page.');
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware restricting routes to users with a specific role ('admin' | 'organiser')
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.session || !req.session.currentUser) {
      req.flash('error_msg', 'Please log in to your account to access this page.');
      return res.redirect('/auth/login');
    }

    if (req.session.currentUser.role !== role) {
      return res.status(403).render('errors/403', {
        title: '403 - Access Forbidden',
        activePage: '403',
        message: `Restricted Access: Your account (${req.session.currentUser.role}) does not have permission to view ${role} resources.`
      });
    }

    next();
  };
};

// Middleware preventing logged-in users from accessing guest-only pages (e.g. login, register)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.currentUser) {
    if (req.session.currentUser.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/venues');
  }
  next();
};

module.exports = {
  exposeCurrentUser,
  requireLogin,
  requireRole,
  requireGuest
};
