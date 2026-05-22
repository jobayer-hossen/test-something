const Reminder = require("../database/schemas/Reminder");
const UserTRSettings = require("../database/schemas/UserTRSettings");
const Logger = require("../logger");
const logger = new Logger("RPGTracker");

class RPGTracker {
  constructor(client) {
    this.client = client;
    this.rpgBotId = "555997324714278913";
    
    // Command Registry: Define search strings and keys here
    this.commandRegistry = [
      { key: "produce", trigger: "produced a module recently" },
      { key: "hunt", trigger: "wait at least" && "for your next hunt" },
      { key: "adventure", trigger: "wait at least" && "for your next adventure" },
      { key: "training", trigger: "wait at least" && "for your next training" },
      { key: "chop", trigger: "wait at least" && "to chop" },
      { key: "fish", trigger: "wait at least" && "to fish" },
      { key: "mine", trigger: "wait at least" && "to mine" },
      { key: "pickup", trigger: "wait at least" && "to pickup" },
    ];

    this.checkReminders();
  }

  async handleMessage(message) {
    if (message.author.id !== this.rpgBotId) return;

    const content = message.content || message.embeds[0]?.description || "";
    if (!content) return;

    // Find which command this message belongs to
    const command = this.commandRegistry.find(cmd => content.toLowerCase().includes(cmd.trigger.toLowerCase()));
    
    if (command) {
      this.parseCooldown(message, content, command.key);
    }
  }

  async parseCooldown(message, content, type) {
    try {
      // 1. Get the target user (the person Epic RPG is talking to)
      const targetUser = message.mentions.users.first() || message.referencedMessage?.author;
      if (!targetUser) return;

      // 2. Check if the user has this tracker enabled
      const settings = await UserTRSettings.findOne({ userId: targetUser.id });
      if (settings && settings.trackers[type] === false) return; // Skip if disabled

      // 3. Extract time
      const timeMatch = content.match(/wait at least (?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
      if (!timeMatch) return;

      const hours = parseInt(timeMatch[1] || 0);
      const minutes = parseInt(timeMatch[2] || 0);
      const seconds = parseInt(timeMatch[3] || 0);
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

      if (totalMs === 0) return;

      const endTime = new Date(Date.now() + totalMs);

      // 4. Save to DB
      await Reminder.findOneAndUpdate(
        { userId: targetUser.id, commandType: type },
        { channelId: message.channel.id, endTime, reminded: false },
        { upsert: true }
      );

      await message.react("⏰");
    } catch (err) {
      logger.error(`Error parsing ${type} cooldown:`, err.message);
    }
  }

  async checkReminders() {
    setInterval(async () => {
      try {
        const now = new Date();
        const dueReminders = await Reminder.find({ endTime: { $lte: now }, reminded: false });

        for (const rem of dueReminders) {
          const channel = await this.client.channels.fetch(rem.channelId).catch(() => null);
          if (channel) {
            await channel.send(`🔔 <@${rem.userId}>, your **${rem.commandType}** is ready!`);
          }
          rem.reminded = true;
          await rem.save();
        }
      } catch (err) {
        logger.error("Reminder loop error:", err.message);
      }
    }, 5000);
  }
}

module.exports = RPGTracker;