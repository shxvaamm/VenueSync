const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const adminBookingController = require('../controllers/adminBookingController');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Admin Booking Controller & Filter Tests', () => {
  let venue1;
  let venue2;
  let organiser;

  const baseDay = new Date('2026-12-01T00:00:00.000Z');
  const t = (hours) => new Date(baseDay.getTime() + hours * 3600000);

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    organiser = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan@campus.edu',
      passwordHash: 'dummyhash',
      role: 'organiser'
    });

    venue1 = await Venue.create({
      name: 'Campus Auditorium',
      capacity: 500,
      hourlyRate: 1500,
      isActive: true
    });

    venue2 = await Venue.create({
      name: 'Lecture Hall 101',
      capacity: 100,
      hourlyRate: 400,
      isActive: true
    });

    // Create a pending booking on venue1
    await Booking.create({
      venue: venue1._id,
      organiser: organiser._id,
      eventName: 'Cultural Gala',
      attendees: 350,
      start: t(10),
      end: t(14),
      status: 'pending',
      totalCost: 6000
    });

    // Create an approved booking on venue2
    await Booking.create({
      venue: venue2._id,
      organiser: organiser._id,
      eventName: 'Physics Seminar',
      attendees: 80,
      start: t(15),
      end: t(17),
      status: 'approved',
      totalCost: 800
    });
  });

  test('getAdminBookingsList filters by status correctly', async () => {
    let renderedView = null;
    let renderData = null;

    const req = {
      query: { status: 'pending' }
    };
    const res = {
      render: (view, data) => {
        renderedView = view;
        renderData = data;
      }
    };

    await adminBookingController.getAdminBookingsList(req, res, () => {});

    assert.strictEqual(renderedView, 'pages/admin/bookings/index');
    assert.strictEqual(renderData.bookings.length, 1);
    assert.strictEqual(renderData.bookings[0].eventName, 'Cultural Gala');
    assert.strictEqual(renderData.pendingCount, 1);
  });

  test('getAdminBookingsList filters by venue correctly', async () => {
    let renderedView = null;
    let renderData = null;

    const req = {
      query: { venue: venue2._id.toString() }
    };
    const res = {
      render: (view, data) => {
        renderedView = view;
        renderData = data;
      }
    };

    await adminBookingController.getAdminBookingsList(req, res, () => {});

    assert.strictEqual(renderedView, 'pages/admin/bookings/index');
    assert.strictEqual(renderData.bookings.length, 1);
    assert.strictEqual(renderData.bookings[0].eventName, 'Physics Seminar');
  });

  test('getAdminBookingDetail renders booking with conflict detection info', async () => {
    const booking = await Booking.findOne({ eventName: 'Cultural Gala' });

    let renderedView = null;
    let renderData = null;

    const req = {
      params: { id: booking._id.toString() }
    };
    const res = {
      render: (view, data) => {
        renderedView = view;
        renderData = data;
      },
      redirect: () => {}
    };

    await adminBookingController.getAdminBookingDetail(req, res, () => {});

    assert.strictEqual(renderedView, 'pages/admin/bookings/show');
    assert.strictEqual(renderData.booking.eventName, 'Cultural Gala');
    assert.ok(Array.isArray(renderData.overlappingPending));
  });

  test('postApproveBooking transitions pending to approved and redirects', async () => {
    const booking = await Booking.findOne({ status: 'pending' });

    let flashType = null;
    let flashMsg = null;
    let redirectUrl = null;

    const req = {
      params: { id: booking._id.toString() },
      body: { decisionNote: 'Approved by Dean' },
      flash: (type, msg) => {
        flashType = type;
        flashMsg = msg;
      }
    };
    const res = {
      redirect: (url) => { redirectUrl = url; }
    };

    await adminBookingController.postApproveBooking(req, res, () => {});

    assert.strictEqual(redirectUrl, `/admin/bookings/${booking._id}`);
    assert.strictEqual(flashType, 'success_msg');

    const updated = await Booking.findById(booking._id);
    assert.strictEqual(updated.status, 'approved');
    assert.strictEqual(updated.decisionNote, 'Approved by Dean');
  });

  test('postRejectBooking transitions pending to rejected and redirects', async () => {
    const booking = await Booking.findOne({ status: 'pending' });

    let flashType = null;
    let flashMsg = null;
    let redirectUrl = null;

    const req = {
      params: { id: booking._id.toString() },
      body: { decisionNote: 'Space unavailable' },
      flash: (type, msg) => {
        flashType = type;
        flashMsg = msg;
      }
    };
    const res = {
      redirect: (url) => { redirectUrl = url; }
    };

    await adminBookingController.postRejectBooking(req, res, () => {});

    assert.strictEqual(redirectUrl, `/admin/bookings/${booking._id}`);
    assert.strictEqual(flashType, 'info_msg');

    const updated = await Booking.findById(booking._id);
    assert.strictEqual(updated.status, 'rejected');
    assert.strictEqual(updated.decisionNote, 'Space unavailable');
  });
});
