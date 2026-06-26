const mongoose = require('mongoose');

const bossSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  name: { type: String, default: 'Epic Boss' },
  maxHp: { type: Number, default: 0 },
  currentHp: { type: Number, default: 0 },
  participants: [{
    userId: String,
    username: String,
    damageDealt: { type: Number, default: 0 },
    hits: { type: Number, default: 0 },
  }],
  lastHitter: {
    userId: String,
    username: String,
  },
  spawnedAt: { type: Date, default: Date.now },
  spawnChannelId: String,
  spawnGuildId: String,
  minPlayers: { type: Number, default: 10 },
  isDefeated: { type: Boolean, default: false },
  defeatMessage: String,
});

module.exports = mongoose.model('Boss', bossSchema);