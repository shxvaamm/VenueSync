const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');

// Admin role check
router.use(requireRole('admin'));

// Admin Dashboard Overview
router.get('/dashboard', async (req, res, next) => {
  try {
    const venuesCount = await Venue.countDocuments();
    const pendingCount = await Booking.countDocuments({ status: 'pending' });
    const approvedCount = await Booking.countDocuments({ status: 'approved' });
    const totalBookings = await Booking.countDocuments();

    res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard',
      activePage: 'admin-dashboard',
      stats: {
        venuesCount,
        pendingCount,
        approvedCount,
        totalBookings
      }
    });
  } catch (err) {
    next(err);
  }
});

// Mount admin venue CRUD sub-routes
router.use('/venues', require('./adminVenues'));

module.exports = router;
