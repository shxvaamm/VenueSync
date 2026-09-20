const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const {
  getPeriodRange,
  calculateVenueUtilisationAndRevenue,
  getDashboardData
} = require('../services/dashboardService');
const { parseISTToUTC, formatISTDateYMD } = require('../services/timeHelper');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Dashboard Analytics & Utilisation Service Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // -------------------------------------------------------------
  // 1. Period Range Parsing Tests
  // -------------------------------------------------------------
  describe('getPeriodRange() Period Resolution', () => {
    test('resolves "this-week" from Monday 00:00 to Sunday 23:59 IST', () => {
      // Wednesday 2026-09-16
      const refDate = parseISTToUTC('2026-09-16', '12:00');
      const period = getPeriodRange({ period: 'this-week' }, refDate);

      assert.strictEqual(period.type, 'this-week');
      assert.strictEqual(period.startDateStr, '2026-09-14'); // Monday
      assert.strictEqual(period.endDateStr, '2026-09-20'); // Sunday
      assert.ok(period.label.includes('This Week'));
    });

    test('resolves "this-month" from 1st to last day of month in IST', () => {
      // 2026-09-16
      const refDate = parseISTToUTC('2026-09-16', '12:00');
      const period = getPeriodRange({ period: 'this-month' }, refDate);

      assert.strictEqual(period.type, 'this-month');
      assert.strictEqual(period.startDateStr, '2026-09-01');
      assert.strictEqual(period.endDateStr, '2026-09-30');
      assert.ok(period.label.includes('September 2026'));
    });

    test('resolves "custom" date range when provided', () => {
      const period = getPeriodRange({
        period: 'custom',
        startDate: '2026-10-05',
        endDate: '2026-10-12'
      });

      assert.strictEqual(period.type, 'custom');
      assert.strictEqual(period.startDateStr, '2026-10-05');
      assert.strictEqual(period.endDateStr, '2026-10-12');
      assert.ok(period.label.includes('Custom Period'));
    });
  });

  // -------------------------------------------------------------
  // 2. Hand-Checked Utilisation & Revenue Mathematical Calculations
  // -------------------------------------------------------------
  describe('calculateVenueUtilisationAndRevenue() Hand-Checked Unit Calculations', () => {
    test('Hand-Checked Example 1: Standard Single Day (14 hrs operating, 4 hrs booked @ 1000/hr = 28.6% & 4000)', () => {
      const venueId = new mongoose.Types.ObjectId();
      const venues = [
        {
          _id: venueId,
          name: 'Main Hall',
          capacity: 200,
          hourlyRate: 1000,
          isActive: true,
          blockedDates: []
        }
      ];

      const periodStart = parseISTToUTC('2026-09-20', '00:00');
      const periodEnd = parseISTToUTC('2026-09-20', '23:59');

      // 4 hours booking: 10:00 to 14:00 IST
      const bookings = [
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '10:00'),
          end: parseISTToUTC('2026-09-20', '14:00'),
          status: 'approved',
          totalCost: 4000
        }
      ];

      const result = calculateVenueUtilisationAndRevenue({
        venues,
        bookings,
        periodStart,
        periodEnd
      });

      const metric = result.venueMetrics[0];

      // Hand-checked verification:
      // Available operating hours: 1 day * 14 hrs = 14 hrs
      assert.strictEqual(metric.availableOperatingHours, 14);
      // Booked hours: 4.0 hrs
      assert.strictEqual(metric.bookedHours, 4.0);
      // Utilisation: (4.0 / 14.0) * 100 = 28.5714... -> 28.6%
      assert.strictEqual(metric.utilisationPercent, 28.6);
      // Revenue: 4.0 * 1000 = ₹4,000
      assert.strictEqual(metric.revenue, 4000);
    });

    test('Hand-Checked Example 2: Maintenance Day Exclusion (3 days total, 1 maintenance day = 2 active days = 28 hrs available)', () => {
      const venueId = new mongoose.Types.ObjectId();
      const venues = [
        {
          _id: venueId,
          name: 'Seminar Hall',
          capacity: 100,
          hourlyRate: 500,
          isActive: true,
          blockedDates: [
            {
              // Maintenance on Day 2 during operational hours
              from: parseISTToUTC('2026-09-21', '09:00'),
              to: parseISTToUTC('2026-09-21', '17:00'),
              reason: 'Electrical cabling overhaul'
            }
          ]
        }
      ];

      // Period: 3 days (2026-09-20 to 2026-09-22)
      const periodStart = parseISTToUTC('2026-09-20', '00:00');
      const periodEnd = parseISTToUTC('2026-09-22', '23:59');

      const bookings = [
        // Day 1: 3 hours (completed)
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '14:00'),
          end: parseISTToUTC('2026-09-20', '17:00'),
          status: 'completed',
          totalCost: 1500
        },
        // Day 3: 4 hours (approved)
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-22', '10:00'),
          end: parseISTToUTC('2026-09-22', '14:00'),
          status: 'approved',
          totalCost: 2000
        }
      ];

      const result = calculateVenueUtilisationAndRevenue({
        venues,
        bookings,
        periodStart,
        periodEnd
      });

      const metric = result.venueMetrics[0];

      // Hand-checked verification:
      // Total days: 3
      assert.strictEqual(metric.totalDays, 3);
      // Maintenance days: 1
      assert.strictEqual(metric.maintenanceDays, 1);
      // Active operating days: 3 - 1 = 2 days
      assert.strictEqual(metric.activeOperatingDays, 2);
      // Available operating hours: 2 * 14 = 28 hrs
      assert.strictEqual(metric.availableOperatingHours, 28);
      // Booked hours: 3 + 4 = 7.0 hrs
      assert.strictEqual(metric.bookedHours, 7.0);
      // Utilisation: (7.0 / 28.0) * 100 = 25.0%
      assert.strictEqual(metric.utilisationPercent, 25.0);
      // Revenue: 7.0 * 500 = ₹3,500
      assert.strictEqual(metric.revenue, 3500);
    });

    test('Hand-Checked Example 3: Clamping bookings to period boundaries', () => {
      const venueId = new mongoose.Types.ObjectId();
      const venues = [
        {
          _id: venueId,
          name: 'Conference Lab',
          capacity: 50,
          hourlyRate: 800,
          isActive: true,
          blockedDates: []
        }
      ];

      // Period: 12:00 to 18:00 (6 hrs duration)
      const periodStart = parseISTToUTC('2026-09-20', '12:00');
      const periodEnd = parseISTToUTC('2026-09-20', '18:00');

      // Booking nominally spans 10:00 to 16:00 (6 hours)
      // Clamped in period: 12:00 to 16:00 = exactly 4 hours
      const bookings = [
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '10:00'),
          end: parseISTToUTC('2026-09-20', '16:00'),
          status: 'approved',
          totalCost: 4800
        }
      ];

      const result = calculateVenueUtilisationAndRevenue({
        venues,
        bookings,
        periodStart,
        periodEnd
      });

      const metric = result.venueMetrics[0];

      // Clamped booked hours: 4.0 hrs
      assert.strictEqual(metric.bookedHours, 4.0);
      // Revenue for clamped portion: 4.0 * 800 = ₹3,200
      assert.strictEqual(metric.revenue, 3200);
    });

    test('Hand-Checked Example 4: Status Filtering (Only approved & completed count; pending, rejected, cancelled ignored)', () => {
      const venueId = new mongoose.Types.ObjectId();
      const venues = [
        {
          _id: venueId,
          name: 'Community Hall',
          capacity: 150,
          hourlyRate: 400,
          isActive: true,
          blockedDates: []
        }
      ];

      const periodStart = parseISTToUTC('2026-09-20', '00:00');
      const periodEnd = parseISTToUTC('2026-09-20', '23:59');

      const bookings = [
        // 1. Approved: 3 hrs -> COUNTS
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '08:00'),
          end: parseISTToUTC('2026-09-20', '11:00'),
          status: 'approved',
          totalCost: 1200
        },
        // 2. Completed: 2 hrs -> COUNTS
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '11:00'),
          end: parseISTToUTC('2026-09-20', '13:00'),
          status: 'completed',
          totalCost: 800
        },
        // 3. Pending: 4 hrs -> IGNORED
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '13:00'),
          end: parseISTToUTC('2026-09-20', '17:00'),
          status: 'pending',
          totalCost: 1600
        },
        // 4. Rejected: 2 hrs -> IGNORED
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '17:00'),
          end: parseISTToUTC('2026-09-20', '19:00'),
          status: 'rejected',
          totalCost: 800
        },
        // 5. Cancelled: 3 hrs -> IGNORED
        {
          venue: venueId,
          start: parseISTToUTC('2026-09-20', '19:00'),
          end: parseISTToUTC('2026-09-20', '22:00'),
          status: 'cancelled',
          totalCost: 1200
        }
      ];

      const result = calculateVenueUtilisationAndRevenue({
        venues,
        bookings,
        periodStart,
        periodEnd
      });

      const metric = result.venueMetrics[0];

      // Hand-checked: Only approved (3 hrs) + completed (2 hrs) = 5.0 hrs
      assert.strictEqual(metric.bookedHours, 5.0);
      // Revenue: (3 + 2) * 400 = ₹2,000
      assert.strictEqual(metric.revenue, 2000);
      // Utilisation: (5.0 / 14.0) * 100 = 35.714... -> 35.7%
      assert.strictEqual(metric.utilisationPercent, 35.7);
    });
  });

  // -------------------------------------------------------------
  // 3. End-to-End getDashboardData() Integration Test
  // -------------------------------------------------------------
  describe('getDashboardData() Integration', () => {
    test('fetches today approved events, upcoming 7-day events, pending count, and period metrics', async () => {
      const organiser = await User.create({
        name: 'Demo Organiser',
        email: 'demo@campus.edu',
        passwordHash: 'dummy',
        role: 'organiser'
      });

      const venue = await Venue.create({
        name: 'Open Auditorium',
        capacity: 300,
        hourlyRate: 600,
        isActive: true
      });

      const now = new Date();
      const todayYMD = formatISTDateYMD(now);

      // Today's event (approved)
      await Booking.create({
        venue: venue._id,
        organiser: organiser._id,
        eventName: 'Today Keynote',
        attendees: 100,
        start: parseISTToUTC(todayYMD, '10:00'),
        end: parseISTToUTC(todayYMD, '13:00'),
        status: 'approved',
        totalCost: 1800
      });

      // Pending event (should increment pendingCount)
      await Booking.create({
        venue: venue._id,
        organiser: organiser._id,
        eventName: 'Pending Proposal',
        attendees: 50,
        start: parseISTToUTC(todayYMD, '15:00'),
        end: parseISTToUTC(todayYMD, '18:00'),
        status: 'pending',
        totalCost: 1800
      });

      const data = await getDashboardData({ period: 'this-week' }, now);

      assert.strictEqual(data.pendingCount, 1);
      assert.ok(data.todayEvents.length >= 1);
      assert.strictEqual(data.todayEvents[0].eventName, 'Today Keynote');
      assert.ok(data.venueMetrics.length >= 1);
      assert.ok(data.totals.totalRevenue >= 1800);
    });
  });
});
