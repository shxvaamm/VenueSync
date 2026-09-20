const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync('/opt/homebrew/bin/mongod')) {
  process.env.MONGOMS_SYSTEM_BINARY = '/opt/homebrew/bin/mongod';
}

let mongoServer;

/**
 * Connect to a newly provisioned in-memory database for testing
 */
const connectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return { mongoServer, uri };
};

/**
 * Clear all documents across all collections between tests
 */
const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

/**
 * Disconnect mongoose and terminate the in-memory server
 */
const disconnectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = {
  connectTestDB,
  clearTestDB,
  disconnectTestDB
};
