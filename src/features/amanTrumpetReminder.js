const Logger = require("../logger");
const AmanCoinMention = require("../database/schemas/AmanCoinMention");

const logger = new Logger("AmanTrumpetReminder");

const COOLDOWN_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
const REMINDER_CHANNEL_ID = "1504069016506077275"; // Channel ID

// Define all tracked users
const TRACKED_USERS = [
  {
    userId: "1116077505783271585", // Aman's user ID
  },
  {
    userId: "709084208378806324", // ѕℓαуєя user ID
  },
];

class AmanTrumpetReminder {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
    this.isInitialized = false;
  }

  // Initialize the reminder system
  async initialize() {
    // Check if database is available
    if (!this.client.db) {
      logger.warn("⚠️ Database not available - Aman Trumpet Reminder disabled");
      return;
    }

    // logger.info("🎺 Initializing Aman Trumpet Reminder system...");

    // Check every minute for reminders
    this.checkInterval = setInterval(() => {
      this.checkReminders();
    }, 60 * 1000); // Check every 1 minute

    this.isInitialized = true;

    // Also check on startup
    setTimeout(() => this.checkReminders(), 5000); // Wait 5 seconds before first check

    logger.info("✅ Aman Trumpet Reminder system initialized");
  }

  // Check if user is tracked
  isTrackedUser(userId) {
    return TRACKED_USERS.some((user) => user.userId === userId);
  }

  // Track when user uses the command
  async trackUsage(userId, message) {
    if (!this.isInitialized || !this.isTrackedUser(userId)) return;

    const content = message.content.toLowerCase().trim();

    // Check if the message is "rpg use coin trumpet"
    if (
      content === "rpg use coin trumpet" ||
      content.includes("rpg use coin trumpet")
    ) {
      try {
        await AmanCoinMention.findOneAndUpdate(
          { userId: userId },
          {
            userId: userId,
            lastUsed: new Date(),
            reminderSent: false,
            missedCount: 0, // Reset missed count when they use it
          },
          {
            upsert: true,
            returnDocument: "after",
          },
        );

        // logger.debug(`✅ Tracked RPG trumpet usage for user ${userId}`);
      } catch (error) {
        logger.error("Error tracking RPG usage:", error);
      }
    }
  }

  // Check if reminders need to be sent
  async checkReminders() {
    if (!this.isInitialized) return;

    // Check reminders for all tracked users
    for (const trackedUser of TRACKED_USERS) {
      await this.checkUserReminder(trackedUser.userId);
    }
  }

  // Check reminder for a specific user
  async checkUserReminder(userId) {
    try {
      const userData = await AmanCoinMention.findOne({ userId });

      if (!userData || !userData.lastUsed) {
        logger.debug(`No usage data found for user ${userId}`);
        return;
      }

      const now = Date.now();
      const timeSinceLastUse = now - userData.lastUsed.getTime();

      // If 30 minutes have passed and reminder hasn't been sent
      if (timeSinceLastUse >= COOLDOWN_TIME && !userData.reminderSent) {
        await this.sendReminder(userData, timeSinceLastUse);
      }
    } catch (error) {
      logger.error(`Error checking reminder for user ${userId}:`, error);
    }
  }

  // Send reminder to user
  async sendReminder(userData, timeSinceLastUse) {
    try {
      const channel = await this.client.channels.fetch(REMINDER_CHANNEL_ID);
      if (!channel) {
        logger.error("Reminder channel not found");
        return;
      }

      const user = await this.client.users.fetch(userData.userId);
      if (!user) {
        logger.error(`Target user ${userData.userId} not found`);
        return;
      }

      // Calculate how many 30-minute periods have passed
      const periodsElapsed = Math.floor(timeSinceLastUse / COOLDOWN_TIME);
      const newMissedCount = userData.missedCount + periodsElapsed;

      // Create reminder message
      let reminderMessage = `${user} 🎺 **RPG Trumpet Reminder!**\n\n`;
      reminderMessage += `It's time to use \`rpg use coin trumpet\` again!\n`;
      reminderMessage += `⏰ Last used: <t:${Math.floor(userData.lastUsed.getTime() / 1000)}:R>\n`;

      if (newMissedCount > 1) {
        reminderMessage += `⚠️ You've missed **${newMissedCount}** uses!\n`;
      }

      reminderMessage += `\n💡 Use \`rpg use coin trumpet\` to reset the timer!`;

      await channel.send(reminderMessage);

      // Update database
      await AmanCoinMention.findOneAndUpdate(
        { userId: userData.userId },
        {
          reminderSent: true,
          missedCount: newMissedCount,
        },
        { returnDocument: "after" },
      );

      // logger.info(
      //   `📨 Sent reminder to user ${userData.userId} (missed: ${newMissedCount})`,
      // );
    } catch (error) {
      logger.error("Error sending reminder:", error);
    }
  }

  // Get current status for a specific user (for debugging/commands)
  async getStatus(userId = TRACKED_USERS[0].userId) {
    if (!this.isInitialized) {
      return { active: false, message: "Feature not initialized" };
    }

    // Validate that the userId is tracked
    if (!this.isTrackedUser(userId)) {
      return { active: false, message: `User ${userId} is not tracked` };
    }

    try {
      const userData = await AmanCoinMention.findOne({ userId });

      if (!userData || !userData.lastUsed) {
        return {
          active: true,
          userId,
          message: "No usage recorded yet",
        };
      }

      const now = Date.now();
      const timeSinceLastUse = now - userData.lastUsed.getTime();
      const timeRemaining = COOLDOWN_TIME - timeSinceLastUse;

      return {
        active: true,
        userId,
        lastUsed: userData.lastUsed,
        timeSinceLastUse,
        timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
        missedCount: userData.missedCount,
        reminderSent: userData.reminderSent,
      };
    } catch (error) {
      logger.error("Error getting status:", error);
      return { active: false, error: error.message };
    }
  }

  // Get status for all tracked users
  async getAllStatus() {
    const statuses = [];

    for (const trackedUser of TRACKED_USERS) {
      const status = await this.getStatus(trackedUser.userId);
      statuses.push(status);
    }

    return statuses;
  }
}

module.exports = AmanTrumpetReminder;
