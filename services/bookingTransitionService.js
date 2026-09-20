const Booking = require('../models/Booking');
const { checkSlotAvailability } = require('./availabilityService');

// Valid status transitions map
const VALID_TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: []
};

/**
 * Validates whether a proposed status transition is permitted
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @param {Object} options
 * @param {Date} options.endTime
 * @param {Date} [options.now]
 * @returns {{ valid: boolean, message?: string }}
 */
const validateStatusTransition = (currentStatus, targetStatus, { endTime, now = new Date() } = {}) => {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const allowedNext = VALID_TRANSITIONS[currentStatus];
  if (!allowedNext || allowedNext.length === 0) {
    return {
      valid: false,
      message: `Cannot transition booking from "${currentStatus}" to "${targetStatus}". Final states (rejected, completed, cancelled) cannot be modified.`
    };
  }

  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      message: `Invalid state transition from "${currentStatus}" to "${targetStatus}". Allowed next statuses: ${allowedNext.join(', ')}.`
    };
  }

  // Completion check: only permitted after event end time has elapsed
  if (targetStatus === 'completed') {
    if (new Date(now) < new Date(endTime)) {
      return {
        valid: false,
        message: 'Cannot mark booking as completed before its scheduled end time has passed.'
      };
    }
  }

  return { valid: true };
};

/**
 * Atomically approve a booking with concurrency collision protection
 * (Designed for single-instance MongoDB without replica set transactions)
 *
 * @param {string|mongoose.Types.ObjectId} bookingId
 * @param {string} [decisionNote]
 * @returns {Promise<{ success: boolean, booking?: any, conflictingBookings?: Array, message?: string }>}
 */
const approveBooking = async (bookingId, decisionNote = '') => {
  const mongoose = require('mongoose');
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, message: 'Invalid booking reference ID.' };
  }

  const booking = await Booking.findById(bookingId).populate('venue organiser');
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  // 1. Transition check
  const transitionCheck = validateStatusTransition(booking.status, 'approved', {
    endTime: booking.end
  });
  if (!transitionCheck.valid) {
    return { success: false, message: transitionCheck.message };
  }

  // 2. Pre-check slot availability (re-running availabilityService to catch other newly approved bookings)
  const availability = await checkSlotAvailability({
    venueId: booking.venue._id,
    start: booking.start,
    end: booking.end,
    excludeBookingId: booking._id
  });

  if (!availability.available) {
    return {
      success: false,
      message: `Approval refused: ${availability.message}`
    };
  }

  // 3. Concurrency Protection: Atomic conditional update on status === 'pending'
  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending' },
    {
      $set: {
        status: 'approved',
        decisionNote: decisionNote ? decisionNote.trim() : 'Approved by venue administrator'
      }
    },
    { returnDocument: 'after' }
  ).populate('venue organiser');

  if (!updatedBooking) {
    return {
      success: false,
      message: 'Booking could not be approved: The booking status may have already changed.'
    };
  }

  // 4. Double-check for race conditions (in case two approvals occurred simultaneously)
  const raceConflict = await Booking.findOne({
    venue: updatedBooking.venue._id,
    _id: { $ne: updatedBooking._id },
    status: 'approved',
    start: { $lt: updatedBooking.end },
    end: { $gt: updatedBooking.start }
  });

  if (raceConflict) {
    // Revert this approval immediately
    await Booking.findByIdAndUpdate(updatedBooking._id, {
      status: 'pending',
      decisionNote: 'Approval reverted due to concurrent slot conflict.'
    });

    return {
      success: false,
      message: `Approval rolled back: A concurrent approval for event "${raceConflict.eventName}" claimed this slot.`
    };
  }

  // 5. Find other pending requests for this venue that now overlap (for warning banner)
  const conflictingPending = await Booking.find({
    venue: updatedBooking.venue._id,
    _id: { $ne: updatedBooking._id },
    status: 'pending',
    start: { $lt: updatedBooking.end },
    end: { $gt: updatedBooking.start }
  }).populate('organiser');

  return {
    success: true,
    booking: updatedBooking,
    conflictingPending
  };
};

/**
 * Reject a booking
 */
const rejectBooking = async (bookingId, decisionNote = '') => {
  const mongoose = require('mongoose');
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, message: 'Invalid booking reference ID.' };
  }

  const booking = await Booking.findById(bookingId).populate('venue organiser');
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  const transitionCheck = validateStatusTransition(booking.status, 'rejected', {
    endTime: booking.end
  });
  if (!transitionCheck.valid) {
    return { success: false, message: transitionCheck.message };
  }

  booking.status = 'rejected';
  booking.decisionNote = decisionNote ? decisionNote.trim() : 'Declined by venue manager';
  await booking.save();

  return { success: true, booking };
};

/**
 * Complete an approved booking (post-event)
 */
const completeBooking = async (bookingId, decisionNote = '') => {
  const mongoose = require('mongoose');
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, message: 'Invalid booking reference ID.' };
  }

  const booking = await Booking.findById(bookingId).populate('venue organiser');
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  const transitionCheck = validateStatusTransition(booking.status, 'completed', {
    endTime: booking.end
  });
  if (!transitionCheck.valid) {
    return { success: false, message: transitionCheck.message };
  }

  booking.status = 'completed';
  if (decisionNote && decisionNote.trim()) {
    booking.decisionNote = decisionNote.trim();
  }
  await booking.save();

  return { success: true, booking };
};

/**
 * Cancel an approved booking by admin
 */
const cancelBookingByAdmin = async (bookingId, decisionNote = '') => {
  const mongoose = require('mongoose');
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return { success: false, message: 'Invalid booking reference ID.' };
  }

  const booking = await Booking.findById(bookingId).populate('venue organiser');
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  const transitionCheck = validateStatusTransition(booking.status, 'cancelled', {
    endTime: booking.end
  });
  if (!transitionCheck.valid) {
    return { success: false, message: transitionCheck.message };
  }

  booking.status = 'cancelled';
  booking.decisionNote = decisionNote ? decisionNote.trim() : 'Cancelled by administrator';
  await booking.save();

  return { success: true, booking };
};

module.exports = {
  VALID_TRANSITIONS,
  validateStatusTransition,
  approveBooking,
  rejectBooking,
  completeBooking,
  cancelBookingByAdmin
};
