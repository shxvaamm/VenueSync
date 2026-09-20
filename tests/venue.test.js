const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const Venue = require('../models/Venue');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Venue Model & Maintenance Block Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test('should create valid venue with facilities and default active status', async () => {
    const venue = await Venue.create({
      name: 'Dr. C.V. Raman Auditorium',
      capacity: 350,
      facilities: ['projector', 'sound system', 'AC'],
      hourlyRate: 750,
      description: 'Air conditioned hall for lectures.'
    });

    assert.strictEqual(venue.name, 'Dr. C.V. Raman Auditorium');
    assert.strictEqual(venue.capacity, 350);
    assert.strictEqual(venue.isActive, true, 'Default isActive should be true');
    assert.strictEqual(venue.facilities.length, 3);
  });

  test('should reject invalid venue parameters (negative rate, zero capacity)', async () => {
    await assert.rejects(
      async () => {
        await Venue.create({
          name: 'Invalid Venue',
          capacity: 0,
          hourlyRate: -100
        });
      },
      /Capacity must be at least 1 person/
    );
  });

  test('should reject duplicate venue names', async () => {
    await Venue.create({
      name: 'Main Conference Hall',
      capacity: 50,
      hourlyRate: 200
    });

    await assert.rejects(
      async () => {
        await Venue.create({
          name: 'Main Conference Hall',
          capacity: 80,
          hourlyRate: 300
        });
      },
      /E11000|duplicate key/
    );
  });

  test('should store and query maintenance blocks within venue', async () => {
    const fromDate = new Date(Date.now() + 86400000);
    const toDate = new Date(Date.now() + 86400000 + 4 * 3600000);

    const venue = await Venue.create({
      name: 'Mechanical Workshop Hall',
      capacity: 100,
      hourlyRate: 400,
      blockedDates: [
        {
          from: fromDate,
          to: toDate,
          reason: 'Electrical cabling installation'
        }
      ]
    });

    assert.strictEqual(venue.blockedDates.length, 1);
    assert.strictEqual(venue.blockedDates[0].reason, 'Electrical cabling installation');
    assert.strictEqual(venue.blockedDates[0].from.getTime(), fromDate.getTime());
    assert.strictEqual(venue.blockedDates[0].to.getTime(), toDate.getTime());
  });
});
