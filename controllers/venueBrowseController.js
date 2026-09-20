const Venue = require('../models/Venue');
const { searchVenues } = require('../services/venueSearchService');
const { facilities: allFacilities } = require('../config/settings');
const { parseISTToUTC, formatISTDateTime } = require('../services/timeHelper');

/**
 * Browse and search active venues with multi-criteria filters
 */
const getVenuesCatalog = async (req, res, next) => {
  try {
    const minCapacity = req.query.minCapacity;
    const maxRate = req.query.maxRate;
    const facilities = req.query.facilities;
    const sort = req.query.sort;
    const filterDate = req.query.filterDate || req.query.date;
    const filterStartTime = req.query.filterStartTime || req.query.startTime;
    const filterEndTime = req.query.filterEndTime || req.query.endTime;

    let startUTC = null;
    let endUTC = null;
    if (filterDate && filterStartTime && filterEndTime) {
      startUTC = parseISTToUTC(filterDate, filterStartTime);
      endUTC = parseISTToUTC(filterDate, filterEndTime);
    }

    const selectedFacilities = facilities
      ? (Array.isArray(facilities) ? facilities : [facilities])
      : [];

    const venues = await searchVenues({
      minCapacity,
      maxRate,
      facilities: selectedFacilities,
      sort,
      start: startUTC,
      end: endUTC
    });

    let suggestions = null;
    if (venues.length === 0 && startUTC && endUTC) {
      const { getAlternativeVenues, getAlternativeSlots } = require('../services/suggestionService');
      
      // 1. Check venues available at requested time with relaxed facility filters
      const parsedCap = minCapacity ? parseInt(minCapacity, 10) : 1;
      let altVenues = await getAlternativeVenues({
        start: startUTC,
        end: endUTC,
        attendees: parsedCap,
        requiredFacilities: []
      });

      // If no venues met the requested minCapacity, suggest largest active available venues
      if (altVenues.length === 0) {
        altVenues = await getAlternativeVenues({
          start: startUTC,
          end: endUTC,
          attendees: 1,
          requiredFacilities: []
        });
      }

      // 2. Check alternative slots across active venues
      const altSlots = [];
      const sampleVenues = await Venue.find({ isActive: true }).limit(3);
      for (const sv of sampleVenues) {
        const slots = await getAlternativeSlots({
          venueId: sv._id,
          dateStr: filterDate,
          startTimeStr: filterStartTime,
          endTimeStr: filterEndTime,
          maxSlots: 2
        });
        slots.forEach(s => altSlots.push({ ...s, venueName: sv.name, venueId: sv._id }));
      }

      suggestions = {
        alternativeVenues: altVenues.slice(0, 4),
        alternativeSlots: altSlots.slice(0, 4),
        hasSuggestions: altVenues.length > 0 || altSlots.length > 0
      };
    }

    res.render('pages/venues/index', {
      title: 'Browse Campus Venues',
      activePage: 'venues',
      venues,
      allFacilities,
      suggestions,
      filters: {
        minCapacity: minCapacity || '',
        maxRate: maxRate || '',
        facilities: selectedFacilities,
        sort: sort || '',
        filterDate: filterDate || '',
        filterStartTime: filterStartTime || '',
        filterEndTime: filterEndTime || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * View Single Venue Detail & Upcoming Maintenance
 */
const getVenueDetail = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({ _id: req.params.id, isActive: true });
    if (!venue) {
      req.flash('error_msg', 'Venue not found or currently unavailable.');
      return res.redirect('/venues');
    }

    // Filter upcoming maintenance blocks
    const now = new Date();
    const upcomingMaintenance = (venue.blockedDates || [])
      .filter(b => new Date(b.to) > now)
      .sort((a, b) => new Date(a.from) - new Date(b.from));

    res.render('pages/venues/show', {
      title: venue.name,
      activePage: 'venues',
      venue,
      upcomingMaintenance,
      formatISTDateTime
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVenuesCatalog,
  getVenueDetail
};
