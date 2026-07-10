const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

// ✅ Add more commands here in the future easily
const TRACKED_COMMANDS = [
  {
    id: 'legendary_toothbrush',       // Unique ID for database
    label: 'RPG Use Legendary Toothbrush', // Display name
    patterns: [
      'rpg use legendary toothbrush',
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

  // ✅ Track message
  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (message.author.bot) return;
      if (!message.content) return;

      const matched = this.getMatchedCommand(message.content);
      if (!matched) return;

      await CommandTracker.create({
        userId: message.author.id,
        username: message.author.username,
        displayName: message.member?.displayName || message.author.username,
        command: matched.id,
        usedAt: new Date()
      });

      logger.debug(`✅ Tracked [${matched.id}] for ${message.author.username}`);
    } catch (err) {
      logger.error('Error tracking command:', err);
    }
  }

  // ✅ Get today's stats for a command
  async getTodayStats(commandId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Total usage today
    const totalToday = await CommandTracker.countDocuments({
      command: commandId,
      usedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Top 10 users today
    const top10 = await CommandTracker.aggregate([
      {
        $match: {
          command: commandId,
          usedAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: '$userId',
          username: { $last: '$username' },
          displayName: { $last: '$displayName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return { totalToday, top10 };
  }

  // ✅ Get available tracked commands list
  getTrackedCommands() {
    return TRACKED_COMMANDS;
  }
}

module.exports = CommandTrackerFeature;