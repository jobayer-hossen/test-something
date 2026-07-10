const mongoose = require('mongoose');

const commandTrackerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
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
    required: true // e.g. "legendary_toothbrush"
  },
  usedAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 48 // ✅ Auto delete after 48 hours (2 days)
  }
});

// Index for fast queries
commandTrackerSchema.index({ command: 1, usedAt: -1 });
commandTrackerSchema.index({ userId: 1, command: 1 });

module.exports = mongoose.model('CommandTracker', commandTrackerSchema);