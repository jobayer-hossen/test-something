const Logger = require('../logger');
const AmanCoinMention = require('../database/schemas/AmanCoinMention'); // Assuming this is the correct model for tracking RPG trumpet usage

const logger = new Logger('AmanTrumpetReminder');

const TARGET_USER_ID = '1116077505783271585'; // Aman's user ID
const REMINDER_CHANNEL_ID = '1504069016506077275'; // Channel ID
const COOLDOWN_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

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
      logger.warn('⚠️ Database not available - Aman Trumpet Reminder disabled');
      return;
    }

    logger.info('🎺 Initializing Aman Trumpet Reminder system...');
    
    // Check every minute for reminders
    this.checkInterval = setInterval(() => {
      this.checkReminders();
    }, 60 * 1000); // Check every 1 minute

    this.isInitialized = true;

    // Also check on startup
    setTimeout(() => this.checkReminders(), 5000); // Wait 5 seconds before first check

    logger.info('✅ Aman Trumpet Reminder system initialized');
  }

  // Track when user uses the command
  async trackUsage(userId, message) {
    if (!this.isInitialized || userId !== TARGET_USER_ID) return;

    const content = message.content.toLowerCase().trim();
    
    // Check if the message is "rpg use coin trumpet"
    if (content === 'rpg use coin trumpet' || 
        content.includes('rpg use coin trumpet')) {
      
      try {
        await AmanCoinMention.findOneAndUpdate(
          { userId: userId },
          {
            userId: userId,
            lastUsed: new Date(),
            reminderSent: false,
            missedCount: 0 // Reset missed count when they use it
          },
          { upsert: true, new: true }
        );

        logger.debug(`✅ Tracked RPG trumpet usage for user ${userId}`);
      } catch (error) {
        logger.error('Error tracking RPG usage:', error);
      }
    }
  }

  // Check if reminders need to be sent
  async checkReminders() {
    if (!this.isInitialized) return;

    try {
      const userData = await AmanCoinMention.findOne({ userId: TARGET_USER_ID });

      if (!userData || !userData.lastUsed) {
        logger.debug('No usage data found for reminders');
        return;
      }

      const now = Date.now();
      const timeSinceLastUse = now - userData.lastUsed.getTime();

      // If 30 minutes have passed and reminder hasn't been sent
      if (timeSinceLastUse >= COOLDOWN_TIME && !userData.reminderSent) {
        await this.sendReminder(userData, timeSinceLastUse);
      }
    } catch (error) {
      logger.error('Error checking reminders:', error);
    }
  }

  // Send reminder to user
  async sendReminder(userData, timeSinceLastUse) {
    try {
      const channel = await this.client.channels.fetch(REMINDER_CHANNEL_ID);
      if (!channel) {
        logger.error('Reminder channel not found');
        return;
      }

      const user = await this.client.users.fetch(TARGET_USER_ID);
      if (!user) {
        logger.error('Target user not found');
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
        { userId: TARGET_USER_ID },
        {
          reminderSent: true,
          missedCount: newMissedCount
        }
      );

      logger.info(`📨 Sent reminder to user ${TARGET_USER_ID} (missed: ${newMissedCount})`);
    } catch (error) {
      logger.error('Error sending reminder:', error);
    }
  }

  // Get current status (for debugging/commands)
  async getStatus() {
    if (!this.isInitialized) {
      return { active: false, message: 'Feature not initialized' };
    }

    try {
      const userData = await AmanCoinMention.findOne({ userId: TARGET_USER_ID });
      
      if (!userData || !userData.lastUsed) {
        return {
          active: true,
          message: 'No usage recorded yet'
        };
      }

      const now = Date.now();
      const timeSinceLastUse = now - userData.lastUsed.getTime();
      const timeRemaining = COOLDOWN_TIME - timeSinceLastUse;

      return {
        active: true,
        lastUsed: userData.lastUsed,
        timeSinceLastUse,
        timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
        missedCount: userData.missedCount,
        reminderSent: userData.reminderSent
      };
    } catch (error) {
      logger.error('Error getting status:', error);
      return { active: false, error: error.message };
    }
  }

  // Stop the reminder system
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.isInitialized = false;
      logger.info('🛑 Aman Trumpet Reminder system stopped');
    }
  }
}

module.exports = AmanTrumpetReminder;