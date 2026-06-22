const ServerSettings = require('../schemas/ServerSettings');
const Logger = require('../../logger');

const logger = new Logger('ServerService');

class ServerService {
  /**
   * Get or create server settings
   */
  async getOrCreateSettings(serverId, serverName) {
    try {
      let settings = await ServerSettings.findOne({ serverId });

      if (!settings) {
        settings = new ServerSettings({
          serverId,
          serverName,
        });
        await settings.save();
        logger.info(`✅ Server settings created: ${serverName} (${serverId})`);
      }

      return settings;
    } catch (error) {
      logger.error('Error getting/creating settings:', error.message);
      return null;
    }
  }

  /**
   * Update coin rain role
   */
  async setCoinRainRole(serverId, roleId) {
    try {
      // ✅ FIXED: Added upsert + returnDocument
      const settings = await ServerSettings.findOneAndUpdate(
        { serverId },
        { coinRainRoleId: roleId },
        { upsert: true, returnDocument: 'after' }
      );

      return settings;
    } catch (error) {
      logger.error('Error setting coin rain role:', error.message);
      return null;
    }
  }

  /**
   * Update lootbox role
   */
  async setLootboxRole(serverId, roleId) {
    try {
      // ✅ FIXED: Added upsert + returnDocument
      const settings = await ServerSettings.findOneAndUpdate(
        { serverId },
        { lootboxRoleId: roleId },
        { upsert: true, returnDocument: 'after' }
      );

      return settings;
    } catch (error) {
      logger.error('Error setting lootbox role:', error.message);
      return null;
    }
  }

  /**
   * Get server settings
   */
  async getSettings(serverId) {
    try {
      const settings = await ServerSettings.findOne({ serverId });
      return settings;
    } catch (error) {
      logger.error('Error getting settings:', error.message);
      return null;
    }
  }

  /**
   * Toggle feature
   */
  async toggleFeature(serverId, featureName) {
    try {
      const settings = await ServerSettings.findOne({ serverId });

      if (!settings) return null;

      settings.features[featureName] = !settings.features[featureName];
      await settings.save();

      return settings;
    } catch (error) {
      logger.error('Error toggling feature:', error.message);
      return null;
    }
  }
}

module.exports = new ServerService();