const User = require('../models/User');
const Venue = require('../models/Venue');

/**
 * Idempotent Database Seeder for Users and Venues
 */
const seedDatabase = async () => {
  console.log('Seeding...');

  // 1. Seed Admin User
  const adminEmail = 'admin@venue.test';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const adminPasswordHash = await User.hashPassword('Admin@123');
    await User.create({
      name: 'Campus Venue Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'admin'
    });
    console.log(`[Seed] Created default Admin: ${adminEmail}`);
  }

  // 2. Seed Organiser Users
  const organisers = [
    { name: 'Student Council Organiser', email: 'organiser1@venue.test', password: 'Org@12345' },
    { name: 'Cultural Society Organiser', email: 'organiser2@venue.test', password: 'Org@12345' }
  ];

  for (const org of organisers) {
    const existingOrg = await User.findOne({ email: org.email });
    if (!existingOrg) {
      const orgHash = await User.hashPassword(org.password);
      await User.create({
        name: org.name,
        email: org.email,
        passwordHash: orgHash,
        role: 'organiser'
      });
      console.log(`[Seed] Created default Organiser: ${org.email}`);
    }
  }

  // 3. Seed 6 Realistic Venues with Maintenance Blocks
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const defaultVenues = [
    {
      name: 'Tagore Memorial Auditorium',
      capacity: 500,
      facilities: ['projector', 'sound system', 'AC', 'stage', 'WiFi', 'podium', 'live-stream setup', 'parking'],
      hourlyRate: 1200,
      description: 'Grand campus auditorium with acoustic panelling, elevated proscenium stage, and dual digital projectors.',
      isActive: true,
      blockedDates: [
        {
          from: new Date(now + 7 * oneDay), // 7 days in future
          to: new Date(now + 7 * oneDay + 6 * 60 * 60 * 1000), // 6 hours block
          reason: 'Quarterly sound system inspection & laser calibration'
        }
      ]
    },
    {
      name: 'Vikram Sarabhai Seminar Hall',
      capacity: 120,
      facilities: ['projector', 'sound system', 'AC', 'podium', 'whiteboard', 'WiFi'],
      hourlyRate: 450,
      description: 'Modern tiered seminar hall with executive seating, motorized projection screen, and wireless collar microphones.',
      isActive: true,
      blockedDates: []
    },
    {
      name: 'Aryabhata Conference Room',
      capacity: 40,
      facilities: ['projector', 'AC', 'whiteboard', 'WiFi', 'catering area'],
      hourlyRate: 250,
      description: 'Executive committee and board meeting space equipped with conference tele-video facilities and whiteboard.',
      isActive: true,
      blockedDates: [
        {
          from: new Date(now + 12 * oneDay), // 12 days in future
          to: new Date(now + 12 * oneDay + 8 * 60 * 60 * 1000),
          reason: 'HVAC duct cleaning and routine maintenance'
        }
      ]
    },
    {
      name: 'Central Open-Air Amphitheatre',
      capacity: 800,
      facilities: ['sound system', 'stage', 'parking', 'catering area'],
      hourlyRate: 800,
      description: 'Tiered open sky amphitheatre with stone steps, suitable for cultural fests, theatrical performances, and musical evenings.',
      isActive: true,
      blockedDates: []
    },
    {
      name: 'Alan Turing Computing Lab',
      capacity: 60,
      facilities: ['projector', 'AC', 'whiteboard', 'WiFi'],
      hourlyRate: 350,
      description: 'High-speed networked computing lab with 60 workstations suitable for technical hackathons and workshops.',
      isActive: true,
      blockedDates: []
    },
    {
      name: 'Community Activity & Cultural Hall',
      capacity: 250,
      facilities: ['sound system', 'stage', 'catering area', 'parking', 'podium', 'WiFi'],
      hourlyRate: 500,
      description: 'Multi-purpose indoor community hall with flexible seating configurations, dining area, and dedicated stage.',
      isActive: true,
      blockedDates: []
    }
  ];

  for (const vData of defaultVenues) {
    const existingVenue = await Venue.findOne({ name: vData.name });
    if (!existingVenue) {
      await Venue.create(vData);
      console.log(`[Seed] Created Venue: ${vData.name}`);
    }
  }
};

// If run directly via CLI (npm run seed)
if (require.main === module) {
  require('dotenv').config();
  const { connectDB, disconnectDB } = require('../config/db');

  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      console.log('Database seeding successfully completed.');
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
