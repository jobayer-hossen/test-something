const User = require('../schemas/User');
const Logger = require('../../logger');
const logger = new Logger('EconomyService');

const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000,
  work: 60 * 60 * 1000,
  search: 3 * 60 * 60 * 1000,
};

// Store cooldowns in memory (use Redis for production)
const cooldownMap = new Map();

class EconomyService {
  getCooldownKey(userId, action) {
    return `${userId}:${action}`;
  }

  getRemainingCooldown(userId, action) {
    const key = this.getCooldownKey(userId, action);
    const lastUsed = cooldownMap.get(key);
    if (!lastUsed) return 0;
    const elapsed = Date.now() - lastUsed;
    const remaining = COOLDOWNS[action] - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  setCooldown(userId, action) {
    const key = this.getCooldownKey(userId, action);
    cooldownMap.set(key, Date.now());
  }

  formatCooldown(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  async addCoins(userId, amount) {
    try {
      const user = await User.findOneAndUpdate(
        { userId },
        {
          $inc: { coins: amount },
          $set: { updatedAt: new Date(), lastSeen: new Date() },
        },
        { new: true }
      );
      return user;
    } catch (error) {
      logger.error('Error adding coins:', error.message);
      return null;
    }
  }

  async removeCoins(userId, amount) {
    try {
      const user = await User.findOne({ userId });
      if (!user || user.coins < amount) return null;

      user.coins -= amount;
      user.updatedAt = new Date();
      await user.save();
      return user;
    } catch (error) {
      logger.error('Error removing coins:', error.message);
      return null;
    }
  }

  async getBalance(userId) {
    const user = await User.findOne({ userId });
    return user ? user.coins : 0;
  }

  async claimDaily(userId, username) {
    const remaining = this.getRemainingCooldown(userId, 'daily');
    if (remaining > 0) {
      return { success: false, remaining, formatted: this.formatCooldown(remaining) };
    }

    const reward = 250;
    this.setCooldown(userId, 'daily');
    const user = await this.addCoins(userId, reward);
    return { success: true, reward, newBalance: user?.coins || 0 };
  }

  async claimWork(userId, username) {
    const remaining = this.getRemainingCooldown(userId, 'work');
    if (remaining > 0) {
      return { success: false, remaining, formatted: this.formatCooldown(remaining) };
    }

    const reward = Math.floor(Math.random() * (80 - 25 + 1)) + 25;
    const spawnBoss = Math.random() < 0.15; // 15% chance

    this.setCooldown(userId, 'work');
    const user = await this.addCoins(userId, reward);
    return { success: true, reward, newBalance: user?.coins || 0, spawnBoss };
  }

  async claimSearch(userId, username) {
    const remaining = this.getRemainingCooldown(userId, 'search');
    if (remaining > 0) {
      return { success: false, remaining, formatted: this.formatCooldown(remaining) };
    }

    const reward = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    const spawnBoss = Math.random() < 0.20; // 20% chance

    this.setCooldown(userId, 'search');
    const user = await this.addCoins(userId, reward);
    return { success: true, reward, newBalance: user?.coins || 0, spawnBoss };
  }

  async getLeaderboard(limit = 10) {
    return User.find({}).sort({ coins: -1 }).limit(limit);
  }
}

module.exports = new EconomyService();