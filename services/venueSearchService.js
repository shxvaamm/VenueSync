const Venue = require('../models/Venue');
const { checkSlotAvailability } = require('./availabilityService');

/**
 * Searches and filters active venues based on criteria
 *
 * @param {Object} filters
 * @param {number|string} [filters.minCapacity] - Minimum capacity filter
 * @param {string[]|string} [filters.facilities] - Must contain ALL selected facilities ($all)
 * @param {number|string} [filters.maxRate] - Maximum hourly rate filter
 * @param {string} [filters.sort] - Sorting ('price_asc', 'price_desc', 'capacity_asc', 'capacity_desc')
 * @param {Date} [filters.start] - Optional slot start (UTC)
 * @param {Date} [filters.end] - Optional slot end (UTC)
 * @returns {Promise<Array>} Array of matching active venues
 */
const searchVenues = async (filters = {}) => {
  const query = { isActive: true };

  // Filter 1: Minimum Capacity
  if (filters.minCapacity && Number(filters.minCapacity) > 0) {
    query.capacity = { $gte: parseInt(filters.minCapacity, 10) };
  }

  // Filter 2: Maximum Hourly Rate
  if (filters.maxRate !== undefined && filters.maxRate !== '' && !isNaN(filters.maxRate)) {
    query.hourlyRate = { $lte: parseFloat(filters.maxRate) };
  }

  // Filter 3: Facilities (Venue must have ALL selected facilities)
  if (filters.facilities) {
    const facilitiesArray = Array.isArray(filters.facilities)
      ? filters.facilities.filter(Boolean)
      : [filters.facilities].filter(Boolean);

    if (facilitiesArray.length > 0) {
      query.facilities = { $all: facilitiesArray };
    }
  }

  // Sorting
  let sort = { name: 1 };
  if (filters.sort === 'price_asc') sort = { hourlyRate: 1 };
  else if (filters.sort === 'price_desc') sort = { hourlyRate: -1 };
  else if (filters.sort === 'capacity_asc') sort = { capacity: 1 };
  else if (filters.sort === 'capacity_desc') sort = { capacity: -1 };

  let venues = await Venue.find(query).sort(sort);

  // Filter 4: Optional Time-Slot Availability Filter (Phase 5 extension)
  if (filters.start && filters.end) {
    const freeVenues = [];
    for (const venue of venues) {
      const status = await checkSlotAvailability({
        venueId: venue._id,
        start: filters.start,
        end: filters.end
      });
      if (status.available) {
        freeVenues.push(venue);
      }
    }
    venues = freeVenues;
  }

  return venues;
};

module.exports = {
  searchVenues
};
