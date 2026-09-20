const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { requireLogin } = require('../middleware/auth');

// All booking interactions require authenticated login
router.use(requireLogin);

// Booking Request Form & Creation
router.get('/new', bookingController.getNewBookingForm);
router.post('/', bookingController.postCreateBooking);

// Organiser Personal Bookings List
router.get('/my', bookingController.getMyBookings);

// Cancel Booking
router.post('/:id/cancel', bookingController.postCancelBooking);

module.exports = router;
