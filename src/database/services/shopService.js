const ShopItem = require('../schemas/ShopItem');
const Purchase = require('../schemas/Purchase');
const Logger = require('../../logger');
const logger = new Logger('ShopService');

class ShopService {
  async getItems(guildId) {
    return ShopItem.find({
      $or: [{ guildId }, { guildId: null }],
      isAvailable: true,
    });
  }

  async getItem(itemId) {
    return ShopItem.findOne({ itemId, isAvailable: true });
  }

  async purchaseItem(userId, username, itemId, guildId) {
    try {
      const item = await this.getItem(itemId);
      if (!item) return { success: false, reason: 'item_not_found' };

      const alreadyBought = await Purchase.findOne({ userId, itemId });
      if (alreadyBought) return { success: false, reason: 'already_purchased' };

      const purchase = new Purchase({
        userId,
        username,
        itemId,
        itemName: item.name,
        price: item.price,
        guildId,
      });

      await purchase.save();
      return { success: true, item, purchase };
    } catch (error) {
      logger.error('Error purchasing item:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async getUserPurchases(userId) {
    return Purchase.find({ userId });
  }

  async addShopItem(itemData) {
    try {
      const item = new ShopItem(itemData);
      await item.save();
      return { success: true, item };
    } catch (error) {
      logger.error('Error adding item:', error.message);
      return { success: false, reason: 'error' };
    }
  }
}

module.exports = new ShopService();