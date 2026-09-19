const mongoose = require('mongoose');

const summonerResultSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  toothbrushCount: {
    type: Number,
    required: true,
  },
  hadRole: {
    type: Boolean,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['awarded', 'kept', 'removed', 'manual_override_skip'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const summonerPeriodSchema = new mongoose.Schema({
  periodNumber: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'evaluating', 'completed'],
    default: 'active',
    index: true,
  },
  evaluationDate: {
    type: Date,
    default: null,
  },
  wasDelayed: {
    type: Boolean,
    default: false,
  },
  results: [summonerResultSchema],
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

summonerPeriodSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('SummonerPeriod', summonerPeriodSchema);