const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

describe('In-Memory Database Helper Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test('should successfully connect to in-memory database and persist/retrieve records', async () => {
    assert.strictEqual(mongoose.connection.readyState, 1, 'Mongoose should be connected to in-memory database');

    const TestSchema = new mongoose.Schema({ title: String, capacity: Number });
    const TestVenue = mongoose.models.TestVenue || mongoose.model('TestVenue', TestSchema);

    const venue = await TestVenue.create({ title: 'Tagore Memorial Auditorium', capacity: 500 });
    assert.strictEqual(venue.title, 'Tagore Memorial Auditorium');
    assert.strictEqual(venue.capacity, 500);

    const found = await TestVenue.findOne({ title: 'Tagore Memorial Auditorium' });
    assert.ok(found, 'Record should be retrieved from in-memory database');
    assert.strictEqual(found.capacity, 500);
  });
});
