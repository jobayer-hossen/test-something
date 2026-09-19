const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    default: 'Unknown',
  },
  level: {
    type: Number,
    default: 1,
  },
  xp: {
    type: Number,
    default: 0,
  },
  coins: {
    type: Number,
    default: 0,
  },
  commandsUsed: {
    type: Number,
    default: 0,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  
  // Inactivity tracking
  lastMessageDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastInactivityCheck: {
    type: Date,
    default: null,
  },
  inactivityExempt: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // Role management
  currentRoles: {
    type: [String],
    default: [],
  },
  rolesLastUpdated: {
    type: Date,
    default: Date.now,
  },
  protectedRoles: {
    type: [String],
    default: [],
  },
  
  // Summoner tracking
  summonerManualOverride: {
    type: Boolean,
    default: false,
  },
  summonerAwardedDate: {
    type: Date,
    default: null,
  },
  summonerAwardedInPeriod: {
    type: Number,
    default: null,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.index({ lastMessageDate: 1, inactivityExempt: 1 });
userSchema.index({ summonerManualOverride: 1 });

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);