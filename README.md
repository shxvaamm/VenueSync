# Event & Venue Booking Management System (VenueSync)

An enterprise-grade campus and community event and venue booking management platform built with **Node.js, Express.js, EJS, and MongoDB**. Designed for real-time conflict-free slot scheduling, automated overlap detection, transparent administrative review pipelines, and smart recommendation alternatives when spaces or slots are contested.

---

## 🌟 Overview & Key Highlights

VenueSync streamlines the complete lifecycle of campus space reservations across auditoriums, seminar halls, computer labs, and open-air amphitheaters:
- **Zero Double-Bookings:** Strict mathematical interval overlap detection prevents concurrent approved bookings.
- **Maintenance Awareness:** Scheduled maintenance intervals actively block slot availability.
- **Smart Conflict Alternatives:** When a requested slot or venue is contested, the system automatically computes free alternative time windows and available alternative spaces with one-click pre-filled booking links.
- **Dual-Mode Persistence:** Seamlessly boots either against a live MongoDB Atlas cluster or with an embedded zero-setup In-Memory database (`mongodb-memory-server`).
- **Comprehensive Analytics:** Administrative dashboard tracking room utilisation rates, revenue aggregations, and upcoming event schedules.

---

## 👥 Features by Role

### 1. Organiser
- **Self-Registration & Authentication:** Secure registration with password complexity enforcement, bcrypt hashing, session-based auth, and rate-limiting.
- **Venue Catalog & Advanced Discovery:**
  - Search by minimum capacity, hourly rate cap, and multi-equipment selection (*must match all selected*).
  - Search by intended date and time window to preview only available spaces.
  - Interactive venue detail view showing capacities, equipment tags, and scheduled maintenance blocks.
- **Reservation Requests:**
  - Pre-filled venue reservation form with real-time cost estimation in Indian Rupees (₹).
  - Client and server-side validation against campus operating hours (`08:00` to `22:00` IST) and booking duration limits (1 to 12 hours).
  - Attendees bounded by venue seating capacity.
- **Smart Suggestions on Conflict:**
  - If a slot is taken by an approved reservation or maintenance block, view up to 5 alternative free slots at the same venue (ordered by closeness to requested time) and up to 5 alternative venues matching capacity and facilities.
  - One-click **"Use this slot"** or **"Book this venue"** buttons that return to the form pre-filled and re-validated.
- **Personal Booking Dashboard (`/bookings/my`):**
  - Track all submitted requests across statuses: `pending`, `approved`, `rejected`, `completed`, and `cancelled`.
  - Cancel any pending request or future approved reservation with one click.

### 2. Admin (Venue Manager)
- **Restricted Administrative Access:** Admin accounts can **only** be provisioned through administrative seed scripts, never via public registration.
- **Venue Management (CRUD):**
  - Create, inspect, edit, and soft delete venues.
  - Toggle venue active/inactive status.
  - Schedule and remove maintenance intervals with customized reasons.
  - Guard against deleting venues that have active future commitments.
- **Booking Review & Decision Pipeline (`/admin/bookings`):**
  - Paginated queue of all campus bookings with multi-criteria filters (status, venue, date range).
  - Detailed booking inspection view with organiser identity and event scope.
  - **Atomic Approval:** Re-validates slot availability at the moment of approval to resolve racing pending requests.
  - **Cascade Warning:** Upon approving a request, warns the manager of other pending requests that now clash, with one-click rejection shortcuts.
  - Provide optional decision notes for audit trails.
  - State machine lifecycle: mark past approved events as `completed`, or cancel approved bookings when emergency maintenance arises.
- **Analytics & Utilisation Dashboard (`/admin/dashboard`):**
  - Today's active events schedule in IST.
  - Next 7 days forecast and urgent pending review banners.
  - Period-based room utilisation rates (booked hours / operational hours excluding maintenance days) for `This Week`, `This Month`, or custom dates.
  - Revenue aggregation (total campus revenue and venue breakdown).

---

## 🛠️ Technology Stack

- **Runtime & Framework:** Node.js (v18+) & Express.js 5
- **Template Engine:** EJS (Server-Side Rendered) with `express-ejs-layouts`
- **Styling:** Custom Vanilla CSS Design System with responsive mobile breakpoints, modern typography (*Space Grotesk* + *Plus Jakarta Sans*), and accessible focus states
- **Database & ODM:** MongoDB & Mongoose 9
- **Session Management:** `express-session` backed by `connect-mongo` (supports active in-memory and Atlas connections)
- **Security & Hardening:**
  - `helmet`: Content Security Policy and HTTP security headers
  - `bcryptjs`: Salted password hashing (cost factor 10)
  - `express-validator`: Server-side input sanitization and schema verification
  - `express-rate-limit`: Brute-force protection on `/auth/login` and `/auth/register`
- **Development & Logging:** `morgan` for HTTP request logging in development, `dotenv` for environment variables, `nodemon` for auto-reloading

---

## 📁 Folder Structure (MVC)

```text
assignment2/
├── config/
│   ├── db.js                 # Unified database connection (MongoDB Atlas vs In-Memory)
│   └── settings.js           # Campus operating hours (08:00-22:00), IST timezone, limits
├── controllers/
│   ├── adminBookingController.js  # Admin booking review, decisions, and lifecycle
│   ├── adminVenueController.js    # Admin venue CRUD & maintenance block management
│   ├── authController.js          # Authentication (register, login, logout)
│   ├── bookingController.js       # Organiser reservation form, submission, & personal bookings
│   ├── homeController.js          # Landing page showcase
│   └── venueBrowseController.js   # Public/organiser venue search & filters
├── middleware/
│   ├── auth.js               # requireLogin, requireRole('admin'|'organiser'), requireGuest
│   ├── errorHandler.js       # Accessible 404 & centralized 500 error handlers
│   ├── rateLimiter.js        # Rate limiting on authentication endpoints
│   └── validators.js         # express-validator schemas for auth forms
├── models/
│   ├── Booking.js            # Booking schema, compound indexes, and status enum
│   ├── User.js               # User accounts with password hashing & compare methods
│   └── Venue.js              # Venue schema with facilities and embedded maintenance blocks
├── public/
│   ├── css/
│   │   └── style.css         # Complete design system tokens, responsive mobile rules
│   └── js/
│       └── main.js           # Vanilla JS helpers (alert dismissals, dialogs)
├── routes/
│   ├── admin.js              # Admin root and dashboard routing
│   ├── adminBookings.js      # Admin booking action routes
│   ├── adminVenues.js        # Admin venue management routes
│   ├── auth.js               # Authentication endpoints
│   ├── bookings.js           # Organiser reservation routes
│   ├── index.js              # Public root routes
│   └── venues.js             # Public venue exploration routes
├── seed/
│   └── seed.js               # Comprehensive idempotent database seed script
├── services/
│   ├── availabilityService.js     # Mathematical interval overlap & maintenance checking
│   ├── dashboardService.js        # Utilisation and revenue analytics calculations
│   ├── suggestionService.js       # Alternative slot & alternative venue recommendation engine
│   ├── timeHelper.js              # IST <-> UTC date conversions and formatters
│   └── venueSearchService.js      # MongoDB query builder for venue search
├── tests/
│   ├── adminBookings.test.js      # Admin filtering and status transition tests
│   ├── auth.test.js               # Auth, password hashing, and middleware guards
│   ├── availability.test.js       # Overlap formulas, back-to-back allowance, maintenance
│   ├── bookingStatus.test.js      # State machine rules and approval re-checks
│   ├── dashboard.test.js          # Hand-checked utilisation and revenue calculations
│   ├── inMemoryDb.test.js         # In-memory database connectivity tests
│   ├── suggestions.test.js        # Alternative slot windows and venue ranking tests
│   ├── venueModel.test.js         # Venue schema, constraints, and maintenance blocks
│   └── venueSearch.test.js        # Filter queries (capacity, facilities, price cap)
├── views/
│   ├── errors/               # 403, 404, and 500 error views
│   ├── layouts/              # Master EJS layout (main.ejs)
│   ├── pages/                # Application views (admin, auth, bookings, venues)
│   └── partials/             # Header, footer, and flash message partials
├── .env.example              # Environment configuration template
├── package.json              # Project dependencies and npm scripts
└── server.js                 # Express application bootloader
```

---

## ⚡ Setup & Quickstart

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd assignment2

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Review the `.env` variables:
```env
# Application Port
PORT=3001

# Environment ('development' or 'production')
NODE_ENV=development

# Session Encryption Key
SESSION_SECRET=venue_sync_secure_development_secret_key_2026

# Database Configuration:
# Leave blank to use the built-in IN-MEMORY database (Default for development)
# Or provide a MongoDB Atlas connection URI:
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/venuesync
USE_MEMORY_DB=true
```

---

## 💾 In-Memory Mode vs Real Database Mode

| Feature | In-Memory Mode (`USE_MEMORY_DB=true`) | Real Database Mode (`MONGODB_URI=...`) |
| :--- | :--- | :--- |
| **Setup Required** | None. Zero configuration required. | MongoDB Atlas cluster or local MongoDB service. |
| **Under the Hood** | `mongodb-memory-server` spins up a dedicated binary. | Native Mongoose connection to external replica set. |
| **Data Lifecycle** | Reset cleanly upon server restart. Auto-seeded on start. | Persists across server restarts. |
| **Production Use** | **Strictly Forbidden.** Server will refuse to boot if `NODE_ENV=production` without `MONGODB_URI`. | **Required** for production deployment (Render). |

---

## 🔑 Seed Command & Demo Credentials

When running in in-memory mode, the server automatically executes `seedDatabase()` on startup. You can also manually trigger the seed script:
```bash
npm run seed
```

### Ready-to-Use Accounts:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin (Venue Manager)** | `admin@venue.test` | `Admin@123` | Full dashboard, venue CRUD, booking approvals/rejections |
| **Organiser 1** | `organiser1@venue.test` | `Org@12345` | Venue browsing, reservation requests, booking cancellations |
| **Organiser 2** | `organiser2@venue.test` | `Org@12345` | Second organiser for multi-user conflict simulations |

---

## 🧪 Running Automated Tests

VenueSync comes with a comprehensive suite of unit and integration tests executing with Node's native test runner (`node --test`). Tests run against isolated in-memory instances:

```bash
npm test
```

### Test Coverage Highlights:
- **`tests/availability.test.js`**: Exact overlaps, partial start/end overlaps, fully contained slots, back-to-back allowance, maintenance block conflicts, and exclusion of pending bookings.
- **`tests/suggestions.test.js`**: Free slot generation within operational hours (`08:00–22:00 IST`), multi-day forward searches, and venue ranking algorithms (closest capacity fit, then lowest cost).
- **`tests/bookingStatus.test.js`**: Allowed/forbidden lifecycle state machine transitions, completion guards, and approval re-checks.
- **`tests/dashboard.test.js`**: Hand-verified mathematical calculations for room utilisation percentage and revenue aggregations.
- **`tests/venueSearch.test.js`**: Multi-facility `$all` query verification, capacity filtering, and price caps.
- **`tests/auth.test.js`**: Route access controls, password verification, and role-based redirects.

---

## 📐 How Overlap Prevention & Suggestions Work

### 1. Mathematical Interval Overlap Rule
A proposed booking slot $[T_{\text{start}}, T_{\text{end}}]$ conflicts with an existing reservation $[E_{\text{start}}, E_{\text{end}}]$ if and only if:
$$\left(T_{\text{start}} < E_{\text{end}}\right) \land \left(T_{\text{end}} > E_{\text{start}}\right)$$

**Key Properties:**
- **Approved Only:** Only bookings with status `approved` block a slot. Pending requests do **not** block other users from requesting the same slot.
- **Back-to-Back Allowed:** When $T_{\text{end}} = E_{\text{start}}$ or $T_{\text{start}} = E_{\text{end}}$, the formula evaluates to `false`. Back-to-back reservations without gaps are completely valid.
- **Maintenance Blocking:** Venue maintenance intervals $[M_{\text{from}}, M_{\text{to}}]$ are evaluated using the identical overlap condition.
- **Timezone Normalization:** All user inputs in Indian Standard Time (IST, UTC+05:30) are converted to canonical UTC timestamps before query evaluation.

### 2. Smart Suggestion Engine (`services/suggestionService.js`)
When a booking request conflicts with an existing approved event or maintenance block:
1. **Alternative Slots at Same Venue:**
   - Scans the requested day from `08:00` to `22:00` IST in 30-minute intervals for free windows matching the requested duration.
   - Searches the subsequent 2 calendar days for available slots.
   - Computes time distance from the user's requested start time:
     $$\Delta t = |S_{\text{suggested}} - S_{\text{requested}}|$$
   - Orders suggestions by closeness to the user's initial preference (up to 5 slots).
2. **Alternative Venues at Requested Time:**
   - Finds all active campus venues that are completely free at the user's requested time window.
   - Filters out venues with insufficient seating capacity (`capacity < attendees`) or missing any required equipment.
   - Ranks candidate venues using a two-tier sorting algorithm:
     1. **Closest Capacity Match:** Minimizes wasted seats $(C_{\text{venue}} - A_{\text{attendees}})$ ascending.
     2. **Lowest Total Cost:** Breaks capacity ties by total cost $(\text{hourlyRate} \times \text{durationHours})$ ascending.
3. **One-Click Pre-Filled Booking:**
   - Every suggestion renders a direct action button: **"Use this slot &rarr;"** or **"Book this venue &rarr;"**.
   - Preserves all entered data (event title, description, attendees, date, time) in query parameters.
   - Full server-side re-validation is executed upon submission to prevent race conditions.
