/**
 * Timezone and Date Helper for Asia/Kolkata (IST = UTC+05:30)
 */

const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Parses an IST date string (YYYY-MM-DD) and time string (HH:mm) into a UTC Date object
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr 'HH:mm'
 * @returns {Date} UTC Date object
 */
const parseISTToUTC = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Construct UTC timestamp by subtracting IST offset (+05:30 = 330 min)
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMillis);
};

/**
 * Format a Date object into IST 'YYYY-MM-DD'
 */
const formatISTDateYMD = (date) => {
  if (!date) return '';
  const istDate = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Format a Date object into IST 'HH:mm'
 */
const formatISTTimeHM = (date) => {
  if (!date) return '';
  const istDate = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  const h = String(istDate.getUTCHours()).padStart(2, '0');
  const m = String(istDate.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Format Date to readable IST string e.g. "25 Oct 2026, 10:00 IST"
 */
const formatISTDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }) + ' IST';
};

/**
 * Format start and end Dates into a slot string e.g. "25 Oct 2026, 10:00 – 14:00 IST"
 */
const formatISTSlot = (start, end) => {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);

  const datePart = startDate.toLocaleDateString('en-IN', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const startTime = startDate.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const endTime = endDate.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `${datePart}, ${startTime} – ${endTime} IST`;
};

module.exports = {
  TIMEZONE,
  parseISTToUTC,
  formatISTDateYMD,
  formatISTTimeHM,
  formatISTDateTime,
  formatISTSlot
};
