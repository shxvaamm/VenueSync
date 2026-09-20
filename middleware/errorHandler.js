// Centralized Error Handling Middleware

const notFoundHandler = (req, res, next) => {
  res.status(404).render('errors/404', {
    title: '404 - Page Not Found',
    activePage: '404'
  });
};

const centralErrorHandler = (err, req, res, next) => {
  console.error('[Application Error]:', err.stack || err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'The server encountered an unexpected error while processing your request. Please try again or contact the campus venue manager.';

  res.status(statusCode).render('errors/500', {
    title: `${statusCode} - Server Error`,
    activePage: '500',
    message,
    error: process.env.NODE_ENV === 'development' ? err : null
  });
};

module.exports = {
  notFoundHandler,
  centralErrorHandler
};
