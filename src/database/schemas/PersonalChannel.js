const mongoose = require('mongoose');

const personalChannelSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  isPrivate: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false }
});

module.exports = mongoose.model('PersonalChannel', personalChannelSchema);