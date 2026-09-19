const Logger = require('../logger');
const User = require('../database/schemas/User');

const logger = new Logger('ActivityTracker');

class ActivityTracker {
  constructor(client) {
    this.client = client;
    this.updateQueue = new Map();
    this.flushInterval = null;
  }

  initialize() {
    this.startBatchUpdates();
  }

  startBatchUpdates() {
    this.flushInterval = setInterval(() => {
      this.flushQueue();
    }, 30000);
  }

  async trackActivity(message) {
    try {
      // ONLY track real users
      if (message.author.bot) return;
      if (message.webhookId) return;
      if (!message.inGuild()) return;

      const userId = message.author.id;
      const username = message.author.username;

      this.updateQueue.set(userId, {
        userId,
        username,
        timestamp: new Date(),
      });

    } catch (error) {
      logger.error('Error tracking activity:', error);
    }
  }

  async flushQueue() {
    if (this.updateQueue.size === 0) return;

    const updates = Array.from(this.updateQueue.values());
    this.updateQueue.clear();

    try {
      const bulkOps = updates.map(data => ({
        updateOne: {
          filter: { userId: data.userId },
          update: {
            $set: {
              lastMessageDate: data.timestamp,
              username: data.username,
              lastSeen: data.timestamp,
            },
          },
          upsert: true,
        },
      }));

      if (bulkOps.length > 0) {
        await User.bulkWrite(bulkOps, { ordered: false });
      }

    } catch (error) {
      logger.error('Error flushing activity queue:', error);
    }
  }

  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushQueue();
  }
}

module.exports = ActivityTracker;