const Logger = require('../logger');

const logger = new Logger('LootboxSummoning');

class LootboxSummoningFeature {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get all text from message (content + embeds)
   */
  getAllText(message) {
    let allText = '';

    if (message.content) {
      allText += message.content + ' ';
    }

    if (message.embeds && message.embeds.length > 0) {
      message.embeds.forEach((embed) => {
        if (embed.title) allText += embed.title + ' ';
        if (embed.description) allText += embed.description + ' ';
        if (embed.author && embed.author.name) allText += embed.author.name + ' ';
        if (embed.footer && embed.footer.text) allText += embed.footer.text + ' ';
        if (embed.fields) {
          embed.fields.forEach((field) => {
            allText += field.name + ' ' + field.value + ' ';
          });
        }
      });
    }

    return allText;
  }

  /**
   * Handle lootbox summoning message
   */
  async handleMessage(message) {
    try {
      // Only respond to EPIC RPG bot
      if (message.author.id !== '555955826880413696') {
        return;
      }

      const allText = this.getAllText(message);

      // Check for LOOTBOX SUMMONING
      if (!allText.includes('LOOTBOX SUMMONING HAS STARTED')) {
        return;
      }

      await this.triggerSummoning(message);
    } catch (error) {
      logger.error('Error handling lootbox summoning:', error.message);
    }
  }

  /**
   * Trigger lootbox summoning announcement
   */
  async triggerSummoning(message) {
    try {
      // Change bot name
      try {
        await this.client.user.setUsername('EPIC BOT');
        logger.info('✅ Bot name changed to EPIC BOT');
      } catch (error) {
        logger.warn('Could not change bot name:', error.message);
      }

      const roleId = '1470272874161111061';
      const summonMessage = `<@&${roleId}> If you want EDGY! then spam Summon!`;

      await message.channel.send({
        content: summonMessage,
        allowedMentions: { parse: ['roles'] },
      });

      // logger.info('✅ Lootbox summoning sent');
    } catch (error) {
      logger.error('Error triggering summoning:', error.message);
    }
  }
}

module.exports = LootboxSummoningFeature;