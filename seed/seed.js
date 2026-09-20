const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { formatISTDateYMD, parseISTToUTC } = require('../services/timeHelper');

/**
 * Idempotent Database Seeder for VenueSync
 * 
 * Rules:
 * 1. Never deletes existing data unless explicit --reset flag is provided.
 * 2. Reads ADMIN_PASSWORD from env (falls back to Admin@123 only in non-production).
 * 3. Seeds demo organisers and demo bookings ONLY when SEED_DEMO=true or options.seedDemo=true.
 * 4. Ensures all database indexes (unique email, venue name, composite booking index) exist.
 */
const seedDatabase = async (options = {}) => {
  const isReset = options.reset || process.argv.includes('--reset');
  const shouldSeedDemo = options.seedDemo || process.env.SEED_DEMO === 'true';

  if (isReset) {
    console.log('[Seed] --reset flag detected: removing existing bookings, venues, and users...');
    await Booking.deleteMany({});
    await Venue.deleteMany({});
    await User.deleteMany({});
    console.log('[Seed] Database collections successfully reset.');
  }

  // 1. Resolve Admin Password
  let adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Seed Fatal] ADMIN_PASSWORD environment variable is required in production.');
    }
    adminPassword = 'Admin@123';
  }

  // 2. Seed Admin User
  const adminEmail = 'admin@venue.test';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const adminPasswordHash = await User.hashPassword(adminPassword);
    await User.create({
      name: 'Campus Venue Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'admin'
    });
    console.log(`[Seed] Created Admin account: ${adminEmail}`);
  } else {
    console.log(`[Seed] Admin account already exists: ${adminEmail} (preserved)`);
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
      blockedDates: [
        {
          from: new Date(now + 3 * oneDay), // 3 days in future
          to: new Date(now + 3 * oneDay + 4 * 60 * 60 * 1000), // 4 hours block
          reason: 'HVAC filter replacement & AC duct maintenance'
        }
      ]
    },
    {
      name: 'Aryabhata Conference Room',
      capacity: 40,
      facilities: ['projector', 'AC', 'whiteboard', 'WiFi', 'sound system'],
      hourlyRate: 250,
      description: 'Intimate executive conference room equipped with conference call spider microphones and smart presentation display.',
      isActive: true,
      blockedDates: []
    },
    {
      name: 'Central Open-Air Amphitheatre',
      capacity: 800,
      facilities: ['sound system', 'stage', 'parking', 'live-stream setup'],
      hourlyRate: 800,
      description: 'Expansive open-air Greek-style amphitheater ideal for cultural festivals, drama nights, and rock concerts.',
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
    } else {
      // Preserve existing venue
    }
  }

  // 4. Demo Organisers and Bookings (Only when SEED_DEMO=true)
  if (shouldSeedDemo) {
    console.log('[Seed] SEED_DEMO=true: seeding demo organisers and demo bookings...');
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
        console.log(`[Seed] Created Organiser: ${org.email}`);
      }
    }

    // Helper for computing relative IST timestamps
    const getRelativeISTDate = (dayOffset, hour, minute = 0) => {
      const current = new Date();
      const istDateStr = formatISTDateYMD(current);
      const [y, m, d] = istDateStr.split('-').map(Number);
      const targetDate = new Date(Date.UTC(y, m - 1, d + dayOffset, 12, 0, 0));
      const targetYMD = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDate.getUTCDate()).padStart(2, '0')}`;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return parseISTToUTC(targetYMD, timeStr);
    };

    const tagore = await Venue.findOne({ name: 'Tagore Memorial Auditorium' });
    const sarabhai = await Venue.findOne({ name: 'Vikram Sarabhai Seminar Hall' });
    const aryabhata = await Venue.findOne({ name: 'Aryabhata Conference Room' });
    const amphitheatre = await Venue.findOne({ name: 'Central Open-Air Amphitheatre' });
    const turing = await Venue.findOne({ name: 'Alan Turing Computing Lab' });
    const cultural = await Venue.findOne({ name: 'Community Activity & Cultural Hall' });

    const org1 = await User.findOne({ email: 'organiser1@venue.test' });
    const org2 = await User.findOne({ email: 'organiser2@venue.test' });

    if (tagore && sarabhai && aryabhata && amphitheatre && turing && cultural && org1 && org2) {
      const defaultBookings = [
        // Past Week: Completed, Rejected, Cancelled
        {
          venue: tagore._id,
          organiser: org1._id,
          eventName: 'Annual Alumni Leadership Keynote',
          description: 'Keynote panel with distinguished engineering and business alumni.',
          attendees: 420,
          start: getRelativeISTDate(-6, 10),
          end: getRelativeISTDate(-6, 14),
          status: 'completed',
          totalCost: 4 * tagore.hourlyRate,
          decisionNote: 'Event successfully concluded on schedule.'
        },
        {
          venue: turing._id,
          organiser: org2._id,
          eventName: 'Python & Machine Learning BootCamp',
          description: 'Hands-on practical workshop covering Pandas, NumPy, and Scikit-Learn.',
          attendees: 55,
          start: getRelativeISTDate(-5, 9),
          end: getRelativeISTDate(-5, 13),
          status: 'completed',
          totalCost: 4 * turing.hourlyRate,
          decisionNote: 'Lab computers configured with conda.'
        },
        {
          venue: sarabhai._id,
          organiser: org1._id,
          eventName: 'Green Energy & Solar Systems Symposium',
          description: 'Faculty research presentations on rooftop solar optimization.',
          attendees: 90,
          start: getRelativeISTDate(-4, 14),
          end: getRelativeISTDate(-4, 18),
          status: 'completed',
          totalCost: 4 * sarabhai.hourlyRate,
          decisionNote: 'Full attendance recorded.'
        },
        {
          venue: aryabhata._id,
          organiser: org2._id,
          eventName: 'Debate Club Strategy Session',
          description: 'Weekly preparatory session for upcoming inter-university debate tournament.',
          attendees: 35,
          start: getRelativeISTDate(-3, 16),
          end: getRelativeISTDate(-3, 19),
          status: 'rejected',
          totalCost: 3 * aryabhata.hourlyRate,
          decisionNote: 'Room was booked for emergency faculty council meeting.'
        },
        {
          venue: cultural._id,
          organiser: org1._id,
          eventName: 'Campus Blood Donation & Health Drive',
          description: 'Annual social service drive in collaboration with Red Cross Society.',
          attendees: 180,
          start: getRelativeISTDate(-2, 9),
          end: getRelativeISTDate(-2, 17),
          status: 'completed',
          totalCost: 8 * cultural.hourlyRate,
          decisionNote: 'Sanitation team briefed and clean-up verified.'
        },
        {
          venue: amphitheatre._id,
          organiser: org2._id,
          eventName: 'Acoustic Unplugged Musical Evening',
          description: 'Student music club open mic showcase.',
          attendees: 300,
          start: getRelativeISTDate(-1, 18),
          end: getRelativeISTDate(-1, 21),
          status: 'cancelled',
          totalCost: 3 * amphitheatre.hourlyRate,
          decisionNote: 'Cancelled due to unseasonal rain forecast.'
        },

        // TODAY: 2 Approved Events
        {
          venue: sarabhai._id,
          organiser: org1._id,
          eventName: 'National Science Day Colloquium',
          description: 'Invited lectures on quantum optics and condensed matter physics.',
          attendees: 110,
          start: getRelativeISTDate(0, 9),
          end: getRelativeISTDate(0, 13),
          status: 'approved',
          totalCost: 4 * sarabhai.hourlyRate,
          decisionNote: 'Approved. Projection system verified.'
        },
        {
          venue: aryabhata._id,
          organiser: org2._id,
          eventName: 'Faculty Research Review Panel',
          description: 'Quarterly review of funded departmental research grants.',
          attendees: 25,
          start: getRelativeISTDate(0, 14),
          end: getRelativeISTDate(0, 17),
          status: 'approved',
          totalCost: 3 * aryabhata.hourlyRate,
          decisionNote: 'Approved by Dean Academics.'
        },

        // Next 7 Days: Approved and Pending Requests
        {
          venue: tagore._id,
          organiser: org1._id,
          eventName: 'Open Source Hackathon Orientation',
          description: 'Kick-off briefing, team formation, and mentor introductions.',
          attendees: 350,
          start: getRelativeISTDate(1, 11),
          end: getRelativeISTDate(1, 15),
          status: 'approved',
          totalCost: 4 * tagore.hourlyRate,
          decisionNote: 'Approved. Security and power backup instructed.'
        },
        {
          venue: amphitheatre._id,
          organiser: org2._id,
          eventName: 'Inter-College Annual Drama Festival',
          description: 'Street play competitions and stage acting performances.',
          attendees: 600,
          start: getRelativeISTDate(2, 17),
          end: getRelativeISTDate(2, 21),
          status: 'approved',
          totalCost: 4 * amphitheatre.hourlyRate,
          decisionNote: 'Approved. Sound permissions issued until 10 PM.'
        },
        {
          venue: turing._id,
          organiser: org1._id,
          eventName: 'ACM Competitive Coding Qualifier',
          description: 'Online programming contest preliminary round for university teams.',
          attendees: 58,
          start: getRelativeISTDate(3, 10),
          end: getRelativeISTDate(3, 14),
          status: 'approved',
          totalCost: 4 * turing.hourlyRate,
          decisionNote: 'Approved. Lab administrator assigned.'
        },
        {
          venue: cultural._id,
          organiser: org2._id,
          eventName: 'Traditional Heritage Art & Craft Exhibition',
          description: 'Display of regional folk art, pottery, and textile installations.',
          attendees: 200,
          start: getRelativeISTDate(4, 10),
          end: getRelativeISTDate(4, 18),
          status: 'approved',
          totalCost: 8 * cultural.hourlyRate,
          decisionNote: 'Approved. Display tables arranged.'
        },
        {
          venue: sarabhai._id,
          organiser: org1._id,
          eventName: 'Autonomous Robotics Design Sprint',
          description: 'Prototype evaluation for autonomous line follower bots.',
          attendees: 80,
          start: getRelativeISTDate(5, 13),
          end: getRelativeISTDate(5, 17),
          status: 'pending',
          totalCost: 4 * sarabhai.hourlyRate,
          decisionNote: ''
        },
        {
          venue: aryabhata._id,
          organiser: org2._id,
          eventName: 'National Youth Parliamentary Debate',
          description: 'Mock parliament sessions debating sustainable urban transport policies.',
          attendees: 38,
          start: getRelativeISTDate(6, 11),
          end: getRelativeISTDate(6, 15),
          status: 'pending',
          totalCost: 4 * aryabhata.hourlyRate,
          decisionNote: ''
        },

        // Second Week: Approved Events
        {
          venue: amphitheatre._id,
          organiser: org2._id,
          eventName: 'Annual Cultural Fest Grand Finale',
          description: 'Star night, musical symphony, and trophy presentation ceremonies.',
          attendees: 700,
          start: getRelativeISTDate(9, 16),
          end: getRelativeISTDate(9, 20),
          status: 'approved',
          totalCost: 4 * amphitheatre.hourlyRate,
          decisionNote: 'Approved. Sound permissions and campus police escort coordinated.'
        },
        {
          venue: aryabhata._id,
          organiser: org1._id,
          eventName: 'Alumni Mentorship Round-Table',
          description: 'Small group industry guidance and placement preparation workshop.',
          attendees: 30,
          start: getRelativeISTDate(11, 11),
          end: getRelativeISTDate(11, 13),
          status: 'approved',
          totalCost: 2 * aryabhata.hourlyRate,
          decisionNote: 'Approved by student affairs coordinator.'
        }
      ];

      for (const bData of defaultBookings) {
        const existing = await Booking.findOne({ eventName: bData.eventName, venue: bData.venue });
        if (!existing) {
          await Booking.create(bData);
          console.log(`[Seed] Created Booking: ${bData.eventName} (${bData.status})`);
        }
      }
    }
  } else {
    console.log('[Seed] SEED_DEMO is not "true". Skipping demo organisers and demo bookings (clean inventory mode).');
  }

  // 5. Synchronize Indexes on MongoDB
  await Promise.all([
    User.syncIndexes(),
    Venue.syncIndexes(),
    Booking.syncIndexes()
  ]);
  console.log('[Seed] Database indexes synchronized successfully.');
};

// If run directly via CLI (npm run seed)
if (require.main === module) {
  require('dotenv').config();
  const { connectDB, disconnectDB } = require('../config/db');

  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      console.log('[Seed] Database seeding completed successfully.');
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error] Database seeding failed:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedDatabase
};
