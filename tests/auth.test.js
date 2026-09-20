const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const User = require('../models/User');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');
const { requireLogin, requireRole, requireGuest } = require('../middleware/auth');

describe('Authentication, User Model & Authorization Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test('should create user with hashed password and compare passwords correctly', async () => {
    const passwordHash = await User.hashPassword('MySecretPass@123');
    const user = await User.create({
      name: 'Priya Patel',
      email: 'priya@campus.edu',
      passwordHash,
      role: 'organiser'
    });

    assert.strictEqual(user.name, 'Priya Patel');
    assert.strictEqual(user.email, 'priya@campus.edu');
    assert.strictEqual(user.role, 'organiser');

    const validMatch = await user.comparePassword('MySecretPass@123');
    assert.strictEqual(validMatch, true, 'Correct password should match');

    const invalidMatch = await user.comparePassword('WrongPassword');
    assert.strictEqual(invalidMatch, false, 'Wrong password should not match');
  });

  test('should enforce unique email constraint on User model', async () => {
    const passwordHash = await User.hashPassword('Password@123');
    await User.create({
      name: 'First User',
      email: 'duplicate@campus.edu',
      passwordHash,
      role: 'organiser'
    });

    await assert.rejects(
      async () => {
        await User.create({
          name: 'Second User',
          email: 'duplicate@campus.edu',
          passwordHash,
          role: 'organiser'
        });
      },
      /E11000|duplicate key/
    );
  });

  test('requireLogin middleware should redirect unauthenticated guests to /auth/login', () => {
    let redirectedUrl = null;
    const req = {
      session: {},
      flash: (type, msg) => {}
    };
    const res = {
      redirect: (url) => { redirectedUrl = url; }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireLogin(req, res, next);
    assert.strictEqual(redirectedUrl, '/auth/login');
    assert.strictEqual(nextCalled, false);
  });

  test('requireLogin middleware should proceed for logged in users', () => {
    const req = {
      session: { currentUser: { id: '123', role: 'organiser' } }
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireLogin(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  test('requireRole should return 403 when an organiser tries to access an admin route', () => {
    let statusCode = null;
    let renderedView = null;
    const req = {
      session: { currentUser: { id: 'org-1', role: 'organiser' } }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          render: (view, data) => { renderedView = view; }
        };
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const adminGuard = requireRole('admin');
    adminGuard(req, res, next);

    assert.strictEqual(statusCode, 403, 'Should respond with HTTP 403 Forbidden');
    assert.strictEqual(renderedView, 'errors/403', 'Should render 403 error page');
    assert.strictEqual(nextCalled, false);
  });

  test('requireRole should permit user when roles match', () => {
    const req = {
      session: { currentUser: { id: 'admin-1', role: 'admin' } }
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const adminGuard = requireRole('admin');
    adminGuard(req, res, next);

    assert.strictEqual(nextCalled, true, 'Admin should be allowed through');
  });

  test('requireGuest should redirect authenticated users away from guest pages', () => {
    let redirectedUrl = null;
    const req = {
      session: { currentUser: { id: 'org-1', role: 'organiser' } }
    };
    const res = {
      redirect: (url) => { redirectedUrl = url; }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireGuest(req, res, next);
    assert.strictEqual(redirectedUrl, '/venues');
    assert.strictEqual(nextCalled, false);
  });
});
