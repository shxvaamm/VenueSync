require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const methodOverride = require('method-override');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.MongoStore || connectMongo;
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const connectDB = require('./config/db');
const { notFoundHandler, centralErrorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (for Render and HTTPS termination)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Connect to MongoDB Atlas / Local Database
connectDB();

// Security Headers with Helmet (configured for Google Fonts & inline styles)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  })
);

// Body Parsers & Method Override
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Configure View Engine & EJS Layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Configure Session Store with MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/event_venue_booking';
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hackathon_default_secret_event_venue_booking',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day session TTL
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  })
);

// Flash Messages Middleware
app.use(flash());

// Global Template Variables
app.use((req, res, next) => {
  res.locals.currentUser = req.session.currentUser || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.info_msg = req.flash('info_msg');
  res.locals.currentPath = req.path;
  next();
});

// Mount Routes
app.use('/', require('./routes/index'));

// 404 Handler
app.use(notFoundHandler);

// Centralized 500 Error Handler
app.use(centralErrorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] VenueSync listening on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
