const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { checkSlotAvailability } = require('../services/availabilityService');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Slot Availability & Overlap Conflict Service Tests', () => {
  let venueA;
  let venueB;
  let organiser;

  // Base slot: 10:00 to 14:00 on Day X
  const baseDay = new Date('2026-11-15T00:00:00.000Z');
  const t = (hours) => new Date(baseDay.getTime() + hours * 3600000);

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create Test Organiser
    organiser = await User.create({
      name: 'Test Organiser',
      email: 'tester@campus.edu',
      passwordHash: 'dummyhash',
      role: 'organiser'
    });

    // Create Venues
    venueA = await Venue.create({
      name: 'Hall Alpha',
      capacity: 100,
      hourlyRate: 500,
      isActive: true,
      blockedDates: [
        {
          from: t(20), // 20:00 to 22:00 maintenance
          to: t(22),
          reason: 'Stage lighting repairs'
        }
      ]
    });

    venueB = await Venue.create({
      name: 'Hall Beta',
      capacity: 80,
      hourlyRate: 300,
      isActive: true
    });

    // Seed an APPROVED booking on Venue A from 10:00 to 14:00
    await Booking.create({
      venue: venueA._id,
      organiser: organiser._id,
      eventName: 'Robotics Workshop',
      attendees: 50,
      start: t(10),
      end: t(14),
      status: 'approved',
      totalCost: 2000
    });

    // Seed a PENDING booking on Venue A from 16:00 to 18:00
    await Booking.create({
      venue: venueA._id,
      organiser: organiser._id,
      eventName: 'Pending Coding Meetup',
      attendees: 30,
      start: t(16),
      end: t(18),
      status: 'pending',
      totalCost: 1000
    });
  });

  test('1. Exact overlap should be rejected', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(10),
      end: t(14)
    });
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.conflictType, 'booking');
  });

  test('2. Partial overlap at start (starts before, ends inside) should be rejected', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(9),
      end: t(11) // overlaps 10:00 to 11:00
    });
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.conflictType, 'booking');
  });

  test('3. Partial overlap at end (starts inside, ends after) should be rejected', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(13),
      end: t(15) // overlaps 13:00 to 14:00
    });
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.conflictType, 'booking');
  });

  test('4. Fully contained slot inside existing booking should be rejected', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(11),
      end: t(13) // entirely within 10:00 to 14:00
    });
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.conflictType, 'booking');
  });

  test('5. Back-to-back slots (end === existing.start AND start === existing.end) must be ALLOWED', async () => {
    // Before existing: 08:00 to 10:00 (ends right when existing starts at 10:00)
    const beforeRes = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(8),
      end: t(10)
    });
    assert.strictEqual(beforeRes.available, true, 'Slot ending at start of existing must be allowed');

    // After existing: 14:00 to 16:00 (starts right when existing ends at 14:00)
    const afterRes = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(14),
      end: t(16)
    });
    assert.strictEqual(afterRes.available, true, 'Slot starting at end of existing must be allowed');
  });

  test('6. Overlapping time on a different venue must be ALLOWED', async () => {
    const res = await checkSlotAvailability({
      venueId: venueB._id, // Venue B is free
      start: t(10),
      end: t(14)
    });
    assert.strictEqual(res.available, true, 'Different venue at same time must be available');
  });

  test('7. Maintenance block conflict should be rejected', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(19),
      end: t(21) // overlaps maintenance at 20:00 - 22:00
    });
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.conflictType, 'maintenance');
    assert.ok(res.message.includes('maintenance'));
  });

  test('8. Pending bookings must NOT block a slot (only approved bookings block)', async () => {
    const res = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(16),
      end: t(18) // Pending booking exists here, but it's not approved yet
    });
    assert.strictEqual(res.available, true, 'Pending bookings should not block slot');
  });

  test('9. excludeBookingId must ignore that booking when checking conflict', async () => {
    const existingApproved = await Booking.findOne({ status: 'approved' });

    // Without excludeBookingId: conflicts
    const withConflict = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(10),
      end: t(14)
    });
    assert.strictEqual(withConflict.available, false);

    // With excludeBookingId: ignores self
    const withoutConflict = await checkSlotAvailability({
      venueId: venueA._id,
      start: t(10),
      end: t(14),
      excludeBookingId: existingApproved._id
    });
    assert.strictEqual(withoutConflict.available, true, 'Should be available when self-booking is excluded');
  });
});
