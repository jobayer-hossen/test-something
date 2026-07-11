// CommandTracker.js (Schema)
const mongoose = require('mongoose');

const commandTrackerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    default: null
  },
  command: {
    type: String,
    required: true,
    index: true
  },
  count: {
    type: Number,
    default: 0
  },
  date: {
    type: String,  // "2026-07-10" format
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// ✅ Unique: one document per user per command per day
commandTrackerSchema.index({ userId: 1, command: 1, date: 1 }, { unique: true });

// ✅ Query optimization
commandTrackerSchema.index({ command: 1, date: 1 });
commandTrackerSchema.index({ date: 1 });

module.exports = mongoose.model('CommandTracker', commandTrackerSchema);