const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter for Authentication endpoints (Login & Register)
 * Prevents brute force password guessing and account generation flooding.
 * 15 minute window, max 20 attempts per IP address.
 * Automatically bypassed in test environment so automated test suites run without throttling.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    req.flash('error_msg', 'Too many requests from this device. Please wait 15 minutes before trying again.');
    const redirectUrl = req.originalUrl.includes('register') ? '/auth/register' : '/auth/login';
    res.status(429).redirect(redirectUrl);
  }
});

module.exports = {
  authLimiter
};
