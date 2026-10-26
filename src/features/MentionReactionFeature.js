const Logger = require("../logger");
const MentionReaction = require("../database/schemas/MentionReaction");

const logger = new Logger("MentionReaction");

class MentionReactionFeature {
  constructor(client) {
    this.client = client;
    this.cooldowns = new Map();
    this.cooldownMs = 10000;
    this.maxMentionsPerMessage = 5;
    this.cleanupInterval = null;
  }

  initialize() {
    this.client.on("messageCreate", this.handleMessage.bind(this));
    this.cleanupInterval = setInterval(
      () => this.cleanupCooldowns(),
      60 * 60 * 1000,
    );
    logger.info("MentionReactionFeature initialized");
  }

  cleanupCooldowns() {
    const now = Date.now();
    for (const [userId, ts] of this.cooldowns) {
      if (now - ts > this.cooldownMs * 10) this.cooldowns.delete(userId);
    }
  }

  async handleMessage(message) {
    try {
      if (message.author.bot) return;
      if (message.webhookId) return;
      if (!message.guild) return;
      if (message.mentions.everyone) return;
      if (message.mentions.users.size === 0) return;

      // Only count EXPLICIT @mentions typed in the content —
      // excludes users pinged automatically via "reply" notifications
      const mentionedUsers = message.mentions.users.filter((u) => {
        if (u.bot || u.id === message.author.id) return false;
        return (
          message.content.includes(`<@${u.id}>`) ||
          message.content.includes(`<@!${u.id}>`)
        );
      });

      if (mentionedUsers.size === 0) return;

      let count = 0;
      let alreadyResponded = false;

      for (const [, user] of mentionedUsers) {
        if (count >= this.maxMentionsPerMessage) break;
        count++;

        const now = Date.now();
        const lastTrigger = this.cooldowns.get(user.id);
        if (lastTrigger && now - lastTrigger < this.cooldownMs) continue;

        const settings = await MentionReaction.findOne({
          userId: user.id,
        }).lean();
        if (!settings) continue;

        let triggered = false;

        if (settings.reactEmoji) {
          try {
            await message.react(settings.reactEmoji);
            triggered = true;
          } catch (err) {
            logger.debug(`Failed to react for ${user.id}: ${err.message}`);
          }
        }

        if (settings.respondContent && !alreadyResponded) {
          try {
            await message.channel.send({
              content: settings.respondContent,
              allowedMentions: { parse: [] },
            });
            alreadyResponded = true;
            triggered = true;
          } catch (err) {
            logger.debug(`Failed to respond for ${user.id}: ${err.message}`);
          }
        }

        if (triggered) this.cooldowns.set(user.id, now);
      }
    } catch (error) {
      logger.error("Error in MentionReactionFeature:", error);
    }
  }

  shutdown() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

module.exports = MentionReactionFeature;
