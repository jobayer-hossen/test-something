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
    required: true
  },
  count: {
    type: Number,
    default: 1
  },
  date: {
    type: String,  // Store as "2026-07-10" string for easy day matching
    required: true
  },
  expireAt: {
    type: Date,
    expires: 0 // ✅ Auto delete when expireAt date is reached
  }
});

// ✅ One document per user per command per day
commandTrackerSchema.index({ userId: 1, command: 1, date: 1 }, { unique: true });
commandTrackerSchema.index({ command: 1, date: 1 });
commandTrackerSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CommandTracker', commandTrackerSchema);