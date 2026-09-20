const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { checkSlotAvailability } = require('../services/availabilityService');
const { operatingHours, bookingLimits } = require('../config/settings');
const { parseISTToUTC, formatISTDateYMD, formatISTTimeHM, formatISTDateTime, formatISTSlot } = require('../services/timeHelper');

/**
 * Render New Booking Form
 */
const getNewBookingForm = async (req, res, next) => {
  try {
    const venues = await Venue.find({ isActive: true }).sort({ name: 1 });
    const selectedVenueId = req.query.venue || (venues.length > 0 ? venues[0]._id.toString() : '');

    let selectedVenue = null;
    if (selectedVenueId) {
      selectedVenue = await Venue.findById(selectedVenueId);
    }

    res.render('pages/bookings/new', {
      title: 'Request Venue Booking',
      activePage: 'new-booking',
      venues,
      selectedVenue,
      operatingHours,
      bookingLimits,
      formData: {
        venue: selectedVenueId,
        date: req.query.date || '',
        startTime: req.query.startTime || '10:00',
        endTime: req.query.endTime || '12:00',
        attendees: req.query.attendees || '',
        eventName: '',
        description: ''
      },
      errors: {}
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle Booking Submission with Strict Validation & Conflict Detection
 */
const postCreateBooking = async (req, res, next) => {
  try {
    const { venue: venueId, eventName, description, attendees, date, startTime, endTime } = req.body;
    const mongoose = require('mongoose');
    const isValidId = venueId && mongoose.Types.ObjectId.isValid(venueId);
    const venues = await Venue.find({ isActive: true }).sort({ name: 1 });
    const selectedVenue = isValidId ? await Venue.findById(venueId) : null;

    const formData = req.body;
    const errors = {};

    // 1. Basic Field Presence
    if (!venueId) errors.venue = 'Please select a venue for your event.';
    if (!eventName || !eventName.trim()) errors.eventName = 'Please enter an event title.';
    if (!attendees || parseInt(attendees, 10) < 1) errors.attendees = 'Please specify at least 1 attendee.';
    if (!date) errors.date = 'Please pick a booking date.';
    if (!startTime) errors.startTime = 'Please select a start time.';
    if (!endTime) errors.endTime = 'Please select an end time.';

    if (Object.keys(errors).length > 0 || !selectedVenue) {
      if (!selectedVenue && !errors.venue) errors.venue = 'Selected venue could not be found.';
      return res.status(422).render('pages/bookings/new', {
        title: 'Request Venue Booking',
        activePage: 'new-booking',
        venues,
        selectedVenue: selectedVenue || null,
        operatingHours,
        bookingLimits,
        formData,
        errors
      });
    }

    // 2. Capacity Check
    const attendeeCount = parseInt(attendees, 10);
    if (attendeeCount > selectedVenue.capacity) {
      errors.attendees = `Attendees (${attendeeCount}) exceed ${selectedVenue.name}'s maximum capacity of ${selectedVenue.capacity} seats. Please adjust attendees or choose a larger venue.`;
    }

    // 3. Operating Hours Check (08:00 to 22:00 IST)
    if (startTime < operatingHours.open || startTime >= operatingHours.close) {
      errors.startTime = `Start time must be within campus operational hours (${operatingHours.open} – ${operatingHours.close} IST).`;
    }
    if (endTime <= operatingHours.open || endTime > operatingHours.close) {
      errors.endTime = `End time must be within campus operational hours (${operatingHours.open} – ${operatingHours.close} IST).`;
    }

    // 4. Time Sequence & Duration Check
    const startUTC = parseISTToUTC(date, startTime);
    const endUTC = parseISTToUTC(date, endTime);
    const now = new Date();

    if (startUTC < now) {
      errors.date = 'Booking cannot be scheduled in the past. Please choose an upcoming date and time.';
    }

    if (endUTC <= startUTC) {
      errors.endTime = 'Booking end time must be strictly after the start time.';
    } else {
      const durationHours = (endUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60);
      if (durationHours < bookingLimits.minHours) {
        errors.endTime = `Minimum booking duration is ${bookingLimits.minHours} hour(s). Currently: ${durationHours.toFixed(1)} hr(s).`;
      } else if (durationHours > bookingLimits.maxHours) {
        errors.endTime = `Maximum booking duration is ${bookingLimits.maxHours} hour(s). Currently: ${durationHours.toFixed(1)} hr(s).`;
      }
    }

    // If initial validation failed, return inline feedback
    if (Object.keys(errors).length > 0) {
      return res.status(422).render('pages/bookings/new', {
        title: 'Request Venue Booking',
        activePage: 'new-booking',
        venues,
        selectedVenue,
        operatingHours,
        bookingLimits,
        formData,
        errors
      });
    }

    // 5. Slot Availability & Conflict Detection
    const availability = await checkSlotAvailability({
      venueId: selectedVenue._id,
      start: startUTC,
      end: endUTC
    });

    if (!availability.available) {
      errors.startTime = availability.message;
      return res.status(422).render('pages/bookings/new', {
        title: 'Request Venue Booking',
        activePage: 'new-booking',
        venues,
        selectedVenue,
        operatingHours,
        bookingLimits,
        formData,
        errors
      });
    }

    // 6. Calculate Total Cost
    const durationHours = (endUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60);
    const totalCost = Math.round(durationHours * selectedVenue.hourlyRate);

    // 7. Create Booking
    const newBooking = await Booking.create({
      venue: selectedVenue._id,
      organiser: req.session.currentUser.id,
      eventName: eventName.trim(),
      description: description ? description.trim() : '',
      attendees: attendeeCount,
      start: startUTC,
      end: endUTC,
      status: 'pending',
      totalCost
    });

    req.flash('success_msg', `Booking request submitted for "${selectedVenue.name}". Reference: #${newBooking._id.toString().slice(-6).toUpperCase()}`);
    res.redirect('/bookings/my');
  } catch (err) {
    next(err);
  }
};

/**
 * Organiser "My Bookings" Page
 */
const getMyBookings = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { organiser: req.session.currentUser.id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('venue')
      .sort({ start: -1 });

    res.render('pages/bookings/my', {
      title: 'My Venue Bookings',
      activePage: 'my-bookings',
      bookings,
      currentStatusFilter: status || 'all',
      formatISTSlot,
      formatISTDateTime
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel Organiser Booking (Pending or Future Approved only)
 */
const postCancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      organiser: req.session.currentUser.id
    }).populate('venue');

    if (!booking) {
      req.flash('error_msg', 'Booking not found or access denied.');
      return res.redirect('/bookings/my');
    }

    // Only pending or future approved bookings can be cancelled
    const now = new Date();
    const canCancel = (booking.status === 'pending') || (booking.status === 'approved' && new Date(booking.start) > now);

    if (!canCancel) {
      req.flash('error_msg', `Cannot cancel a booking that is already ${booking.status} or has already begun.`);
      return res.redirect('/bookings/my');
    }

    booking.status = 'cancelled';
    booking.decisionNote = 'Cancelled by organiser';
    await booking.save();

    req.flash('success_msg', `Booking for "${booking.venue ? booking.venue.name : 'venue'}" has been cancelled.`);
    res.redirect('/bookings/my');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNewBookingForm,
  postCreateBooking,
  getMyBookings,
  postCancelBooking
};
