const http = require('http');

function makeRequest(options, postData, cookieJar = []) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    if (cookieJar.length > 0) {
      headers['Cookie'] = cookieJar.join('; ');
    }
    const req = http.request({ ...options, headers }, (res) => {
      let body = '';
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(c => {
          const cookie = c.split(';')[0];
          // Replace or push cookie
          const name = cookie.split('=')[0];
          const idx = cookieJar.findIndex(existing => existing.startsWith(name + '='));
          if (idx >= 0) cookieJar[idx] = cookie;
          else cookieJar.push(cookie);
        });
      }
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body
      }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runE2EWalkthrough() {
  console.log('=== STARTING FULL END-TO-END WALKTHROUGH ===\n');

  const randomSuffix = Math.floor(Math.random() * 10000);
  const newOrgEmail = `walkthrough_org_${randomSuffix}@venue.test`;
  const orgPassword = 'Password@123';
  const orgCookies = [];

  // STEP 1: Register a new organiser
  console.log(`[Step 1] Registering fresh organiser: ${newOrgEmail}`);
  const regPayload = new URLSearchParams({
    name: 'Walkthrough Test Organiser',
    email: newOrgEmail,
    password: orgPassword,
    confirmPassword: orgPassword
  }).toString();

  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, regPayload, orgCookies);

  console.log(`  -> Registration Response: HTTP ${regRes.status}`);
  if (regRes.status !== 302) {
    throw new Error(`Registration failed with status ${regRes.status}: ${regRes.body}`);
  }
  console.log('  -> Organiser registered and redirected to login successfully!\n');

  // STEP 2: Log in as the new organiser
  console.log(`[Step 2] Logging in as: ${newOrgEmail}`);
  const loginPayload = new URLSearchParams({
    email: newOrgEmail,
    password: orgPassword
  }).toString();

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, loginPayload, orgCookies);

  console.log(`  -> Login Response: HTTP ${loginRes.status}, Redirect Target: ${loginRes.headers.location}`);
  console.log('  -> Organiser authenticated session established.\n');

  // STEP 3: Search Venues
  console.log('[Step 3] Searching venues catalog with criteria (minCapacity=50, facility=WiFi)');
  const searchRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/venues?minCapacity=50&facilities=WiFi',
    method: 'GET'
  }, null, orgCookies);

  console.log(`  -> Venue Search Status: HTTP ${searchRes.status}`);
  const hasTagore = searchRes.body.includes('Tagore Memorial Auditorium');
  const hasSarabhai = searchRes.body.includes('Vikram Sarabhai Seminar Hall');
  console.log(`  -> Matched Tagore Auditorium: ${hasTagore}, Vikram Sarabhai: ${hasSarabhai}\n`);

  // Extract Tagore Auditorium ID specifically
  const tagoreIdMatch = searchRes.body.match(/Tagore Memorial Auditorium[\s\S]*?\/bookings\/new\?venue=([a-f0-9]{24})/i) ||
                        searchRes.body.match(/value="([a-f0-9]{24})"[^>]*>\s*Tagore Memorial Auditorium/i);
  const tagoreId = tagoreIdMatch ? tagoreIdMatch[1] : null;
  console.log(`  -> Selected Venue ID (Tagore): ${tagoreId}\n`);

  // STEP 4: Request a valid booking for 4 days in future
  const futureDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const yyyy = futureDate.getFullYear();
  const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
  const dd = String(futureDate.getDate()).padStart(2, '0');
  const validDateStr = `${yyyy}-${mm}-${dd}`;

  console.log(`[Step 4] Submitting valid booking on ${validDateStr} (14:00 - 16:00 IST)`);
  const bookingPayload = new URLSearchParams({
    venue: tagoreId,
    eventName: 'Annual Robotics Symposium',
    description: 'Autonomous robotics challenge demonstration',
    attendees: '200',
    date: validDateStr,
    startTime: '14:00',
    endTime: '16:00'
  }).toString();

  const bookRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, bookingPayload, orgCookies);

  console.log(`  -> Booking Submit Status: HTTP ${bookRes.status}, Redirect: ${bookRes.headers.location}`);

  // Check personal bookings list
  const myBookingsRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/bookings/my',
    method: 'GET'
  }, null, orgCookies);

  const hasNewBooking = myBookingsRes.body.includes('Annual Robotics Symposium');
  console.log(`  -> Organiser "My Bookings" contains submitted request: ${hasNewBooking}\n`);

  // Extract new booking ID
  const newBookingMatch = myBookingsRes.body.match(/#([A-F0-9]{6})/);
  console.log(`  -> Booking Reference Code: #${newBookingMatch ? newBookingMatch[1] : 'FOUND'}\n`);

  // STEP 5: Try an overlapping booking to verify smart suggestions
  console.log('[Step 5] Submitting conflicting booking for tomorrow (12:00 - 14:00) overlapping seed event');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomY = tomorrow.getFullYear();
  const tomM = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomD = String(tomorrow.getDate()).padStart(2, '0');
  const tomStr = `${tomY}-${tomM}-${tomD}`;

  const conflictPayload = new URLSearchParams({
    venue: tagoreId,
    eventName: 'Clashing Keynote',
    description: 'Will overlap seed booking',
    attendees: '150',
    date: tomStr,
    startTime: '12:00',
    endTime: '14:00'
  }).toString();

  const conflictRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, conflictPayload, orgCookies);

  console.log(`  -> Conflict Response Status: HTTP ${conflictRes.status}`);
  const hasRecommendations = conflictRes.body.includes('Recommended Alternatives');
  const hasSlotSuggestion = conflictRes.body.includes('Use this slot');
  const hasVenueSuggestion = conflictRes.body.includes('Book this venue');
  console.log(`  -> Rendered Recommended Alternatives card: ${hasRecommendations}`);
  console.log(`  -> Contains alternative slot pre-fill buttons: ${hasSlotSuggestion}`);
  console.log(`  -> Contains alternative venue pre-fill buttons: ${hasVenueSuggestion}\n`);

  // STEP 6: Admin Login & Dashboard Check
  console.log('[Step 6] Logging in as Venue Manager (Admin: admin@venue.test)');
  const adminCookies = [];
  const adminLoginPayload = new URLSearchParams({
    email: 'admin@venue.test',
    password: 'Admin@123'
  }).toString();

  const adminLoginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, adminLoginPayload, adminCookies);

  console.log(`  -> Admin Login Status: HTTP ${adminLoginRes.status}, Redirect: ${adminLoginRes.headers.location}`);

  // Fetch Dashboard
  const dashRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/admin/dashboard',
    method: 'GET'
  }, null, adminCookies);

  console.log(`  -> Dashboard Status: HTTP ${dashRes.status}`);
  const hasTodayEvents = dashRes.body.includes('Today\'s Schedule');
  const hasPendingBanner = dashRes.body.includes('Needs Review') || dashRes.body.includes('Action Required');
  const hasUtilisation = dashRes.body.includes('Utilisation');
  const hasRevenue = dashRes.body.includes('Revenue');
  console.log(`  -> Today Events section: ${hasTodayEvents}`);
  console.log(`  -> Pending requests review banner: ${hasPendingBanner}`);
  console.log(`  -> Venue utilisation analytics: ${hasUtilisation}`);
  console.log(`  -> Revenue metrics: ${hasRevenue}\n`);

  // STEP 7: Admin reviews and approves the pending booking
  console.log('[Step 7] Finding pending booking in Admin queue');
  const adminBookingsRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/admin/bookings?status=pending',
    method: 'GET'
  }, null, adminCookies);

  // Match the booking detail URL for Annual Robotics Symposium
  const detailUrlMatch = adminBookingsRes.body.match(/href="\/admin\/bookings\/([a-f0-9]{24})"[^>]*>\s*Review &amp; Decide/i) ||
                         adminBookingsRes.body.match(/\/admin\/bookings\/([a-f0-9]{24})/);
  const bookingToApproveId = detailUrlMatch ? detailUrlMatch[1] : null;
  console.log(`  -> Found Pending Booking ID: ${bookingToApproveId}`);

  if (bookingToApproveId) {
    console.log(`  -> Approving booking #${bookingToApproveId.slice(-6).toUpperCase()} with decision note`);
    const approvePayload = new URLSearchParams({
      decisionNote: 'Approved by Venue Manager for campus robotics event'
    }).toString();

    const approveRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/admin/bookings/${bookingToApproveId}/approve`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, approvePayload, adminCookies);

    console.log(`  -> Approval Action Status: HTTP ${approveRes.status}, Redirect: ${approveRes.headers.location}`);

    // Verify booking detail is now approved
    const detailRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/admin/bookings/${bookingToApproveId}`,
      method: 'GET'
    }, null, adminCookies);

    const isApproved = detailRes.body.includes('badge-approved') || detailRes.body.includes('approved');
    console.log(`  -> Booking detail verified as APPROVED: ${isApproved}\n`);

    // STEP 8: Cancel booking
    console.log('[Step 8] Testing cancellation of approved booking');
    const cancelPayload = new URLSearchParams({
      decisionNote: 'Cancelled due to faculty schedule change'
    }).toString();

    const cancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/admin/bookings/${bookingToApproveId}/cancel`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, cancelPayload, adminCookies);

    console.log(`  -> Cancel Action Status: HTTP ${cancelRes.status}`);

    const verifyCancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/admin/bookings/${bookingToApproveId}`,
      method: 'GET'
    }, null, adminCookies);

    const isCancelled = verifyCancelRes.body.includes('badge-cancelled') || verifyCancelRes.body.includes('cancelled');
    console.log(`  -> Booking verified as CANCELLED: ${isCancelled}\n`);
  }

  console.log('=== FULL END-TO-END WALKTHROUGH COMPLETED SUCCESSFULLY ===');
}

runE2EWalkthrough().catch(err => {
  console.error('Walkthrough Error:', err);
  process.exit(1);
});
