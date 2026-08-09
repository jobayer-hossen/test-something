const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

const EPIC_RPG_BOT_ID = '555955826880413696';

const TRACKED_COMMANDS = [
  {
    id: 'legendary_toothbrush',
    label: 'Legendary Toothbrush',
    patterns: [
      /casts a magic spell with the .*?legendary toothbrush/i
    ]
  },
];

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

class CommandTrackerFeature {
  constructor(client) {
    this.client = client;
  }

  // ════════════════════════════════════════════
  // STEP 1: Check if Epic RPG message matches
  // ════════════════════════════════════════════
  parseEpicRPGMessage(message) {
    if (message.author.id !== EPIC_RPG_BOT_ID) return null;
    if (!message.content) return null;

    const firstLine = message.content.trim().split('\n')[0];

    for (const cmd of TRACKED_COMMANDS) {
      for (const pattern of cmd.patterns) {
        if (pattern.test(firstLine)) {
          const usernameMatch = firstLine.match(/^(.+?)\s+(casts|plays|uses)/i);
          if (usernameMatch) {
            return {
              command: cmd,
              // Raw display name from message text
              displayNameFromMessage: usernameMatch[1].replace(/[*_`~]/g, '').trim(),
              mentionedUser: message.mentions.users.first() || null
            };
          }
        }
      }
    }
    return null;
  }

  // ════════════════════════════════════════════
  // STEP 2: Resolve real Discord User
  // Priority: mention → reply → full guild search
  // ════════════════════════════════════════════
  async resolveUser(message, displayNameFromMessage) {
    // ✅ Priority 1: Direct mention in message (@user)
    if (message.mentions.users.size > 0) {
      return message.mentions.users.first();
    }

    // ✅ Priority 2: Epic RPG replied to user's message
    if (message.reference?.messageId) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (refMsg && !refMsg.author.bot) {
          return refMsg.author;
        }
      } catch (err) {}
    }

    // ✅ Priority 3: Search ALL guild members by display name
    try {
      // Fetch all members into cache
      await message.guild.members.fetch();

      const cleanName = displayNameFromMessage.toLowerCase();

      const member = message.guild.members.cache.find(m =>
        m.user.username.toLowerCase() === cleanName ||
        m.displayName.toLowerCase() === cleanName ||
        (m.user.globalName && m.user.globalName.toLowerCase() === cleanName) ||
        (m.nickname && m.nickname.toLowerCase() === cleanName)
      );

      if (member) return member.user;
    } catch (err) {
      logger.error('Guild member fetch failed:', err);
    }

    return null;
  }

  // ════════════════════════════════════════════
  // STEP 3: Main handler
  // ════════════════════════════════════════════
  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (message.author.id !== EPIC_RPG_BOT_ID) return;

      const parsed = this.parseEpicRPGMessage(message);
      if (!parsed) return;

      const today = getTodayString();

      // ✅ Resolve real Discord user
      const user = await this.resolveUser(message, parsed.displayNameFromMessage);

      if (!user) {
        // ─────────────────────────────────────────
        // Could NOT resolve → skip storing
        // No more unknown_ garbage in DB
        // ─────────────────────────────────────────
        logger.warn(`⚠️ [SKIPPED] Could not resolve user for: "${parsed.displayNameFromMessage}" — not stored`);
        return;
      }

      // ─────────────────────────────────────────
      // ✅ Resolved → Get latest display name from guild
      // ─────────────────────────────────────────
      const member = message.guild.members.cache.get(user.id);
      const latestDisplayName = member?.displayName || user.globalName || user.username;

      // ─────────────────────────────────────────
      // ✅ Store/Update DB
      // userId NEVER changes (real Discord ID)
      // username NEVER changes (Discord username)
      // displayName ALWAYS updates to latest
      // count increments
      // ─────────────────────────────────────────
      const result = await CommandTracker.findOneAndUpdate(
        {
          userId: user.id,          // Real Discord ID — permanent key
          command: parsed.command.id,
          date: today
        },
        {
          $inc: { count: 1 },
          $set: {
            username: user.username,           // Discord username (rarely changes)
            displayName: latestDisplayName,    // Server nickname (always latest)
            lastUpdated: new Date()
          }
        },
        { upsert: true, new: true }
      );

      logger.info(`✅ [TRACKED] ${latestDisplayName} (${user.id}) used ${parsed.command.label} on ${today} → Total: ${result.count}`);

    } catch (err) {
      logger.error('Error in CommandTracker handleMessage:', err);
    }
  }
}

module.exports = CommandTrackerFeature;