const mongoose = require('mongoose');

const personalChannelSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true, unique: true },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  friends: { type: [String], default: [] },
});

module.exports = mongoose.model('PersonalChannel', personalChannelSchema);