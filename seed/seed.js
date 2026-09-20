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

  // 4. Seed ~15 Realistic Bookings across all statuses and date ranges
  const Booking = require('../models/Booking');
  const { formatISTDateYMD, parseISTToUTC } = require('../services/timeHelper');

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
        decisionNote: 'Successfully concluded. Key return logged at security.'
      },
      {
        venue: turing._id,
        organiser: org2._id,
        eventName: 'Python & Machine Learning BootCamp',
        description: 'Intensive 4-hour hands-on deep learning tutorial.',
        attendees: 55,
        start: getRelativeISTDate(-5, 9),
        end: getRelativeISTDate(-5, 13),
        status: 'completed',
        totalCost: 4 * turing.hourlyRate,
        decisionNote: 'Workstations inspected and restored.'
      },
      {
        venue: sarabhai._id,
        organiser: org1._id,
        eventName: 'Green Energy & Solar Systems Symposium',
        description: 'Inter-departmental academic research presentations.',
        attendees: 110,
        start: getRelativeISTDate(-4, 14),
        end: getRelativeISTDate(-4, 17),
        status: 'completed',
        totalCost: 3 * sarabhai.hourlyRate,
        decisionNote: 'Seminar hall inspected post-event.'
      },
      {
        venue: aryabhata._id,
        organiser: org2._id,
        eventName: 'Debate Club Strategy Session',
        description: 'Preparation session for national parliamentary debate.',
        attendees: 25,
        start: getRelativeISTDate(-3, 10),
        end: getRelativeISTDate(-3, 12),
        status: 'rejected',
        totalCost: 2 * aryabhata.hourlyRate,
        decisionNote: 'Conference room reserved for internal university finance audit.'
      },
      {
        venue: cultural._id,
        organiser: org1._id,
        eventName: 'Campus Blood Donation & Health Drive',
        description: 'Annual student medical welfare and voluntary donation camp.',
        attendees: 180,
        start: getRelativeISTDate(-2, 10),
        end: getRelativeISTDate(-2, 14),
        status: 'completed',
        totalCost: 4 * cultural.hourlyRate,
        decisionNote: 'Hall sanitized following medical camp protocols.'
      },
      {
        venue: amphitheatre._id,
        organiser: org2._id,
        eventName: 'Acoustic Unplugged Musical Evening',
        description: 'Live acoustic open mic concert.',
        attendees: 450,
        start: getRelativeISTDate(-1, 17),
        end: getRelativeISTDate(-1, 21),
        status: 'cancelled',
        totalCost: 4 * amphitheatre.hourlyRate,
        decisionNote: 'Cancelled due to unseasonal rain forecast.'
      },

      // TODAY: Must have data on every fresh start!
      {
        venue: sarabhai._id,
        organiser: org1._id,
        eventName: 'National Science Day Colloquium',
        description: 'Distinguished lectures commemorating CV Raman discoveries.',
        attendees: 95,
        start: getRelativeISTDate(0, 10),
        end: getRelativeISTDate(0, 13),
        status: 'approved',
        totalCost: 3 * sarabhai.hourlyRate,
        decisionNote: 'Approved by Academic Dean. Wireless collar mics requested.'
      },
      {
        venue: aryabhata._id,
        organiser: org2._id,
        eventName: 'Faculty Research Review Panel',
        description: 'Quarterly faculty grant review and doctoral thesis approvals.',
        attendees: 35,
        start: getRelativeISTDate(0, 14),
        end: getRelativeISTDate(0, 17),
        status: 'approved',
        totalCost: 3 * aryabhata.hourlyRate,
        decisionNote: 'Approved. Teleconferencing facilities enabled.'
      },
      {
        venue: turing._id,
        organiser: org1._id,
        eventName: 'Open Source Hackathon Orientation',
        description: 'Introductory tooling and repo briefing for weekend hackathon participants.',
        attendees: 50,
        start: getRelativeISTDate(0, 18),
        end: getRelativeISTDate(0, 21),
        status: 'pending',
        totalCost: 3 * turing.hourlyRate,
        decisionNote: ''
      },

      // Next 7 Days: Approved, Pending
      {
        venue: tagore._id,
        organiser: org2._id,
        eventName: 'Inter-College Annual Drama Festival',
        description: 'Theatrical competition featuring 8 regional college drama troupes.',
        attendees: 400,
        start: getRelativeISTDate(1, 11),
        end: getRelativeISTDate(1, 15),
        status: 'approved',
        totalCost: 4 * tagore.hourlyRate,
        decisionNote: 'Approved. Backstage access pass and lighting technician assigned.'
      },
      {
        venue: turing._id,
        organiser: org1._id,
        eventName: 'ACM Competitive Coding Qualifier',
        description: 'Individual collegiate preliminary round for ACM ICPC regionals.',
        attendees: 60,
        start: getRelativeISTDate(2, 10),
        end: getRelativeISTDate(2, 14),
        status: 'approved',
        totalCost: 4 * turing.hourlyRate,
        decisionNote: 'Approved. High-bandwidth dedicated VLAN configured.'
      },
      {
        venue: cultural._id,
        organiser: org2._id,
        eventName: 'Traditional Heritage Art & Craft Exhibition',
        description: 'Showcasing folk paintings, pottery, and student cultural handcrafts.',
        attendees: 200,
        start: getRelativeISTDate(3, 13),
        end: getRelativeISTDate(3, 17),
        status: 'approved',
        totalCost: 4 * cultural.hourlyRate,
        decisionNote: 'Approved. Catering area clearance granted.'
      },
      {
        venue: sarabhai._id,
        organiser: org1._id,
        eventName: 'Autonomous Robotics Design Sprint',
        description: 'Technical brainstorming and prototype testing for robotics championship.',
        attendees: 85,
        start: getRelativeISTDate(4, 11),
        end: getRelativeISTDate(4, 14),
        status: 'pending',
        totalCost: 3 * sarabhai.hourlyRate,
        decisionNote: ''
      },
      {
        venue: tagore._id,
        organiser: org2._id,
        eventName: 'National Youth Parliamentary Debate',
        description: 'Simulated parliamentary debate on educational policy and youth development.',
        attendees: 320,
        start: getRelativeISTDate(5, 14),
        end: getRelativeISTDate(5, 18),
        status: 'pending',
        totalCost: 4 * tagore.hourlyRate,
        decisionNote: ''
      },

      // Next Week (Days 8 - 14)
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
      const existing = await Booking.findOne({ eventName: bData.eventName });
      if (!existing) {
        await Booking.create(bData);
        console.log(`[Seed] Created Booking: ${bData.eventName} (${bData.status})`);
      }
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
