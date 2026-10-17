// database/schemas/PersonalChannel.js - Updated with previousCategoryId and category position history
const mongoose = require('mongoose');

const personalChannelSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true, unique: true },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  friends: { type: [String], default: [] },
  categoryId: { type: String, default: null }, // Track which category the channel is in
  previousCategoryId: { type: String, default: null }, // Track previous category for booster/trusted/summoner transitions
  categoryPositionHistory: { type: mongoose.Schema.Types.Mixed, default: {} }, // Tracks last known index per categoryId, e.g. { "123456789": 4, "987654321": 1 }
});

module.exports = mongoose.model('PersonalChannel', personalChannelSchema);