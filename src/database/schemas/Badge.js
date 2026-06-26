const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  badges: {
    type: [String],
    default: [],
  },
  isTournamentMaster: { type: Boolean, default: false },
  tournamentMasterAwardedAt: Date,
  tournamentsWon: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const ALL_BADGES = ['🔥', '💧', '⚡', '🌪️', '🌈', '❄️', '🌿'];

badgeSchema.methods.hasAllBadges = function () {
  return ALL_BADGES.every((b) => this.badges.includes(b));
};

badgeSchema.statics.ALL_BADGES = ALL_BADGES;

module.exports = mongoose.model('Badge', badgeSchema);