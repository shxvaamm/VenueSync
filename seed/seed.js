// Database Seed Script (Idempotent)

const seedDatabase = async () => {
  console.log('Seeding...');
  // Later phases will add idempotent venue models and admin credentials here
  return;
};

// If run directly via CLI (e.g. npm run seed)
if (require.main === module) {
  require('dotenv').config();
  const { connectDB, disconnectDB } = require('../config/db');

  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      console.log('Database seeding completed.');
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('Database seeding failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedDatabase
};
