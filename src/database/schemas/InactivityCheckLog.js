const mongoose = require('mongoose');

const inactivityActionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  lastMessageDate: {
    type: Date,
    required: true,
  },
  inactiveDays: {
    type: Number,
    required: true,
  },
  removedRoles: {
    type: [String],
    default: [],
  },
  keptRoles: {
    type: [String],
    default: [],
  },
  reason: {
    type: String,
    default: '',
  },
}, { _id: false });

const inactivityCheckLogSchema = new mongoose.Schema({
  checkDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  usersChecked: {
    type: Number,
    required: true,
    default: 0,
  },
  usersAffected: {
    type: Number,
    required: true,
    default: 0,
  },
  rolesRemoved: {
    type: Number,
    required: true,
    default: 0,
  },
  actions: [inactivityActionSchema],
  executionTime: {
    type: Number,
    default: 0,
  },
  errors: {
    type: [String],
    default: [],
  },
});

inactivityCheckLogSchema.index({ checkDate: -1 });

module.exports = mongoose.model('InactivityCheckLog', inactivityCheckLogSchema);