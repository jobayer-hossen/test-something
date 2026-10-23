const mongoose = require('mongoose');

const mentionReactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  reactEmoji: {
    type: String,
    default: null,
  },
  respondContent: {
    type: String,
    default: null,
  },
  respondType: {
    type: String,
    enum: ['gif', 'emoji', null],
    default: null,
  },
  setBy: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('MentionReaction', mentionReactionSchema);