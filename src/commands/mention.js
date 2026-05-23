const Logger = require('../logger');

const logger = new Logger('MentionHandler');

module.exports = {
  name: 'mentionHandler',
  description: 'Handle mentions and send stickers',

  async execute(message, client) {
    try {
      // Your Discord user ID
      const ownerID = '7826306783899234433';

      // Check if you're mentioned
      if (message.mentions.has(ownerID)) {
        // Your server stickers
        const stickers = [
          'https://cdn.discordapp.com/emojis/1472947830669967392.webp?size=96',
          'https://cdn.discordapp.com/emojis/1472946773608759457.webp?size=96',
        ];

        // Pick random sticker
        const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];

        // Send sticker
        await message.channel.send({
          content: randomSticker,
          allowedMentions: { repliedUser: false },
        });

        logger.info(`Sticker sent for mention by ${message.author.tag}`);
      }
    } catch (error) {
      logger.error('Error in mention handler:', error.message);
    }
  },
};