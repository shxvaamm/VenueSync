const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');

// Admin role check
router.use(requireRole('admin'));

// Admin Dashboard Overview
const dashboardService = require('../services/dashboardService');

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboardData = await dashboardService.getDashboardData(req.query);

    res.render('pages/admin/dashboard', {
      title: 'Administrator Dashboard & Analytics',
      activePage: 'admin-dashboard',
      ...dashboardData
    });
  } catch (err) {
    next(err);
  }
});

// Mount admin venue CRUD sub-routes
router.use('/venues', require('./adminVenues'));

// Mount admin booking management sub-routes
router.use('/bookings', require('./adminBookings'));

module.exports = router;
