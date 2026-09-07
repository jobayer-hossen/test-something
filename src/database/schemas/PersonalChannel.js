// database/schemas/PersonalChannel.js - Updated with previousCategoryId
const mongoose = require('mongoose');

const personalChannelSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true, unique: true },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  friends: { type: [String], default: [] },
  categoryId: { type: String, default: null }, // Track which category the channel is in
  previousCategoryId: { type: String, default: null }, // Track previous category for booster transitions
});

module.exports = mongoose.model('PersonalChannel', personalChannelSchema);