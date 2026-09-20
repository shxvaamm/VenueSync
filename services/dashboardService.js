const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { operatingHours } = require('../config/settings');
const {
  formatISTDateYMD,
  parseISTToUTC,
  formatISTSlot,
  formatISTDateTime
} = require('./timeHelper');

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Resolves period type ('this-week', 'this-month', 'custom') to IST date strings and UTC boundaries
 *
 * @param {Object} query
 * @param {string} [query.period='this-week']
 * @param {string} [query.startDate]
 * @param {string} [query.endDate]
 * @param {Date} [refDate=new Date()]
 * @returns {{ type: string, label: string, startDateStr: string, endDateStr: string, periodStart: Date, periodEnd: Date }}
 */
const getPeriodRange = (query = {}, refDate = new Date()) => {
  const periodType = query.period || 'this-week';
  const istNow = new Date(refDate.getTime() + IST_OFFSET_MS);

  let startDateStr = '';
  let endDateStr = '';
  let label = '';

  if (periodType === 'this-month') {
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth(); // 0-indexed
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    label = `This Month (${monthNames[month]} ${year})`;
  } else if (periodType === 'custom' && query.startDate && query.endDate) {
    startDateStr = query.startDate;
    endDateStr = query.endDate;
    label = `Custom Period (${startDateStr} to ${endDateStr})`;
  } else {
    // Default: 'this-week' (Monday to Sunday in IST)
    const dayOfWeek = istNow.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(istNow.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const mY = monday.getUTCFullYear();
    const mM = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const mD = String(monday.getUTCDate()).padStart(2, '0');
    startDateStr = `${mY}-${mM}-${mD}`;

    const sY = sunday.getUTCFullYear();
    const sM = String(sunday.getUTCMonth() + 1).padStart(2, '0');
    const sD = String(sunday.getUTCDate()).padStart(2, '0');
    endDateStr = `${sY}-${sM}-${sD}`;

    label = `This Week (${startDateStr} to ${endDateStr})`;
  }

  const periodStart = parseISTToUTC(startDateStr, '00:00');
  const periodEnd = parseISTToUTC(endDateStr, '23:59');

  return {
    type: periodType,
    label,
    startDateStr,
    endDateStr,
    periodStart,
    periodEnd
  };
};

/**
 * Calculates venue-wise available operating hours, booked hours, utilisation %, and revenue
 *
 * Rule:
 * - Operating hours are within operatingHours.open and operatingHours.close (e.g. 08:00 to 22:00 = 14 hrs/day).
 * - Maintenance-blocked days are excluded from available operating hours.
 * - Only APPROVED and COMPLETED bookings are counted.
 * - Bookings extending beyond period boundaries are clamped to [periodStart, periodEnd].
 *
 * @param {Object} params
 * @param {Array} params.venues
 * @param {Array} params.bookings
 * @param {Date} params.periodStart
 * @param {Date} params.periodEnd
 * @param {Object} [params.customOperatingHours]
 * @returns {{ venueMetrics: Array, totals: Object }}
 */
const calculateVenueUtilisationAndRevenue = ({
  venues,
  bookings,
  periodStart,
  periodEnd,
  customOperatingHours = operatingHours
}) => {
  const [openHour] = (customOperatingHours.open || '08:00').split(':').map(Number);
  const [closeHour] = (customOperatingHours.close || '22:00').split(':').map(Number);
  const dailyOperatingHours = Math.max(0, closeHour - openHour);

  // Generate all calendar day strings (YYYY-MM-DD) in the period
  const dayStrings = [];
  const startYMD = formatISTDateYMD(periodStart);
  const endYMD = formatISTDateYMD(periodEnd);

  let currentCursor = new Date(periodStart);
  while (formatISTDateYMD(currentCursor) <= endYMD) {
    const curYMD = formatISTDateYMD(currentCursor);
    if (!dayStrings.includes(curYMD)) {
      dayStrings.push(curYMD);
    }
    // Advance by 1 day
    currentCursor = new Date(currentCursor.getTime() + 24 * 60 * 60 * 1000);
    // Safety break against infinite loop
    if (dayStrings.length > 366) break;
  }

  const totalPeriodDays = dayStrings.length || 1;

  let totalAvailableHoursAll = 0;
  let totalBookedHoursAll = 0;
  let totalRevenueAll = 0;

  const venueMetrics = venues.map((venue) => {
    // 1. Calculate available operating hours by excluding maintenance-blocked days
    let maintenanceDaysCount = 0;

    dayStrings.forEach((dayStr) => {
      const dayOperationalStart = parseISTToUTC(dayStr, customOperatingHours.open || '08:00');
      const dayOperationalEnd = parseISTToUTC(dayStr, customOperatingHours.close || '22:00');

      if (venue.blockedDates && venue.blockedDates.length > 0) {
        const isBlocked = venue.blockedDates.some((block) => {
          const blockFrom = new Date(block.from);
          const blockTo = new Date(block.to);
          return blockFrom < dayOperationalEnd && blockTo > dayOperationalStart;
        });

        if (isBlocked) {
          maintenanceDaysCount += 1;
        }
      }
    });

    const activeOperatingDays = Math.max(0, totalPeriodDays - maintenanceDaysCount);
    const availableOperatingHours = activeOperatingDays * dailyOperatingHours;

    // 2. Filter bookings for this venue with status 'approved' or 'completed'
    const venueBookings = bookings.filter((b) => {
      const vId = b.venue && b.venue._id ? b.venue._id.toString() : b.venue.toString();
      const statusOk = b.status === 'approved' || b.status === 'completed';
      const overlapsPeriod = new Date(b.start) < periodEnd && new Date(b.end) > periodStart;
      return vId === venue._id.toString() && statusOk && overlapsPeriod;
    });

    // 3. Compute clamped booked hours & revenue
    let venueBookedHours = 0;
    venueBookings.forEach((b) => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();

      const clampedStart = Math.max(bStart, periodStart.getTime());
      const clampedEnd = Math.min(bEnd, periodEnd.getTime());

      if (clampedEnd > clampedStart) {
        const hours = (clampedEnd - clampedStart) / (1000 * 60 * 60);
        venueBookedHours += hours;
      }
    });

    // Round booked hours to 1 decimal place
    const roundedBookedHours = Math.round(venueBookedHours * 10) / 10;

    // 4. Calculate Utilisation %
    let utilisationPercent = 0;
    if (availableOperatingHours > 0) {
      const rawRate = (venueBookedHours / availableOperatingHours) * 100;
      utilisationPercent = Math.min(100, Math.round(rawRate * 10) / 10);
    }

    // 5. Calculate Revenue (clamped booked hours * hourlyRate)
    const venueRevenue = Math.round(venueBookedHours * venue.hourlyRate);

    totalAvailableHoursAll += availableOperatingHours;
    totalBookedHoursAll += roundedBookedHours;
    totalRevenueAll += venueRevenue;

    return {
      venueId: venue._id,
      venueName: venue.name,
      capacity: venue.capacity,
      hourlyRate: venue.hourlyRate,
      isActive: venue.isActive,
      totalDays: totalPeriodDays,
      maintenanceDays: maintenanceDaysCount,
      activeOperatingDays,
      availableOperatingHours,
      bookedHours: roundedBookedHours,
      utilisationPercent,
      revenue: venueRevenue
    };
  });

  totalBookedHoursAll = Math.round(totalBookedHoursAll * 10) / 10;

  const overallUtilisationPercent =
    totalAvailableHoursAll > 0
      ? Math.min(100, Math.round((totalBookedHoursAll / totalAvailableHoursAll) * 1000) / 10)
      : 0;

  return {
    venueMetrics,
    totals: {
      totalAvailableHours: totalAvailableHoursAll,
      totalBookedHours: totalBookedHoursAll,
      overallUtilisationPercent,
      totalRevenue: totalRevenueAll
    }
  };
};

/**
 * Aggregates all dashboard data for the admin console
 *
 * @param {Object} query - HTTP request query params
 * @param {Date} [now=new Date()]
 * @returns {Promise<Object>}
 */
const getDashboardData = async (query = {}, now = new Date()) => {
  // 1. Resolve period boundaries
  const period = getPeriodRange(query, now);

  // 2. Fetch all venues
  const venues = await Venue.find().sort({ name: 1 });

  // 3. Fetch all bookings overlapping period for utilisation & revenue
  const periodBookings = await Booking.find({
    status: { $in: ['approved', 'completed'] },
    start: { $lt: period.periodEnd },
    end: { $gt: period.periodStart }
  });

  const { venueMetrics, totals } = calculateVenueUtilisationAndRevenue({
    venues,
    bookings: periodBookings,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd
  });

  // 4. Today's Events (Approved)
  const todayYMD = formatISTDateYMD(now);
  const todayStart = parseISTToUTC(todayYMD, '00:00');
  const todayEnd = parseISTToUTC(todayYMD, '23:59');

  const todayEvents = await Booking.find({
    status: 'approved',
    start: { $lte: todayEnd },
    end: { $gte: todayStart }
  })
    .populate('venue organiser')
    .sort({ start: 1 });

  // 5. Upcoming Events for the next 7 days (Approved)
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingEvents = await Booking.find({
    status: 'approved',
    start: { $gt: now, $lte: sevenDaysLater }
  })
    .populate('venue organiser')
    .sort({ start: 1 });

  // 6. Pending requests count waiting for action
  const pendingCount = await Booking.countDocuments({ status: 'pending' });

  // 7. Overall System Statistics
  const totalVenuesCount = venues.length;
  const totalApprovedCount = await Booking.countDocuments({ status: 'approved' });
  const totalCompletedCount = await Booking.countDocuments({ status: 'completed' });
  const totalBookingsCount = await Booking.countDocuments();

  return {
    period,
    todayEvents,
    upcomingEvents,
    pendingCount,
    venueMetrics,
    totals,
    stats: {
      totalVenuesCount,
      totalApprovedCount,
      totalCompletedCount,
      totalPendingCount: pendingCount,
      totalBookingsCount
    },
    formatISTSlot,
    formatISTDateTime
  };
};

module.exports = {
  getPeriodRange,
  calculateVenueUtilisationAndRevenue,
  getDashboardData
};
