const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const {
  getAlternativeSlots,
  getAlternativeVenues,
  getBookingSuggestions
} = require('../services/suggestionService');
const { parseISTToUTC, formatISTDateYMD } = require('../services/timeHelper');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Suggestion Service Tests (Alternative Slots & Alternative Venues)', () => {
  let venueMain;
  let venueCompact;
  let venueBudget;
  let venueHuge;
  let organiser;

  // Use a future date for deterministic test execution
  const testDateStr = '2026-12-10';
  const testDay = parseISTToUTC(testDateStr, '00:00');

  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    organiser = await User.create({
      name: 'Faculty User',
      email: 'faculty@campus.edu',
      passwordHash: 'dummy',
      role: 'organiser'
    });

    // Venue Main: capacity 80, rate 600, facilities: projector, AC
    venueMain = await Venue.create({
      name: 'Main Assembly Hall',
      capacity: 80,
      hourlyRate: 600,
      facilities: ['projector', 'AC'],
      isActive: true,
      blockedDates: []
    });

    // Venue Compact: capacity 60, rate 500, facilities: projector, AC
    venueCompact = await Venue.create({
      name: 'Executive Room A',
      capacity: 60,
      hourlyRate: 500,
      facilities: ['projector', 'AC'],
      isActive: true,
      blockedDates: []
    });

    // Venue Budget: capacity 60, rate 300 (cheaper than Compact), facilities: projector, AC
    venueBudget = await Venue.create({
      name: 'Seminar Room B',
      capacity: 60,
      hourlyRate: 300,
      facilities: ['projector', 'AC'],
      isActive: true,
      blockedDates: []
    });

    // Venue Huge: capacity 250, rate 1000, missing 'AC'
    venueHuge = await Venue.create({
      name: 'Grand Amphitheatre',
      capacity: 250,
      hourlyRate: 1000,
      facilities: ['projector', 'sound system'],
      isActive: true,
      blockedDates: []
    });
  });

  // -------------------------------------------------------------
  // 1. Same-Day Free Windows & Closeness Ordering
  // -------------------------------------------------------------
  test('1. Finds free windows on the same day that fit requested duration, ordered by closeness', async () => {
    // Occupy venueMain from 12:00 to 16:00 on testDateStr with an approved booking
    await Booking.create({
      venue: venueMain._id,
      organiser: organiser._id,
      eventName: 'Afternoon Conference',
      attendees: 50,
      start: parseISTToUTC(testDateStr, '12:00'),
      end: parseISTToUTC(testDateStr, '16:00'),
      status: 'approved',
      totalCost: 2400
    });

    // User requested 13:00 to 15:00 (2 hours duration) on the same venue
    const slots = await getAlternativeSlots({
      venueId: venueMain._id,
      dateStr: testDateStr,
      startTimeStr: '13:00',
      endTimeStr: '15:00',
      maxSlots: 5,
      now: new Date('2026-01-01T00:00:00Z')
    });

    assert.ok(slots.length > 0, 'Should return alternative slots');
    assert.ok(slots.length <= 5, 'Should not exceed maxSlots');

    // All suggested slots on the same day must NOT overlap with 12:00 - 16:00
    const sameDaySlots = slots.filter((s) => s.date === testDateStr);
    assert.ok(sameDaySlots.length >= 1, 'Should find free windows on the same day');

    sameDaySlots.forEach((s) => {
      const [startH] = s.startTime.split(':').map(Number);
      const [endH] = s.endTime.split(':').map(Number);

      const overlapsBlocked = startH < 16 && endH > 12;
      assert.strictEqual(
        overlapsBlocked,
        false,
        `Slot ${s.startTime}-${s.endTime} must not overlap with 12:00-16:00`
      );
    });

    // Slots should be sorted by closeness to requested start time (13:00)
    for (let i = 0; i < slots.length - 1; i++) {
      assert.ok(
        slots[i].distanceMs <= slots[i + 1].distanceMs,
        'Slots must be ordered by closeness to requested start time'
      );
    }
  });

  // -------------------------------------------------------------
  // 2. Respecting Operating Hours
  // -------------------------------------------------------------
  test('2. Strictly respects operating hours (08:00 to 22:00 IST)', async () => {
    const slots = await getAlternativeSlots({
      venueId: venueMain._id,
      dateStr: testDateStr,
      startTimeStr: '21:00',
      endTimeStr: '23:00',
      maxSlots: 5,
      now: new Date('2026-01-01T00:00:00Z')
    });

    slots.forEach((s) => {
      const [startH, startM] = s.startTime.split(':').map(Number);
      const [endH, endM] = s.endTime.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      assert.ok(startMinutes >= 8 * 60, `Start time ${s.startTime} must be >= 08:00`);
      assert.ok(endMinutes <= 22 * 60, `End time ${s.endTime} must be <= 22:00`);
    });
  });

  // -------------------------------------------------------------
  // 3. Alternative Venues Ranking
  // -------------------------------------------------------------
  test('3. Ranks alternative venues primarily by closest capacity match, then lowest total cost', async () => {
    // Requested slot: 10:00 to 12:00 (2 hrs)
    // Attendees: 50
    // Required Facilities: ['projector', 'AC']
    const startUTC = parseISTToUTC(testDateStr, '10:00');
    const endUTC = parseISTToUTC(testDateStr, '12:00');

    // Make venueCompact booked at this time so only others are eligible
    await Booking.create({
      venue: venueCompact._id,
      organiser: organiser._id,
      eventName: 'Exclusive Session',
      attendees: 40,
      start: startUTC,
      end: endUTC,
      status: 'approved',
      totalCost: 1000
    });

    const venues = await getAlternativeVenues({
      currentVenueId: venueMain._id,
      start: startUTC,
      end: endUTC,
      attendees: 50,
      requiredFacilities: ['projector', 'AC'],
      maxVenues: 5
    });

    // venueCompact is busy, venueHuge lacks 'AC', venueMain is excluded (currentVenueId)
    // venueBudget has capacity 60 (+10 extra), rate 300, total cost 600, has all facilities
    assert.strictEqual(venues.length, 1);
    assert.strictEqual(venues[0].name, 'Seminar Room B');
    assert.strictEqual(venues[0].capacityDiff, 10);
    assert.strictEqual(venues[0].totalCost, 600);
  });

  test('3b. Ties in closest capacity are broken by lowest total cost', async () => {
    const startUTC = parseISTToUTC(testDateStr, '14:00');
    const endUTC = parseISTToUTC(testDateStr, '16:00'); // 2 hrs

    // Both venueCompact (capacity 60, rate 500, cost 1000) and venueBudget (capacity 60, rate 300, cost 600) are free
    // Attendees: 50
    // Capacity difference for both is 10
    const venues = await getAlternativeVenues({
      currentVenueId: venueMain._id,
      start: startUTC,
      end: endUTC,
      attendees: 50,
      requiredFacilities: ['projector', 'AC']
    });

    assert.ok(venues.length >= 2);
    // venueBudget must come before venueCompact because total cost is lower (600 < 1000)
    assert.strictEqual(venues[0].name, 'Seminar Room B');
    assert.strictEqual(venues[1].name, 'Executive Room A');
    assert.strictEqual(venues[0].totalCost, 600);
    assert.strictEqual(venues[1].totalCost, 1000);
  });

  // -------------------------------------------------------------
  // 4. Case where nothing is available (Returns empty suggestions with hasSuggestions: false)
  // -------------------------------------------------------------
  test('4. Handles case where nothing is available gracefully', async () => {
    // Block venueMain with maintenance spanning the next 3 days
    venueMain.blockedDates.push({
      from: parseISTToUTC(testDateStr, '00:00'),
      to: parseISTToUTC('2026-12-14', '23:59'),
      reason: 'Total renovation'
    });
    await venueMain.save();

    // Ask for 1000 attendees (exceeds all venues)
    const result = await getBookingSuggestions({
      venueId: venueMain._id,
      date: testDateStr,
      startTime: '10:00',
      endTime: '12:00',
      attendees: 1000,
      facilities: ['non-existent-facility']
    });

    assert.strictEqual(result.alternativeSlots.length, 0);
    assert.strictEqual(result.alternativeVenues.length, 0);
    assert.strictEqual(result.hasSuggestions, false);
  });
});
