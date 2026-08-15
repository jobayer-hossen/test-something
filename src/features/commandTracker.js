const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

const EPIC_RPG_BOT_ID = '555955826880413696';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

class CommandTrackerFeature {
  constructor(client) {
    this.client = client;
    
    // ✅ epicRPGName → { userId, username, displayName }
    this.userCache = new Map();
    
    // ✅ Track processed Epic RPG message IDs (prevent double count)
    this.processedMessages = new Set();

    // Clean processed messages every 5 minutes
    setInterval(() => {
      this.processedMessages.clear();
    }, 300000);
  }

  // ════════════════════════════════════════════
  // User types "rpg use legendary toothbrush"
  // Get userId, username, displayName — store ONCE
  // ════════════════════════════════════════════
  async handleUserMessage(message) {
    if (message.author.bot) return;

    const content = message.content.trim();

    if (!/^rpg\s+use\s+legendary\s+toothbrush/i.test(content) &&
        !/^rpg\s+u\s+legendary\s+toothbrush/i.test(content)) return;

    const userId = message.author.id;
    const username = message.author.username;
    const displayName = message.member?.displayName || message.author.globalName || message.author.username;

    // logger.info(`👤 [USER] ${username} (${userId})`);

    // ✅ Already in cache — do nothing
    if (this.userCache.has(username)) return;

    // ✅ Check DB — does this userId already exist?
    const existing = await CommandTracker.findOne({ userId }).lean();

    if (existing) {
      this.userCache.set(username, { userId, username, displayName });
      // logger.info(`✅ [LOADED] ${username} from DB`);
      return;
    }

    // ✅ New user — save to cache
    this.userCache.set(username, { userId, username, displayName });
    // logger.info(`🆕 [NEW] ${username} (${userId}) cached`);
  }

  // ════════════════════════════════════════════
  // Epic RPG sends success response — count it
  // ════════════════════════════════════════════
  async handleEpicRPGMessage(message) {
    if (message.author.id !== EPIC_RPG_BOT_ID) return;
    if (!message.content) return;

    const content = message.content.trim();

    // ✅ Only count this exact response
    if (!content.includes('casts a magic spell')) return;
    if (!content.includes('legendary toothbrush')) return;

    // ✅ Skip if already processed this message
    if (this.processedMessages.has(message.id)) return;
    this.processedMessages.add(message.id);

    // ✅ Extract username — DO NOT strip underscores
    // RPG sends: **braty_n** casts a magic spell...
    // We extract: braty_n (with underscore)
    const nameMatch = content.match(/^\*?\*?(.+?)\*?\*?\s+casts/i);
    if (!nameMatch) return;

    // ✅ Only strip bold/italic markdown (* and **), NOT underscores
    const epicRPGName = nameMatch[1].replace(/\*/g, '').trim();

    // logger.info(`📨 [RPG] "${epicRPGName}" | msgId: ${message.id}`);

    // ✅ Look up user by username
    let userData = this.userCache.get(epicRPGName);

    if (!userData) {
      // ✅ Not in cache — search DB by username
      const dbUser = await CommandTracker.findOne({ username: epicRPGName }).lean();

      if (dbUser) {
        userData = {
          userId: dbUser.userId,
          username: dbUser.username,
          displayName: dbUser.displayName
        };
        this.userCache.set(epicRPGName, userData);
        // logger.info(`✅ [DB FOUND] ${epicRPGName} → ${userData.userId}`);
      } else {
        logger.warn(`⚠️ [NOT FOUND] "${epicRPGName}" — waiting for user trigger`);
        return;
      }
    }

    // ✅ Get fresh display name
    const member = message.guild.members.cache.get(userData.userId);
    const latestDisplayName = member?.displayName || userData.displayName;

    const today = getTodayString();

    try {
      const result = await CommandTracker.findOneAndUpdate(
        {
          userId: userData.userId,
          command: 'legendary_toothbrush',
          date: today
        },
        {
          $inc: { count: 1 },
          $set: {
            username: userData.username,
            displayName: latestDisplayName,
            lastUpdated: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // logger.info(`✅ [TRACKED] ${latestDisplayName} (${userData.userId}) → count: ${result.count}`);

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
        await this.handleUserMessage(message);
      }

    } catch (err) {
      logger.error('Error in CommandTracker.handleMessage:', err);
    }
  }
}

module.exports = CommandTrackerFeature;