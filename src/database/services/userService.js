// src/database/services/userService.js
const User = require('../schemas/User');
const Logger = require('../../logger');
const logger = new Logger('UserService');

class UserService {
  async getOrCreateUser(userId, username, isBot = false) {
    if (isBot) return null;
    try {
      let user = await User.findOne({ userId });
      if (!user) {
        user = new User({ userId, username });
        await user.save();
      }
      return user;
    } catch (error) {
      logger.error('Error in getOrCreateUser:', error.message);
      return null;
    }
  }

  async addXP(userId, xpAmount) {
    try {
      const user = await User.findOne({ userId });
      if (!user) return null;

      user.xp += xpAmount;
      
      // Professional Leveling Logic: Each level requires more XP
      // Formula: Level * 100 (Level 1=100xp, Level 2=200xp, etc.)
      const xpNeeded = user.level * 100;

      if (user.xp >= xpNeeded) {
        user.level += 1;
        user.xp = 0; // Reset XP for next level
        user.updatedAt = new Date();
        await user.save();
        return { user, leveledUp: true };
      }

      await user.save();
      return { user, leveledUp: false };
    } catch (error) {
      logger.error('Error adding XP:', error.message);
      return null;
    }
  }

  // Used by Admin setup commands to check level
  async getUserLevel(userId) {
    const user = await User.findOne({ userId });
    return user ? user.level : 0;
  }
}

module.exports = new UserService();