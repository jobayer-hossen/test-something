// database/schemas/ModerationLog.js
const mongoose = require("mongoose");

const moderationLogSchema = new mongoose.Schema(
  {
    // Case identification
    caseId: {
      type: Number,
      required: true,
      unique: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    // Action details
    action: {
      type: String,
      enum: ["WARN", "KICK", "BAN", "TIMEOUT", "UNBAN", "UNWARN", "UNTIMEOUT"],
      required: true,
    },

    // Target user
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    userTag: {
      type: String,
      required: true,
    },

    // Moderator
    moderatorId: {
      type: String,
      required: true,
    },
    moderatorUsername: {
      type: String,
      required: true,
    },
    moderatorTag: {
      type: String,
      required: true,
    },

    // Reason & evidence
    reason: {
      type: String,
      default: "No reason provided",
    },
    evidence: {
      messageContent: String,
      messageId: String,
      channelId: String,
      channelName: String,
      attachments: [String],
      editHistory: [
        {
          content: String,
          editedAt: Date,
        },
      ],
      screenshotUrl: String,
      timestamp: Date,
    },

    // Duration (for timeout)
    duration: {
      type: Number, // milliseconds
      default: null,
    },
    durationString: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },

    // Log message in mod-log channel
    logMessageId: {
      type: String,
      default: null,
    },

    // Active status
    active: {
      type: Boolean,
      default: true,
    },

    // Notes
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-increment caseId per guild
moderationLogSchema.statics.getNextCaseId = async function (guildId) {
  const last = await this.findOne({ guildId }).sort({ caseId: -1 });
  return last ? last.caseId + 1 : 1;
};

// Get all cases for a user
moderationLogSchema.statics.getUserCases = async function (guildId, userId) {
  return this.find({ guildId, userId }).sort({ createdAt: -1 });
};

// Get active warns count
moderationLogSchema.statics.getActiveWarns = async function (guildId, userId) {
  return this.countDocuments({
    guildId,
    userId,
    action: "WARN",
    active: true,
  });
};

module.exports = mongoose.model("ModerationLog", moderationLogSchema);