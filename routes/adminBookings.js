const express = require('express');
const router = express.Router();
const adminBookingController = require('../controllers/adminBookingController');
const { requireRole } = require('../middleware/auth');

// All routes here strictly require admin role
router.use(requireRole('admin'));

// Bookings List & Filter
router.get('/', adminBookingController.getAdminBookingsList);

// Booking Detail & Decision Page
router.get('/:id', adminBookingController.getAdminBookingDetail);

// Status Transition Actions
router.post('/:id/approve', adminBookingController.postApproveBooking);
router.post('/:id/reject', adminBookingController.postRejectBooking);
router.post('/:id/complete', adminBookingController.postCompleteBooking);
router.post('/:id/cancel', adminBookingController.postCancelBooking);

module.exports = router;
