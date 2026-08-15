// database/schemas/MessageSnapshot.js
const mongoose = require("mongoose");

const messageSnapshotSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    channelName: {
      type: String,
    },
    authorId: {
      type: String,
      required: true,
      index: true,
    },
    authorUsername: {
      type: String,
    },
    authorTag: {
      type: String,
    },

    // Current content
    content: {
      type: String,
      default: "",
    },

    // Edit history
    editHistory: [
      {
        content: String,
        editedAt: { type: Date, default: Date.now },
      },
    ],

    // Attachments
    attachments: [
      {
        url: String,
        name: String,
        contentType: String,
      },
    ],

    // Embeds snapshot
    hasEmbeds: {
      type: Boolean,
      default: false,
    },

    // Deletion tracking
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // Message timestamp
    messageCreatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index - auto-delete snapshots after 30 days
messageSnapshotSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model("MessageSnapshot", messageSnapshotSchema);