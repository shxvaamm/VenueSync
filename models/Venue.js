const mongoose = require('mongoose');

const blockedDateSchema = new mongoose.Schema({
  from: {
    type: Date,
    required: [true, 'Block start date/time is required']
  },
  to: {
    type: Date,
    required: [true, 'Block end date/time is required']
  },
  reason: {
    type: String,
    trim: true,
    default: 'Scheduled maintenance'
  }
});

const venueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Venue name is required'],
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1 person'],
    validate: {
      validator: Number.isInteger,
      message: 'Capacity must be a whole integer'
    }
  },
  facilities: {
    type: [String],
    default: []
  },
  hourlyRate: {
    type: Number,
    required: [true, 'Hourly rate is required'],
    min: [0, 'Hourly rate cannot be negative'],
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  blockedDates: [blockedDateSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Venue = mongoose.models.Venue || mongoose.model('Venue', venueSchema);

module.exports = Venue;
