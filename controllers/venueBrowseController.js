const Venue = require('../models/Venue');
const { searchVenues } = require('../services/venueSearchService');
const { facilities: allFacilities } = require('../config/settings');
const { parseISTToUTC, formatISTDateTime } = require('../services/timeHelper');

/**
 * Browse and search active venues with multi-criteria filters
 */
const getVenuesCatalog = async (req, res, next) => {
  try {
    const { minCapacity, maxRate, facilities, sort, filterDate, filterStartTime, filterEndTime } = req.query;

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

    res.render('pages/venues/index', {
      title: 'Browse Campus Venues',
      activePage: 'venues',
      venues,
      allFacilities,
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
