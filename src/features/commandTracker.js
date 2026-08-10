const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

const EPIC_RPG_BOT_ID = '555955826880413696';

const TRACKED_COMMANDS = [
  {
    id: 'legendary_toothbrush',
    label: 'Legendary Toothbrush',
    triggerPatterns: [
      /^rpg\s+use\s+legendary\s+toothbrush/i,
      /^rpg\s+u\s+legendary\s+toothbrush/i,
    ],
    responsePatterns: [
      /casts a magic spell with the .*?legendary toothbrush/i
    ]
  },
];

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function normalizeName(str) {
  return str
    .toLowerCase()
    .replace(/[*_`~.\s]/g, '')
    .trim();
}

class CommandTrackerFeature {
  constructor(client) {
    this.client = client;
    
    this.commandQueue = [];
    // ✅ Track recently counted (userId_commandId → timestamp)
    this.recentlyTracked = new Map();

    setInterval(() => {
      const now = Date.now();
      const oldSize = this.commandQueue.length;
      this.commandQueue = this.commandQueue.filter(
        item => (now - item.timestamp) < 30000
      );
      if (oldSize > this.commandQueue.length) {
        logger.info(`🧹 Queue cleaned: ${oldSize} → ${this.commandQueue.length}`);
      }

      // ✅ Clean recentlyTracked (older than 1 second)
      for (const [key, timestamp] of this.recentlyTracked.entries()) {
        if (now - timestamp > 1000) {
          this.recentlyTracked.delete(key);
        }
      }
    }, 10000);
  }

  handleUserMessage(message) {
    if (message.author.bot) return;

    const content = message.content.trim();

    for (const cmd of TRACKED_COMMANDS) {
      for (const trigger of cmd.triggerPatterns) {
        if (trigger.test(content)) {
          this.commandQueue.push({
            userId: message.author.id,
            username: message.author.username,
            displayName: message.member?.displayName || message.author.globalName || message.author.username,
            timestamp: Date.now(),
            commandId: cmd.id
          });

          // logger.info(`📝 [QUEUED] ${message.author.username} | Queue: ${this.commandQueue.length}`);
          return;
        }
      }
    }
  }

  async handleEpicRPGMessage(message) {
    if (message.author.id !== EPIC_RPG_BOT_ID) return;
    if (!message.content) return;

    const firstLine = message.content.trim().split('\n')[0];

    let matchedCmd = null;
    for (const cmd of TRACKED_COMMANDS) {
      for (const pattern of cmd.responsePatterns) {
        if (pattern.test(firstLine)) {
          matchedCmd = cmd;
          break;
        }
      }
      if (matchedCmd) break;
    }

    if (!matchedCmd) return;

    const nameMatch = firstLine.match(/^(.+?)\s+(casts|plays|uses)/i);
    if (!nameMatch) return;

    const epicRPGName = nameMatch[1].replace(/[*_`~]/g, '').trim();
    const epicRPGNameNorm = normalizeName(epicRPGName);

    let bestMatch = null;
    let bestScore = -1;

    for (const queued of this.commandQueue) {
      if (queued.commandId !== matchedCmd.id) continue;

      const queuedDisplayNorm = normalizeName(queued.displayName);
      const queuedUsernameNorm = normalizeName(queued.username);

      let nameScore = 0;
      if (queuedDisplayNorm === epicRPGNameNorm) nameScore = 100;
      else if (queuedUsernameNorm === epicRPGNameNorm) nameScore = 100;
      else if (queuedDisplayNorm.includes(epicRPGNameNorm) || epicRPGNameNorm.includes(queuedDisplayNorm)) nameScore = 80;
      else if (queuedUsernameNorm.includes(epicRPGNameNorm) || epicRPGNameNorm.includes(queuedUsernameNorm)) nameScore = 80;
      else continue;

      const timeDiffMs = Date.now() - queued.timestamp;
      const recencyScore = Math.max(0, 100 - (timeDiffMs / 1000));

      const totalScore = nameScore + recencyScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = queued;
      }
    }

    if (!bestMatch) {
      logger.warn(`⚠️ [NO MATCH] "${epicRPGName}" | Queue empty or no match`);
      return;
    }

    // ✅ NEW: Check if already counted in last 1 second (prevents duplicate responses)
    const trackKey = `${bestMatch.userId}_${matchedCmd.id}`;
    const now = Date.now();

    if (this.recentlyTracked.has(trackKey)) {
      const lastTrackTime = this.recentlyTracked.get(trackKey);
      if (now - lastTrackTime < 1000) {
        // logger.warn(`⚠️ [DEBOUNCE] Already counted in last 1 second`);
        return; // Skip duplicate response
      }
    }

    // ✅ Mark as tracked
    this.recentlyTracked.set(trackKey, now);

    // ✅ DON'T remove from queue - keep for duplicate responses within 1 second
    // Queue cleanup will handle it after 30 seconds

    const today = getTodayString();

    const member = message.guild.members.cache.get(bestMatch.userId);
    const latestDisplayName = member?.displayName || bestMatch.displayName;

    try {
      const result = await CommandTracker.findOneAndUpdate(
        {
          userId: bestMatch.userId,
          command: matchedCmd.id,
          date: today
        },
        {
          $inc: { count: 1 },
          $set: {
            username: bestMatch.username,
            displayName: latestDisplayName,
            lastUpdated: new Date()
          }
        },
        { upsert: true, new: true }
      );

      logger.info(`✅ [TRACKED] ${latestDisplayName} (${bestMatch.userId}) → count: ${result.count}`);

    } catch (err) {
      logger.error('Error saving to DB:', err);
    }
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;

      if (message.author.id === EPIC_RPG_BOT_ID) {
        await this.handleEpicRPGMessage(message);
      } else {
        this.handleUserMessage(message);
      }

    } catch (err) {
      logger.error('Error in CommandTracker.handleMessage:', err);
    }
  }
}

module.exports = CommandTrackerFeature;