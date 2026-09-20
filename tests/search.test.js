const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const Venue = require('../models/Venue');
const { searchVenues } = require('../services/venueSearchService');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('Venue Search & Filtering Service Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Populate test venues
    await Venue.create([
      {
        name: 'Grand Auditorium',
        capacity: 500,
        facilities: ['projector', 'sound system', 'AC', 'stage', 'WiFi'],
        hourlyRate: 1000,
        isActive: true
      },
      {
        name: 'Mini Seminar Room',
        capacity: 50,
        facilities: ['projector', 'whiteboard', 'WiFi'],
        hourlyRate: 300,
        isActive: true
      },
      {
        name: 'Open Air Grounds',
        capacity: 1000,
        facilities: ['sound system', 'stage', 'parking'],
        hourlyRate: 600,
        isActive: true
      },
      {
        name: 'Under Renovation Hall',
        capacity: 200,
        facilities: ['projector', 'AC'],
        hourlyRate: 400,
        isActive: false // Inactive venue
      }
    ]);
  });

  test('should exclude inactive venues by default', async () => {
    const results = await searchVenues({});
    const names = results.map(v => v.name);
    assert.strictEqual(results.length, 3);
    assert.ok(!names.includes('Under Renovation Hall'), 'Inactive venues must never appear');
  });

  test('should filter by minimum capacity', async () => {
    const results = await searchVenues({ minCapacity: 200 });
    const names = results.map(v => v.name);
    assert.strictEqual(results.length, 2);
    assert.ok(names.includes('Grand Auditorium'));
    assert.ok(names.includes('Open Air Grounds'));
    assert.ok(!names.includes('Mini Seminar Room'));
  });

  test('should filter by maximum hourly rate', async () => {
    const results = await searchVenues({ maxRate: 600 });
    const names = results.map(v => v.name);
    assert.strictEqual(results.length, 2);
    assert.ok(names.includes('Mini Seminar Room'));
    assert.ok(names.includes('Open Air Grounds'));
    assert.ok(!names.includes('Grand Auditorium'));
  });

  test('should enforce multi-facility "has all" filter logic ($all)', async () => {
    // Both 'stage' and 'sound system'
    const results = await searchVenues({ facilities: ['stage', 'sound system'] });
    const names = results.map(v => v.name);
    assert.strictEqual(results.length, 2);
    assert.ok(names.includes('Grand Auditorium'));
    assert.ok(names.includes('Open Air Grounds'));

    // 'stage', 'sound system', and 'WiFi' (Only Grand Auditorium has all 3)
    const strictResults = await searchVenues({ facilities: ['stage', 'sound system', 'WiFi'] });
    assert.strictEqual(strictResults.length, 1);
    assert.strictEqual(strictResults[0].name, 'Grand Auditorium');
  });

  test('should correctly sort results by price and capacity', async () => {
    const priceAsc = await searchVenues({ sort: 'price_asc' });
    assert.strictEqual(priceAsc[0].name, 'Mini Seminar Room'); // 300
    assert.strictEqual(priceAsc[2].name, 'Grand Auditorium');  // 1000

    const capacityDesc = await searchVenues({ sort: 'capacity_desc' });
    assert.strictEqual(capacityDesc[0].name, 'Open Air Grounds'); // 1000
    assert.strictEqual(capacityDesc[2].name, 'Mini Seminar Room');  // 50
  });
});
