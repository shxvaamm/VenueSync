const Booking = require('../models/Booking');
const Venue = require('../models/Venue');

/**
 * Checks if a time slot is available for a specified venue.
 *
 * Conflict Rule: A conflict exists if (newStart < existingEnd AND newEnd > existingStart).
 * Back-to-back reservations (e.g. newStart === existingEnd) are explicitly ALLOWED.
 *
 * Only APPROVED bookings block availability (pending bookings do not block slots).
 * Venue maintenance blocks also block availability.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.venueId
 * @param {Date} params.start - UTC start time
 * @param {Date} params.end - UTC end time
 * @param {string|mongoose.Types.ObjectId} [params.excludeBookingId] - Optional booking ID to ignore (for edits/reschedules)
 * @returns {Promise<{ available: boolean, conflictType?: string, conflict?: any, message?: string }>}
 */
const checkSlotAvailability = async ({ venueId, start, end, excludeBookingId = null }) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return {
      available: false,
      conflictType: 'invalid_date',
      message: 'Invalid start or end date supplied.'
    };
  }

  if (startDate >= endDate) {
    return {
      available: false,
      conflictType: 'invalid_range',
      message: 'Booking end time must be strictly after start time.'
    };
  }

  // 1. Check venue existence and active status
  const venue = await Venue.findById(venueId);
  if (!venue) {
    return {
      available: false,
      conflictType: 'venue_not_found',
      message: 'Venue not found.'
    };
  }

  if (!venue.isActive) {
    return {
      available: false,
      conflictType: 'venue_inactive',
      message: 'This venue is currently inactive and unavailable for booking.'
    };
  }

  // 2. Check venue maintenance blocks
  if (venue.blockedDates && venue.blockedDates.length > 0) {
    for (const block of venue.blockedDates) {
      const blockFrom = new Date(block.from);
      const blockTo = new Date(block.to);

      // Overlap: (start < blockTo AND end > blockFrom)
      if (startDate < blockTo && endDate > blockFrom) {
        return {
          available: false,
          conflictType: 'maintenance',
          conflict: block,
          message: `The venue is unavailable due to scheduled maintenance: "${block.reason || 'Maintenance'}" from ${blockFrom.toISOString()} to ${blockTo.toISOString()}.`
        };
      }
    }
  }

  // 3. Check approved bookings (Only APPROVED bookings block a slot)
  const bookingQuery = {
    venue: venueId,
    status: 'approved',
    start: { $lt: endDate },
    end: { $gt: startDate }
  };

  if (excludeBookingId) {
    bookingQuery._id = { $ne: excludeBookingId };
  }

  const conflictingBooking = await Booking.findOne(bookingQuery);
  if (conflictingBooking) {
    return {
      available: false,
      conflictType: 'booking',
      conflict: conflictingBooking,
      message: `Conflict detected: The venue is already approved for event "${conflictingBooking.eventName}".`
    };
  }

  return { available: true };
};

module.exports = {
  checkSlotAvailability
};
