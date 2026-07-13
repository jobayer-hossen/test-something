const Logger = require('../logger');
const CommandTracker = require('../database/schemas/CommandTracker');

const logger = new Logger('CommandTracker');

const EPIC_RPG_BOT_ID = '555955826880413696';

const TRACKED_COMMANDS = [
  {
    id: 'legendary_toothbrush',
    label: 'Legendary Toothbrush',
    // ✅ Matches plain text OR custom Discord emoji (<:name:id>)
    patterns: [
      /casts a magic spell with the .*?legendary toothbrush/i
    ]
  },
  // {
  //   id: 'coin_trumpet',
  //   label: 'Coin Trumpet',
  //   patterns: [
  //     /plays a trumpet made of coins/i
  //   ]
  // }
];

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

class CommandTrackerFeature {
  constructor(client) {
    this.client = client;
  }

  // ✅ Step 1: Parse the message from Epic RPG
  parseEpicRPGMessage(message) {
    // Only listen to Epic RPG bot
    if (message.author.id !== EPIC_RPG_BOT_ID) return null;
    if (!message.content) return null;

    const content = message.content.trim();
    const firstLine = content.split('\n')[0];

    for (const cmd of TRACKED_COMMANDS) {
      for (const pattern of cmd.patterns) {
        if (pattern.test(firstLine)) {
          // ✅ Extracts "ichigo271" from "ichigo271 casts a magic spell..."
          const usernameMatch = firstLine.match(/^(.+?)\s+(casts|plays|uses)/i);
          
          if (usernameMatch) {
            return {
              command: cmd,
              username: usernameMatch[1].replace(/[*_`~]/g, '').trim(), // Clean formatting
              mentionedUser: message.mentions.users.first() || null
            };
          }
        }
      }
    }
    return null;
  }

  // ✅ Step 2: Try to get User ID from Reply/Interaction Reference
  async getUserFromContext(message, username) {
    // 1. Check if it's a reply to a user's command
    if (message.reference && message.reference.messageId) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (refMsg && !refMsg.author.bot) return refMsg.author;
      } catch (err) {}
    }

    // 2. Check interaction (if user used a slash command)
    if (message.interaction && message.interaction.user) {
      return message.interaction.user;
    }

    // 3. Check guild cache by exact Username or Display Name
    const member = message.guild.members.cache.find(
      m => m.user.username.toLowerCase() === username.toLowerCase() ||
           m.displayName.toLowerCase() === username.toLowerCase()
    );
    if (member) return member.user;

    // 4. Force fetch from Discord API if not in cache
    try {
      const fetchedMembers = await message.guild.members.fetch({ query: username, limit: 1 });
      const firstFound = fetchedMembers.first();
      if (firstFound) return firstFound.user;
    } catch (err) {}

    return null;
  }

  // ✅ Step 3: Main Listener (Works in ANY channel of the server)
  async handleMessage(message) {
    try {
      // Must be in a guild (server) and sent by Epic RPG
      if (!message.inGuild()) return;
      if (message.author.id !== EPIC_RPG_BOT_ID) return;

      // Check if the message matches our pattern
      const parsed = this.parseEpicRPGMessage(message);
      if (!parsed) return;

      // Identify the user who used it
      let user = parsed.mentionedUser || await this.getUserFromContext(message, parsed.username);

      const today = getTodayString();
      const userId = user ? user.id : `unknown_${parsed.username.toLowerCase()}`;
      const username = user ? user.username : parsed.username;
      const displayName = user && message.guild.members.cache.get(user.id)?.displayName 
        ? message.guild.members.cache.get(user.id).displayName 
        : parsed.username;

      // Save to database permanently & increment count
      const result = await CommandTracker.findOneAndUpdate(
        {
          userId: userId,
          command: parsed.command.id,
          date: today
        },
        {
          $inc: { count: 1 },
          $set: {
            username: username,
            displayName: displayName,
            lastUpdated: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // logger.info(`✅ [TRACKED] ${displayName} (${userId}) used ${parsed.command.label} on ${today} -> Total today: ${result.count}`);

    } catch (err) {
      logger.error('Error in CommandTracker handleMessage:', err);
    }
  }
}

module.exports = CommandTrackerFeature;