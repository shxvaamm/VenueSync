const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Detect local system mongod binary if present for instant startup without re-downloading
if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync('/opt/homebrew/bin/mongod')) {
  process.env.MONGOMS_SYSTEM_BINARY = '/opt/homebrew/bin/mongod';
}

let mongoMemoryServer = null;

/**
 * Connect to MongoDB Atlas / URI or provision an In-Memory Database
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const mongoUri = process.env.MONGODB_URI;
  const useMemoryDB = process.env.USE_MEMORY_DB === 'true';

  // Strict check: In-memory DB is strictly disallowed in production
  if (isProduction && !mongoUri) {
    console.error('[Database Fatal] Production mode requires a valid MONGODB_URI. In-memory database cannot be used in production.');
    process.exit(1);
  }

  try {
    if (mongoUri && !useMemoryDB) {
      // Connect to specified URI (e.g. MongoDB Atlas)
      const conn = await mongoose.connect(mongoUri);
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } else {
      // Provision In-Memory MongoDB Server
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();
      
      const conn = await mongoose.connect(memoryUri);
      console.log('Running on IN-MEMORY database. Data resets on restart.');

      // Automatically seed in-memory database
      try {
        const { seedDatabase } = require('../seed/seed');
        if (typeof seedDatabase === 'function') {
          await seedDatabase();
        }
      } catch (seedErr) {
        console.warn('[Database Seed Warning] Automatic in-memory seeding encountered an issue:', seedErr.message);
      }

      return conn;
    }
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Cleanly disconnect Mongoose and shut down in-memory server if active
 */
const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
    }
  } catch (error) {
    console.error('[Database Disconnect Error]:', error.message);
  }
};

// Graceful termination handlers
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB
};
