const mongoose = require('mongoose');

const haremSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  ownerUsername: String,
  guildId: { type: String, required: true },
  members: [{
    userId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now },
    totalReceived: { type: Number, default: 0 },
    totalReturned: { type: Number, default: 0 },
  }],
  treasury: { type: Number, default: 0 },
  dailyDistribution: { type: Number, default: 100 },
  lastDistribution: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Harem', haremSchema);