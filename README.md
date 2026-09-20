# Event & Venue Booking Management System (VenueSync)

An enterprise-grade campus and community event and venue booking management platform built with Node.js, Express, EJS, and MongoDB Atlas. Designed for conflict-free slot scheduling, transparent review pipelines, and role-based workflows.

---

## 🚀 Tech Stack

- **Frontend:** Server-Side Rendered (SSR) with EJS and `express-ejs-layouts`, custom modern CSS design system, minimal vanilla JavaScript for micro-interactions.
- **Backend:** Node.js & Express.js (MVC architecture).
- **Database:** MongoDB Atlas via Mongoose with `connect-mongo` session persistence.
- **Authentication & Security:** Session-based authentication (`express-session` + `connect-mongo`), `bcryptjs` for salted password hashing, `helmet` for HTTP security headers, and `express-validator`.
- **Utilities:** `dotenv` for environment configuration, `connect-flash` for flash alerts, `method-override` for RESTful verb support.
- **Deployment Target:** Render (`web` service).

---

## 👥 User Roles

1. **Organiser:**
   - Self-registers through public onboarding.
   - Searches and inspects campus venues.
   - Requests bookings with real-time validation.
   - Tracks personal booking history and approval status.

2. **Admin (Venue Manager):**
   - Provisioned **strictly** via an administrative seed script (`npm run seed:admin`), never through public registration.
   - Manages venue inventories, capacity, and equipment availability.
   - Reviews, approves, or rejects booking requests with reason tracking.
   - Resolves booking conflicts and enforces campus policy.

---

## ⚙️ Campus System Configuration (`config/settings.js`)

- **Operating Hours:** `08:00` to `22:00` (8:00 AM &ndash; 10:00 PM IST)
- **Timezone:** `Asia/Kolkata` (Indian Standard Time)
- **Minimum Booking Duration:** `1 hour`
- **Maximum Booking Duration:** `12 hours`

---

## 📁 Project Structure (MVC)

```text
assignment2/
├── config/
│   ├── db.js                 # MongoDB connection logic
│   └── settings.js           # Operating hours, timezone, and duration limits
├── controllers/
│   └── homeController.js     # Home & landing page controller
├── middleware/
│   └── errorHandler.js       # 404 and central error handling middleware
├── models/
│   └── .gitkeep              # Mongoose schemas (Phase 2)
├── public/
│   ├── css/
│   │   └── style.css         # Custom design system tokens, typography, and components
│   └── js/
│       └── main.js           # Vanilla JS client utilities (alert dismissals, etc.)
├── routes/
│   └── index.js              # Central application routes
├── seed/
│   └── .gitkeep              # Seed scripts (Phase 2 Admin provisioner)
├── services/
│   └── .gitkeep              # Reusable domain business logic
├── views/
│   ├── errors/
│   │   ├── 404.ejs           # Accessible 404 page with action buttons
│   │   └── 500.ejs           # Central error page with developer traces in dev mode
│   ├── layouts/
│   │   └── main.ejs          # Master layout with skip link, header, flash, & footer
│   ├── pages/
│   │   └── index.ejs         # Landing page and design system showcase
│   └── partials/
│       ├── flash.ejs         # Styled flash message alerts
│       ├── footer.ejs        # Footer with operational hours and policy
│       └── header.ejs        # Role-aware navigation (Guest, Organiser, Admin)
├── .env.example              # Template for environment variables
├── .gitignore                # Production git ignore rules
├── package.json              # Project metadata, dependencies, and scripts
├── README.md                 # Project documentation
└── server.js                 # Application entrypoint
```

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance (local `mongod` on port 27017 or a MongoDB Atlas connection URI)

### 2. Installation
```bash
# Clone repository
git clone <repo-url>
cd assignment2

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and set your secrets:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/event_venue_booking
SESSION_SECRET=your_super_secret_session_key
PORT=3000
NODE_ENV=development
```

### 4. Running Without a Database (In-Memory Mode)

You can run and test the complete application locally without an external MongoDB Atlas cluster or local MongoDB daemon. The system includes an in-memory database fallback using `mongodb-memory-server`:

1. In `.env`, leave `MONGODB_URI` blank (or omit it) and set:
   ```env
   USE_MEMORY_DB=true
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. The server will automatically spin up an ephemeral in-memory database and output:
   `Running on IN-MEMORY database. Data resets on restart.`
4. To run automated tests using the in-memory database helper:
   ```bash
   npm test
   ```

*(Note: Production mode strictly prohibits in-memory databases and requires a persistent `MONGODB_URI`.)*

### 5. Running the Server (Normal Mode)

- **Development Mode (with auto-reload via nodemon):**
  ```bash
  npm run dev
  ```

- **Production Mode:**
  ```bash
  npm start
  ```

Visit [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🎨 Design System Highlights (`public/css/style.css`)
- **Typography:** Distinctive modern combination of *Space Grotesk* for headings and *Plus Jakarta Sans* for clean, legible body text.
- **Palette:** Slate & Deep Indigo `#4338ca` paired with semantic tokens.
- **Status Badges:** Explicit styles for `Pending`, `Approved`, `Rejected`, `Completed`, and `Cancelled`.
- **Buttons:** Action-focused button labelling ("Save venue", "Cancel reservation", "Request reservation").
- **Form Error Feedback:** Contextual inline error messages detailing what failed and how to remedy it.
- **Accessibility:** Visible focus rings (`:focus-visible`), skip-to-content links, and high contrast text ratios.
