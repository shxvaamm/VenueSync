const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const {
  validateStatusTransition,
  approveBooking,
  rejectBooking,
  completeBooking,
  cancelBookingByAdmin
} = require('../services/bookingTransitionService');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Booking Status Transitions & Concurrency Service Tests', () => {
  let venueMain;
  let venueSecondary;
  let organiserA;
  let organiserB;

  // Base timestamp reference
  const baseDay = new Date('2026-11-20T00:00:00.000Z');
  const t = (hours) => new Date(baseDay.getTime() + hours * 3600000);

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create Organisers
    organiserA = await User.create({
      name: 'Organiser Alice',
      email: 'alice@campus.edu',
      passwordHash: 'dummyhash1',
      role: 'organiser'
    });

    organiserB = await User.create({
      name: 'Organiser Bob',
      email: 'bob@campus.edu',
      passwordHash: 'dummyhash2',
      role: 'organiser'
    });

    // Create Venues
    venueMain = await Venue.create({
      name: 'Auditorium Main',
      capacity: 300,
      hourlyRate: 1000,
      isActive: true,
      blockedDates: [
        {
          from: t(20),
          to: t(22),
          reason: 'A/V System Firmware Upgrade'
        }
      ]
    });

    venueSecondary = await Venue.create({
      name: 'Seminar Hall B',
      capacity: 60,
      hourlyRate: 400,
      isActive: true
    });
  });

  // -------------------------------------------------------------
  // 1. Unit Status Transition Rules Validation
  // -------------------------------------------------------------
  describe('validateStatusTransition() Rule Enforcement', () => {
    const pastEnd = new Date(Date.now() - 3600000); // 1 hr ago
    const futureEnd = new Date(Date.now() + 3600000); // 1 hr in future

    test('Valid: pending -> approved', () => {
      const res = validateStatusTransition('pending', 'approved', { endTime: futureEnd });
      assert.strictEqual(res.valid, true);
    });

    test('Valid: pending -> rejected', () => {
      const res = validateStatusTransition('pending', 'rejected', { endTime: futureEnd });
      assert.strictEqual(res.valid, true);
    });

    test('Valid: pending -> cancelled', () => {
      const res = validateStatusTransition('pending', 'cancelled', { endTime: futureEnd });
      assert.strictEqual(res.valid, true);
    });

    test('Valid: approved -> completed (when event end time has passed)', () => {
      const res = validateStatusTransition('approved', 'completed', {
        endTime: pastEnd,
        now: new Date()
      });
      assert.strictEqual(res.valid, true);
    });

    test('Valid: approved -> cancelled', () => {
      const res = validateStatusTransition('approved', 'cancelled', { endTime: futureEnd });
      assert.strictEqual(res.valid, true);
    });

    test('Invalid: pending -> completed (must be refused)', () => {
      const res = validateStatusTransition('pending', 'completed', { endTime: pastEnd });
      assert.strictEqual(res.valid, false);
      assert.ok(res.message.includes('Invalid state transition'));
    });

    test('Invalid: approved -> pending (must be refused)', () => {
      const res = validateStatusTransition('approved', 'pending', { endTime: futureEnd });
      assert.strictEqual(res.valid, false);
      assert.ok(res.message.includes('Invalid state transition'));
    });

    test('Invalid: approved -> rejected (must be refused, only completed or cancelled allowed)', () => {
      const res = validateStatusTransition('approved', 'rejected', { endTime: futureEnd });
      assert.strictEqual(res.valid, false);
      assert.ok(res.message.includes('Invalid state transition'));
    });

    test('Invalid: approved -> completed BEFORE event end time has elapsed (must be refused)', () => {
      const res = validateStatusTransition('approved', 'completed', {
        endTime: futureEnd,
        now: new Date()
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.message.includes('before its scheduled end time has passed'));
    });

    test('Invalid: rejected is final state (cannot transition to approved, pending, completed, cancelled)', () => {
      const targetStates = ['approved', 'pending', 'completed', 'cancelled'];
      for (const target of targetStates) {
        const res = validateStatusTransition('rejected', target, { endTime: pastEnd });
        assert.strictEqual(res.valid, false);
        assert.ok(res.message.includes('Final states'));
      }
    });

    test('Invalid: completed is final state (cannot transition to cancelled, approved, pending)', () => {
      const targetStates = ['cancelled', 'approved', 'pending'];
      for (const target of targetStates) {
        const res = validateStatusTransition('completed', target, { endTime: pastEnd });
        assert.strictEqual(res.valid, false);
        assert.ok(res.message.includes('Final states'));
      }
    });

    test('Invalid: cancelled is final state (cannot transition to approved, pending, completed)', () => {
      const targetStates = ['approved', 'pending', 'completed'];
      for (const target of targetStates) {
        const res = validateStatusTransition('cancelled', target, { endTime: pastEnd });
        assert.strictEqual(res.valid, false);
        assert.ok(res.message.includes('Final states'));
      }
    });
  });

  // -------------------------------------------------------------
  // 2. Lifecycle Service Methods Execution
  // -------------------------------------------------------------
  describe('Booking Lifecycle Actions Execution', () => {
    test('Approve a pending booking with optional note', async () => {
      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'AI Seminar',
        attendees: 100,
        start: t(10),
        end: t(13),
        status: 'pending',
        totalCost: 3000
      });

      const res = await approveBooking(booking._id, 'Confirmed for Department of CS');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.booking.status, 'approved');
      assert.strictEqual(res.booking.decisionNote, 'Confirmed for Department of CS');

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'approved');
    });

    test('Reject a pending booking with optional note', async () => {
      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Flash Mob',
        attendees: 50,
        start: t(14),
        end: t(16),
        status: 'pending',
        totalCost: 2000
      });

      const res = await rejectBooking(booking._id, 'Not approved for indoor halls');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.booking.status, 'rejected');
      assert.strictEqual(res.booking.decisionNote, 'Not approved for indoor halls');

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'rejected');

      // Attempting to approve a rejected booking must fail
      const approveAttempt = await approveBooking(booking._id);
      assert.strictEqual(approveAttempt.success, false);
      assert.ok(approveAttempt.message.includes('Final states'));
    });

    test('Complete an approved booking after end time has passed', async () => {
      // Create past booking
      const pastStart = new Date(Date.now() - 7200000); // 2 hrs ago
      const pastEnd = new Date(Date.now() - 3600000); // 1 hr ago

      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Morning Hack Session',
        attendees: 40,
        start: pastStart,
        end: pastEnd,
        status: 'approved',
        totalCost: 1000
      });

      const res = await completeBooking(booking._id, 'Event concluded successfully');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.booking.status, 'completed');
      assert.strictEqual(res.booking.decisionNote, 'Event concluded successfully');

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'completed');
    });

    test('Refuse to complete an approved booking before end time', async () => {
      // Future event
      const futureStart = new Date(Date.now() + 3600000);
      const futureEnd = new Date(Date.now() + 7200000);

      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Future Symposium',
        attendees: 120,
        start: futureStart,
        end: futureEnd,
        status: 'approved',
        totalCost: 4000
      });

      const res = await completeBooking(booking._id);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes('before its scheduled end time has passed'));

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'approved');
    });

    test('Cancel an approved booking by admin', async () => {
      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Book Club',
        attendees: 20,
        start: t(10),
        end: t(12),
        status: 'approved',
        totalCost: 2000
      });

      const res = await cancelBookingByAdmin(booking._id, 'Emergency hall repairs required');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.booking.status, 'cancelled');
      assert.strictEqual(res.booking.decisionNote, 'Emergency hall repairs required');

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'cancelled');

      // Attempting to approve a cancelled booking must fail
      const approveAttempt = await approveBooking(booking._id);
      assert.strictEqual(approveAttempt.success, false);
      assert.ok(approveAttempt.message.includes('Final states'));
    });
  });

  // -------------------------------------------------------------
  // 3. Approval Re-check & Overlapping Pending Requests Detection
  // -------------------------------------------------------------
  describe('Approval Re-check & Clashing Pending Detection', () => {
    test('Approving request A flags overlapping pending request B, and approving B subsequently fails', async () => {
      // Request A: 10:00 to 14:00 on Main Hall
      const bookingA = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'DevFest 2026',
        attendees: 150,
        start: t(10),
        end: t(14),
        status: 'pending',
        totalCost: 4000
      });

      // Request B: 12:00 to 16:00 on Main Hall (Overlaps A between 12:00 and 14:00)
      const bookingB = await Booking.create({
        venue: venueMain._id,
        organiser: organiserB._id,
        eventName: 'Designers Meetup',
        attendees: 80,
        start: t(12),
        end: t(16),
        status: 'pending',
        totalCost: 4000
      });

      // 1. Approve Request A
      const approveAResult = await approveBooking(bookingA._id, 'Approved for campus tech fest');
      assert.strictEqual(approveAResult.success, true);
      assert.strictEqual(approveAResult.booking.status, 'approved');

      // Check that B is detected and returned in conflictingPending array
      assert.ok(approveAResult.conflictingPending);
      assert.strictEqual(approveAResult.conflictingPending.length, 1);
      assert.strictEqual(approveAResult.conflictingPending[0]._id.toString(), bookingB._id.toString());

      // 2. Now attempt to approve Request B
      const approveBResult = await approveBooking(bookingB._id, 'Approved');
      assert.strictEqual(approveBResult.success, false);
      assert.ok(approveBResult.message.includes('Approval refused'));
      assert.ok(approveBResult.message.includes('Conflict detected') && approveBResult.message.includes('DevFest 2026'));

      // Verify B remains pending
      const reloadedB = await Booking.findById(bookingB._id);
      assert.strictEqual(reloadedB.status, 'pending');

      // Admin can now reject B with explanation
      const rejectBResult = await rejectBooking(bookingB._id, 'Rejected due to conflict with DevFest 2026');
      assert.strictEqual(rejectBResult.success, true);
      assert.strictEqual(rejectBResult.booking.status, 'rejected');
    });

    test('Non-overlapping requests on the same venue both succeed', async () => {
      // Request A: 10:00 to 12:00
      const bookingA = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Morning Talk',
        attendees: 50,
        start: t(10),
        end: t(12),
        status: 'pending',
        totalCost: 2000
      });

      // Request B: 12:00 to 14:00 (Back-to-back, starts right when A ends)
      const bookingB = await Booking.create({
        venue: venueMain._id,
        organiser: organiserB._id,
        eventName: 'Afternoon Workshop',
        attendees: 50,
        start: t(12),
        end: t(14),
        status: 'pending',
        totalCost: 2000
      });

      const resA = await approveBooking(bookingA._id);
      assert.strictEqual(resA.success, true);
      assert.strictEqual(resA.conflictingPending.length, 0);

      const resB = await approveBooking(bookingB._id);
      assert.strictEqual(resB.success, true);
      assert.strictEqual(resB.conflictingPending.length, 0);
    });

    test('Overlapping requests on different venues both succeed', async () => {
      // Request A on venueMain: 10:00 to 14:00
      const bookingA = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Main Event',
        attendees: 100,
        start: t(10),
        end: t(14),
        status: 'pending',
        totalCost: 4000
      });

      // Request B on venueSecondary: 10:00 to 14:00 (Same time, different venue)
      const bookingB = await Booking.create({
        venue: venueSecondary._id,
        organiser: organiserB._id,
        eventName: 'Secondary Event',
        attendees: 30,
        start: t(10),
        end: t(14),
        status: 'pending',
        totalCost: 1600
      });

      const resA = await approveBooking(bookingA._id);
      assert.strictEqual(resA.success, true);

      const resB = await approveBooking(bookingB._id);
      assert.strictEqual(resB.success, true);
    });

    test('Approval is refused if slot clashes with a maintenance block', async () => {
      // Maintenance block is at 20:00 - 22:00 on venueMain
      const booking = await Booking.create({
        venue: venueMain._id,
        organiser: organiserA._id,
        eventName: 'Late Night Rehearsal',
        attendees: 30,
        start: t(19),
        end: t(21), // Overlaps maintenance at 20:00
        status: 'pending',
        totalCost: 2000
      });

      const res = await approveBooking(booking._id);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes('maintenance'));

      const reloaded = await Booking.findById(booking._id);
      assert.strictEqual(reloaded.status, 'pending');
    });
  });
});
