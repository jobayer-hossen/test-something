const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('AboutCommand');

module.exports = {
  name: 'about',
  description: 'Learn about Epic Bot',

  async execute(message, args, client) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('ℹ️ About Epic Bot')
        .setDescription('Your ultimate companion bot!')
        .addFields(
          {
            name: '🎮 Purpose',
            value:
              'Epic Bot automatically detects and announces in-game events with instant notifications.',
            inline: false,
          },
          {
            name: '🚀 Features',
            value:
              '• 🌧️ Coin Rain Detection\n• 🎁 Lootbox Summoning Detection\n• 📢 Instant Notifications\n• 🎯 Role Mentions',
            inline: false,
          },
          {
            name: '👨‍💻 Developer',
            value: '<@782630678389981244>',
            inline: true,
          },
          {
            name: '💬 Support',
            value:
              'For issues or suggestions, contact the server administrators.',
            inline: false,
          },
        )
        .setThumbnail(client.user.avatarURL())
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot © 2024',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      logger.info(`About command used by ${message.author.tag}`);
    } catch (error) {
      logger.error('Error in about command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};