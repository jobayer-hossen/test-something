const mongoose = require('mongoose');

const roleChangeLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
  },
  addedRoles: {
    type: [String],
    default: [],
  },
  removedRoles: {
    type: [String],
    default: [],
  },
  changeType: {
    type: String,
    required: true,
    enum: ['bot_action', 'admin_manual', 'external_bot', 'unknown'],
    index: true,
  },
  changedBy: {
    type: String,
    default: 'unknown',
  },
  reason: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  guildId: {
    type: String,
    required: true,
  },
});

roleChangeLogSchema.index({ userId: 1, timestamp: -1 });
roleChangeLogSchema.index({ changeType: 1, timestamp: -1 });

module.exports = mongoose.model('RoleChangeLog', roleChangeLogSchema);