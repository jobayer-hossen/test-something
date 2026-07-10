const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

const TRACKED_COMMANDS = [
  {
    id: 'legendary_toothbrush',
    label: 'RPG Use Legendary Toothbrush',
    patterns: [
      'rpg use legendary toothbrush'
    ]
  }
  // Future example:
  // {
  //   id: 'coin_trumpet',
  //   label: 'RPG Use Coin Trumpet',
  //   patterns: ['rpg use coin trumpet']
  // }
];

// ✅ Get today's date string like "2026-07-10"
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ✅ Get expire date (2 days from now)
function getExpireDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date;
}

class CommandTrackerFeature {
  constructor(client) {
    this.client = client;
  }

  // ✅ Check if message matches any tracked command
  getMatchedCommand(content) {
    const normalized = content.toLowerCase().trim();

    for (const cmd of TRACKED_COMMANDS) {
      for (const pattern of cmd.patterns) {
        if (normalized === pattern || normalized.startsWith(pattern)) {
          return cmd;
        }
      }
    }

    return null;
  }

  // ✅ Track message - increment count instead of creating new document
  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (message.author.bot) return;
      if (!message.content) return;

      const matched = this.getMatchedCommand(message.content);
      if (!matched) return;

      const today = getTodayString();

      // ✅ Find existing document for this user+command+day and increment
      // If not found, create new one with count: 1
      await CommandTracker.findOneAndUpdate(
        {
          userId: message.author.id,
          command: matched.id,
          date: today
        },
        {
          $inc: { count: 1 }, // ✅ Increment count by 1
          $set: {
            username: message.author.username,
            displayName: message.member?.displayName || message.author.username,
            expireAt: getExpireDate() // ✅ Refresh expire date
          }
        },
        {
          upsert: true, // ✅ Create if not exists
          new: true
        }
      );

      logger.debug(`✅ Tracked [${matched.id}] for ${message.author.username} on ${today}`);
    } catch (err) {
      logger.error('Error tracking command:', err);
    }
  }

  // ✅ Get today's stats for a command
  async getTodayStats(commandId) {
    const today = getTodayString();

    // Total usage today (sum of all counts)
    const totalResult = await CommandTracker.aggregate([
      {
        $match: {
          command: commandId,
          date: today
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' }
        }
      }
    ]);

    const totalToday = totalResult[0]?.total || 0;

    // Top 10 users today
    const top10 = await CommandTracker.find({
      command: commandId,
      date: today
    })
      .sort({ count: -1 })
      .limit(10)
      .lean();

    return { totalToday, top10 };
  }

  getTrackedCommands() {
    return TRACKED_COMMANDS;
  }
}

module.exports = CommandTrackerFeature;