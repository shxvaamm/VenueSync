const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const {
  approveBooking,
  rejectBooking,
  completeBooking,
  cancelBookingByAdmin
} = require('../services/bookingTransitionService');
const { formatISTDateTime, formatISTSlot, parseISTToUTC } = require('../services/timeHelper');

/**
 * List all bookings with multi-filter and pagination
 */
const getAdminBookingsList = async (req, res, next) => {
  try {
    const { status, venue, fromDate, toDate, page = 1 } = req.query;
    const limit = 10;
    const currentPage = Math.max(1, parseInt(page, 10));

    const filter = {};

    // 1. Status Filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // 2. Venue Filter
    if (venue && venue !== 'all') {
      filter.venue = venue;
    }

    // 3. Date Range Filter (IST dates parsed to UTC range)
    if (fromDate || toDate) {
      filter.start = {};
      if (fromDate) {
        const fromUTC = parseISTToUTC(fromDate, '00:00');
        filter.start.$gte = fromUTC;
      }
      if (toDate) {
        const toUTC = parseISTToUTC(toDate, '23:59');
        filter.start.$lte = toUTC;
      }
    }

    const totalBookings = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalBookings / limit) || 1;

    const bookings = await Booking.find(filter)
      .populate('venue organiser')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    const venues = await Venue.find().sort({ name: 1 });
    const pendingCount = await Booking.countDocuments({ status: 'pending' });

    res.render('pages/admin/bookings/index', {
      title: 'Booking Approvals & Management',
      activePage: 'admin-bookings',
      bookings,
      venues,
      pendingCount,
      pagination: {
        currentPage,
        totalPages,
        totalBookings,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        nextPage: currentPage + 1,
        prevPage: currentPage - 1
      },
      filters: {
        status: status || 'all',
        venue: venue || 'all',
        fromDate: fromDate || '',
        toDate: toDate || ''
      },
      formatISTSlot,
      formatISTDateTime
    });
  } catch (err) {
    next(err);
  }
};

/**
 * View Single Booking Detail with Role Information & Action Controls
 */
const getAdminBookingDetail = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error_msg', 'Invalid booking reference ID.');
      return res.redirect('/admin/bookings');
    }

    const booking = await Booking.findById(req.params.id).populate('venue organiser');
    if (!booking) {
      req.flash('error_msg', 'Booking record not found.');
      return res.redirect('/admin/bookings');
    }

    // Check if there are other pending requests for this venue that overlap
    const overlappingPending = await Booking.find({
      venue: booking.venue._id,
      _id: { $ne: booking._id },
      status: 'pending',
      start: { $lt: booking.end },
      end: { $gt: booking.start }
    }).populate('organiser');

    const now = new Date();
    const isPastEvent = now >= new Date(booking.end);

    res.render('pages/admin/bookings/show', {
      title: `Booking: ${booking.eventName}`,
      activePage: 'admin-bookings',
      booking,
      overlappingPending,
      isPastEvent,
      formatISTSlot,
      formatISTDateTime
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve Booking
 */
const postApproveBooking = async (req, res, next) => {
  try {
    const { decisionNote } = req.body;
    const result = await approveBooking(req.params.id, decisionNote);

    if (!result.success) {
      req.flash('error_msg', result.message);
      return res.redirect(`/admin/bookings/${req.params.id}`);
    }

    if (result.conflictingPending && result.conflictingPending.length > 0) {
      req.flash(
        'warning_msg',
        `Booking approved! NOTE: There are ${result.conflictingPending.length} other pending request(s) that conflict with this slot. Please review and decline them below.`
      );
    } else {
      req.flash('success_msg', `Booking for "${result.booking.eventName}" has been officially APPROVED.`);
    }

    res.redirect(`/admin/bookings/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Booking
 */
const postRejectBooking = async (req, res, next) => {
  try {
    const { decisionNote, returnUrl } = req.body;
    const result = await rejectBooking(req.params.id, decisionNote);

    if (!result.success) {
      req.flash('error_msg', result.message);
      return res.redirect(returnUrl || `/admin/bookings/${req.params.id}`);
    }

    req.flash('info_msg', `Booking request for "${result.booking.eventName}" was REJECTED.`);
    res.redirect(returnUrl || `/admin/bookings/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Complete Booking (post-event)
 */
const postCompleteBooking = async (req, res, next) => {
  try {
    const { decisionNote } = req.body;
    const result = await completeBooking(req.params.id, decisionNote);

    if (!result.success) {
      req.flash('error_msg', result.message);
      return res.redirect(`/admin/bookings/${req.params.id}`);
    }

    req.flash('success_msg', `Booking for "${result.booking.eventName}" marked as COMPLETED.`);
    res.redirect(`/admin/bookings/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel Booking (Admin action)
 */
const postCancelBooking = async (req, res, next) => {
  try {
    const { decisionNote } = req.body;
    const result = await cancelBookingByAdmin(req.params.id, decisionNote);

    if (!result.success) {
      req.flash('error_msg', result.message);
      return res.redirect(`/admin/bookings/${req.params.id}`);
    }

    req.flash('info_msg', `Booking for "${result.booking.eventName}" was CANCELLED.`);
    res.redirect(`/admin/bookings/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminBookingsList,
  getAdminBookingDetail,
  postApproveBooking,
  postRejectBooking,
  postCompleteBooking,
  postCancelBooking
};
