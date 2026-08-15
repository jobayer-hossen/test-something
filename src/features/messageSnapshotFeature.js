// features/messageSnapshotFeature.js
const MessageSnapshot = require("../database/schemas/MessageSnapshot");
const Logger = require("../logger");

const logger = new Logger("MessageSnapshot");

class MessageSnapshotFeature {
  constructor(client) {
    this.client = client;
    this.initialize();
  }

  initialize() {
    // Track new messages
    this.client.on("messageCreate", (message) => {
      if (!message.guild) return;
      this.saveSnapshot(message).catch(() => {});
    });

    // Track edits
    this.client.on("messageUpdate", (oldMessage, newMessage) => {
      if (!newMessage.guild) return;
      if (!newMessage.content && !oldMessage.content) return;
      this.handleEdit(oldMessage, newMessage).catch(() => {});
    });

    // Track deletions
    this.client.on("messageDelete", (message) => {
      if (!message.guild) return;
      this.handleDelete(message).catch(() => {});
    });

    logger.info("✅ MessageSnapshot feature initialized");
  }

  async saveSnapshot(message) {
    try {
      if (!message.id || !message.guild) return;

      const attachments = message.attachments
        ? [...message.attachments.values()].map((a) => ({
            url: a.url,
            name: a.name,
            contentType: a.contentType,
          }))
        : [];

      await MessageSnapshot.findOneAndUpdate(
        { messageId: message.id },
        {
          $setOnInsert: {
            messageId: message.id,
            guildId: message.guild.id,
            channelId: message.channel.id,
            channelName: message.channel.name || "unknown",
            authorId: message.author?.id || "unknown",
            authorUsername: message.author?.username || "unknown",
            authorTag: message.author?.tag || message.author?.username || "unknown",
            content: message.content || "",
            attachments,
            hasEmbeds: message.embeds?.length > 0,
            messageCreatedAt: message.createdAt,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      // Silently fail - non-critical
      if (!err.message.includes("duplicate key")) {
        logger.debug("Error saving snapshot:", err.message);
      }
    }
  }

  async handleEdit(oldMessage, newMessage) {
    try {
      if (!newMessage.id) return;

      const oldContent = oldMessage.content || "";
      const newContent = newMessage.content || "";

      if (oldContent === newContent) return;

      await MessageSnapshot.findOneAndUpdate(
        { messageId: newMessage.id },
        {
          $set: { content: newContent },
          $push: {
            editHistory: {
              content: oldContent,
              editedAt: new Date(),
            },
          },
          $setOnInsert: {
            messageId: newMessage.id,
            guildId: newMessage.guild.id,
            channelId: newMessage.channel.id,
            channelName: newMessage.channel.name || "unknown",
            authorId: newMessage.author?.id || "unknown",
            authorUsername: newMessage.author?.username || "unknown",
            authorTag: newMessage.author?.tag || "unknown",
            messageCreatedAt: newMessage.createdAt,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.debug("Error handling edit:", err.message);
    }
  }

  async handleDelete(message) {
    try {
      if (!message.id) return;

      await MessageSnapshot.findOneAndUpdate(
        { messageId: message.id },
        {
          $set: {
            deleted: true,
            deletedAt: new Date(),
          },
        }
      );
    } catch (err) {
      logger.debug("Error handling delete:", err.message);
    }
  }

  // Get snapshot for a message (used by mod commands)
  static async getSnapshot(messageId) {
    try {
      return await MessageSnapshot.findOne({ messageId });
    } catch (err) {
      return null;
    }
  }

  // Get recent messages from a user in a channel
  static async getRecentMessages(userId, channelId, limit = 10) {
    try {
      return await MessageSnapshot.find({ authorId: userId, channelId })
        .sort({ messageCreatedAt: -1 })
        .limit(limit);
    } catch (err) {
      return [];
    }
  }
}

module.exports = MessageSnapshotFeature;