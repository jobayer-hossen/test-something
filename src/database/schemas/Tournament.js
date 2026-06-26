const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  guildId: String,
  channelId: String,
  participants: [{
    userId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now },
  }],
  bracket: [[{
    userId: String,
    username: String,
  }]],
  currentRound: { type: Number, default: 0 },
  winner: {
    userId: String,
    username: String,
  },
  badgeAwarded: String,
  startedAt: Date,
  endsAt: Date,
  phase: {
    type: String,
    enum: ['waiting', 'battling', 'finished'],
    default: 'waiting',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Tournament', tournamentSchema);