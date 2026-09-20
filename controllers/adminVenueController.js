const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { facilities: allFacilities } = require('../config/settings');
const { parseISTToUTC, formatISTDateYMD, formatISTTimeHM, formatISTDateTime } = require('../services/timeHelper');

/**
 * List all venues for Admin management
 */
const getVenuesList = async (req, res, next) => {
  try {
    const venues = await Venue.find().sort({ createdAt: -1 });
    res.render('pages/admin/venues/index', {
      title: 'Manage Venues',
      activePage: 'admin-venues',
      venues
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Render Create Venue Form
 */
const getNewVenueForm = (req, res) => {
  res.render('pages/admin/venues/new', {
    title: 'Add New Venue',
    activePage: 'admin-venues',
    allFacilities,
    formData: { facilities: [] },
    errors: {}
  });
};

/**
 * Handle Venue Creation
 */
const postCreateVenue = async (req, res, next) => {
  try {
    const { name, capacity, facilities, hourlyRate, description, isActive } = req.body;
    const facilitiesList = facilities ? (Array.isArray(facilities) ? facilities : [facilities]) : [];

    const errors = {};
    if (!name || !name.trim()) errors.name = 'Please provide a venue name.';
    if (!capacity || parseInt(capacity, 10) < 1) errors.capacity = 'Capacity must be at least 1 person.';
    if (hourlyRate === undefined || hourlyRate === '' || parseFloat(hourlyRate) < 0) {
      errors.hourlyRate = 'Hourly rate cannot be negative.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('pages/admin/venues/new', {
        title: 'Add New Venue',
        activePage: 'admin-venues',
        allFacilities,
        formData: req.body,
        errors
      });
    }

    // Check unique name
    const existing = await Venue.findOne({ name: name.trim() });
    if (existing) {
      return res.status(422).render('pages/admin/venues/new', {
        title: 'Add New Venue',
        activePage: 'admin-venues',
        allFacilities,
        formData: req.body,
        errors: { name: 'A venue with this name already exists. Please choose a distinct name.' }
      });
    }

    await Venue.create({
      name: name.trim(),
      capacity: parseInt(capacity, 10),
      facilities: facilitiesList,
      hourlyRate: parseFloat(hourlyRate),
      description: description ? description.trim() : '',
      isActive: isActive === 'on' || isActive === true || isActive === 'true'
    });

    req.flash('success_msg', `Venue "${name.trim()}" created successfully.`);
    res.redirect('/admin/venues');
  } catch (err) {
    next(err);
  }
};

/**
 * Render Edit Venue Form & Maintenance Management
 */
const getEditVenueForm = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    res.render('pages/admin/venues/edit', {
      title: `Edit ${venue.name}`,
      activePage: 'admin-venues',
      allFacilities,
      venue,
      formData: venue,
      errors: {},
      formatISTDateTime
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle Venue Updates
 */
const putUpdateVenue = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    const { name, capacity, facilities, hourlyRate, description, isActive } = req.body;
    const facilitiesList = facilities ? (Array.isArray(facilities) ? facilities : [facilities]) : [];

    const errors = {};
    if (!name || !name.trim()) errors.name = 'Please provide a venue name.';
    if (!capacity || parseInt(capacity, 10) < 1) errors.capacity = 'Capacity must be at least 1 person.';
    if (hourlyRate === undefined || hourlyRate === '' || parseFloat(hourlyRate) < 0) {
      errors.hourlyRate = 'Hourly rate cannot be negative.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render('pages/admin/venues/edit', {
        title: `Edit ${venue.name}`,
        activePage: 'admin-venues',
        allFacilities,
        venue,
        formData: { ...req.body, _id: venue._id, blockedDates: venue.blockedDates },
        errors,
        formatISTDateTime
      });
    }

    // Check unique name collision
    const existing = await Venue.findOne({ name: name.trim(), _id: { $ne: venue._id } });
    if (existing) {
      return res.status(422).render('pages/admin/venues/edit', {
        title: `Edit ${venue.name}`,
        activePage: 'admin-venues',
        allFacilities,
        venue,
        formData: { ...req.body, _id: venue._id, blockedDates: venue.blockedDates },
        errors: { name: 'Another venue with this name already exists. Please choose a distinct name.' },
        formatISTDateTime
      });
    }

    venue.name = name.trim();
    venue.capacity = parseInt(capacity, 10);
    venue.facilities = facilitiesList;
    venue.hourlyRate = parseFloat(hourlyRate);
    venue.description = description ? description.trim() : '';
    venue.isActive = isActive === 'on' || isActive === true || isActive === 'true';

    await venue.save();

    req.flash('success_msg', `Venue "${venue.name}" updated successfully.`);
    res.redirect('/admin/venues');
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle Venue Active Status
 */
const postToggleStatus = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    venue.isActive = !venue.isActive;
    await venue.save();

    req.flash('success_msg', `Venue "${venue.name}" is now ${venue.isActive ? 'Active' : 'Deactivated'}.`);
    res.redirect('/admin/venues');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Venue (Guarded against future pending or approved bookings)
 */
const deleteVenue = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    // Guard rule: Block deleting venue with future pending or approved bookings
    const now = new Date();
    const futureBookingsCount = await Booking.countDocuments({
      venue: venue._id,
      end: { $gt: now },
      status: { $in: ['pending', 'approved'] }
    });

    if (futureBookingsCount > 0) {
      req.flash(
        'error_msg',
        `Cannot delete venue "${venue.name}": There are ${futureBookingsCount} upcoming pending or approved booking(s) associated with it. Please resolve them first.`
      );
      return res.redirect('/admin/venues');
    }

    await Venue.findByIdAndDelete(venue._id);
    req.flash('success_msg', `Venue "${venue.name}" was permanently deleted.`);
    res.redirect('/admin/venues');
  } catch (err) {
    next(err);
  }
};

/**
 * Add Maintenance Block to Venue
 */
const postAddMaintenanceBlock = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    const { fromDate, fromTime, toDate, toTime, reason } = req.body;
    const fromUTC = parseISTToUTC(fromDate, fromTime);
    const toUTC = parseISTToUTC(toDate, toTime);
    const now = new Date();

    if (!fromUTC || !toUTC) {
      req.flash('error_msg', 'Invalid date or time provided for maintenance block.');
      return res.redirect(`/admin/venues/${venue._id}/edit`);
    }

    if (fromUTC < now) {
      req.flash('error_msg', 'Maintenance block cannot be scheduled in the past. Please choose a future time.');
      return res.redirect(`/admin/venues/${venue._id}/edit`);
    }

    if (toUTC <= fromUTC) {
      req.flash('error_msg', 'Maintenance end time must be strictly after the start time.');
      return res.redirect(`/admin/venues/${venue._id}/edit`);
    }

    venue.blockedDates.push({
      from: fromUTC,
      to: toUTC,
      reason: reason && reason.trim() ? reason.trim() : 'Scheduled maintenance'
    });

    await venue.save();
    req.flash('success_msg', 'Maintenance window added successfully.');
    res.redirect(`/admin/venues/${venue._id}/edit`);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Maintenance Block from Venue
 */
const deleteMaintenanceBlock = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    venue.blockedDates = venue.blockedDates.filter(
      b => b._id.toString() !== req.params.blockId
    );

    await venue.save();
    req.flash('success_msg', 'Maintenance block removed successfully.');
    res.redirect(`/admin/venues/${venue._id}/edit`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVenuesList,
  getNewVenueForm,
  postCreateVenue,
  getEditVenueForm,
  putUpdateVenue,
  postToggleStatus,
  deleteVenue,
  postAddMaintenanceBlock,
  deleteMaintenanceBlock
};
