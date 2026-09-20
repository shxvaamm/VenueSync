const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { checkSlotAvailability } = require('./availabilityService');
const { operatingHours } = require('../config/settings');
const {
  formatISTDateYMD,
  parseISTToUTC,
  formatISTSlot
} = require('./timeHelper');

/**
 * Finds alternative available time slots for the same venue
 *
 * Checks:
 * 1. Same day free windows fitting duration within operating hours (08:00 to 22:00).
 * 2. Nearest free slots on the following 2 days.
 * 3. Returns at most `maxSlots` (default 5), sorted by closeness to requested start time.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.venueId
 * @param {string} params.dateStr - 'YYYY-MM-DD' in IST
 * @param {string} params.startTimeStr - 'HH:mm' in IST
 * @param {string} params.endTimeStr - 'HH:mm' in IST
 * @param {number} [params.maxSlots=5]
 * @param {Date} [params.now=new Date()]
 * @returns {Promise<Array>} List of up to 5 alternative slot suggestions
 */
const getAlternativeSlots = async ({
  venueId,
  dateStr,
  startTimeStr,
  endTimeStr,
  maxSlots = 5,
  now = new Date()
}) => {
  if (!venueId || !dateStr || !startTimeStr || !endTimeStr) {
    return [];
  }

  const [openHour] = (operatingHours.open || '08:00').split(':').map(Number);
  const [closeHour] = (operatingHours.close || '22:00').split(':').map(Number);

  const requestedStartUTC = parseISTToUTC(dateStr, startTimeStr);
  const requestedEndUTC = parseISTToUTC(dateStr, endTimeStr);
  if (!requestedStartUTC || !requestedEndUTC) return [];

  const durationHours = (requestedEndUTC.getTime() - requestedStartUTC.getTime()) / (1000 * 60 * 60);
  if (durationHours <= 0 || durationHours > (closeHour - openHour)) {
    return [];
  }

  // Days to evaluate: Day 0 (same day), Day +1, Day +2
  const candidateDays = [];
  const [y, m, d] = dateStr.split('-').map(Number);

  for (let offset = 0; offset <= 2; offset++) {
    const dayDate = new Date(Date.UTC(y, m - 1, d + offset, 12, 0, 0));
    const dayStr = `${dayDate.getUTCFullYear()}-${String(dayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dayDate.getUTCDate()).padStart(2, '0')}`;
    candidateDays.push({ offset, dayStr });
  }

  const validSlots = [];

  // Hourly candidate step search within operating hours [openHour, closeHour - durationHours]
  for (const { offset, dayStr } of candidateDays) {
    const latestStartHour = closeHour - Math.ceil(durationHours);

    for (let h = openHour; h <= latestStartHour; h++) {
      const candidateStartStr = `${String(h).padStart(2, '0')}:00`;
      const endHour = h + Math.floor(durationHours);
      const endMin = Math.round((durationHours % 1) * 60);
      const candidateEndStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      // Skip candidate if identical to requested slot on the same day
      if (offset === 0 && candidateStartStr === startTimeStr) {
        continue;
      }

      const slotStartUTC = parseISTToUTC(dayStr, candidateStartStr);
      const slotEndUTC = parseISTToUTC(dayStr, candidateEndStr);

      // Must not be in the past
      if (slotStartUTC <= now) {
        continue;
      }

      // Check slot availability reusing availabilityService
      const status = await checkSlotAvailability({
        venueId,
        start: slotStartUTC,
        end: slotEndUTC
      });

      if (status.available) {
        const distanceMs = Math.abs(slotStartUTC.getTime() - requestedStartUTC.getTime());
        const distanceHours = Math.round((distanceMs / (1000 * 60 * 60)) * 10) / 10;

        let dayLabel = 'Today';
        if (offset === 1) dayLabel = 'Tomorrow';
        else if (offset === 2) dayLabel = 'In 2 days';

        validSlots.push({
          date: dayStr,
          startTime: candidateStartStr,
          endTime: candidateEndStr,
          start: slotStartUTC,
          end: slotEndUTC,
          durationHours,
          dayOffset: offset,
          dayLabel,
          distanceMs,
          distanceHours,
          formattedSlot: formatISTSlot(slotStartUTC, slotEndUTC)
        });
      }
    }
  }

  // Sort by closeness to the requested start time
  validSlots.sort((a, b) => a.distanceMs - b.distanceMs);

  return validSlots.slice(0, maxSlots);
};

/**
 * Finds alternative active venues available at the exact requested time slot
 *
 * Ranking criteria:
 * 1. Active venue with capacity >= attendees.
 * 2. Must possess ALL required facilities (if specified).
 * 3. No collision with approved bookings or maintenance blocks at that time.
 * 4. Ranked primarily by closest capacity match (capacity - attendees ascending),
 *    then secondary by lowest total cost (duration * hourlyRate ascending).
 * 5. Returns at most `maxVenues` (default 5).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} [params.currentVenueId]
 * @param {Date} params.start - UTC start time
 * @param {Date} params.end - UTC end time
 * @param {number} params.attendees
 * @param {string[]} [params.requiredFacilities=[]]
 * @param {number} [params.maxVenues=5]
 * @returns {Promise<Array>} List of alternative venue suggestions
 */
const getAlternativeVenues = async ({
  currentVenueId = null,
  start,
  end,
  attendees = 1,
  requiredFacilities = [],
  maxVenues = 5
}) => {
  if (!start || !end) return [];

  const attendeeCount = Math.max(1, parseInt(attendees, 10) || 1);
  const durationHours = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);

  const query = {
    isActive: true,
    capacity: { $gte: attendeeCount }
  };

  if (currentVenueId) {
    query._id = { $ne: currentVenueId };
  }

  if (requiredFacilities && requiredFacilities.length > 0) {
    query.facilities = { $all: requiredFacilities };
  }

  const candidateVenues = await Venue.find(query);
  const eligibleVenues = [];

  for (const venue of candidateVenues) {
    // Re-check slot availability for this venue
    const status = await checkSlotAvailability({
      venueId: venue._id,
      start,
      end
    });

    if (status.available) {
      const capacityDiff = venue.capacity - attendeeCount;
      const totalCost = Math.round(durationHours * venue.hourlyRate);

      eligibleVenues.push({
        venueId: venue._id,
        name: venue.name,
        capacity: venue.capacity,
        capacityDiff,
        hourlyRate: venue.hourlyRate,
        facilities: venue.facilities,
        totalCost,
        description: venue.description
      });
    }
  }

  // Sort by: 1. closest capacity match (capacityDiff asc), 2. lowest total cost asc
  eligibleVenues.sort((a, b) => {
    if (a.capacityDiff !== b.capacityDiff) {
      return a.capacityDiff - b.capacityDiff;
    }
    return a.totalCost - b.totalCost;
  });

  return eligibleVenues.slice(0, maxVenues);
};

/**
 * Combines both slot and venue alternatives when a requested booking fails or search yields empty
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.venueId
 * @param {string} params.date - 'YYYY-MM-DD'
 * @param {string} params.startTime - 'HH:mm'
 * @param {string} params.endTime - 'HH:mm'
 * @param {number} params.attendees
 * @param {string[]} [params.facilities=[]]
 * @returns {Promise<{ alternativeSlots: Array, alternativeVenues: Array, hasSuggestions: boolean }>}
 */
const getBookingSuggestions = async ({
  venueId,
  date,
  startTime,
  endTime,
  attendees = 1,
  facilities = []
}) => {
  const startUTC = parseISTToUTC(date, startTime);
  const endUTC = parseISTToUTC(date, endTime);

  const [alternativeSlots, alternativeVenues] = await Promise.all([
    getAlternativeSlots({
      venueId,
      dateStr: date,
      startTimeStr: startTime,
      endTimeStr: endTime
    }),
    startUTC && endUTC
      ? getAlternativeVenues({
          currentVenueId: venueId,
          start: startUTC,
          end: endUTC,
          attendees,
          requiredFacilities: facilities
        })
      : Promise.resolve([])
  ]);

  return {
    alternativeSlots,
    alternativeVenues,
    hasSuggestions: alternativeSlots.length > 0 || alternativeVenues.length > 0
  };
};

module.exports = {
  getAlternativeSlots,
  getAlternativeVenues,
  getBookingSuggestions
};
