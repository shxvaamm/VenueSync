const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: [true, 'Venue reference is required']
  },
  organiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organiser reference is required']
  },
  eventName: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  attendees: {
    type: Number,
    required: [true, 'Expected attendee count is required'],
    min: [1, 'Attendees count must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Attendee count must be an integer'
    }
  },
  start: {
    type: Date,
    required: [true, 'Start date/time is required']
  },
  end: {
    type: Date,
    required: [true, 'End date/time is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  decisionNote: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Composite index for fast conflict checking on venue + slot + status
bookingSchema.index({ venue: 1, start: 1, end: 1, status: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
