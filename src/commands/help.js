const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('HelpCommand');

module.exports = {
  name: 'help',
  description: 'View bot features and commands',

  async execute(message, args, client) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📖 Help & Features')
        .setDescription('Here are all the features of Epic RPG Bot')
        .addFields(
          {
            name: '🌧️ Coin Rain Detection',
            value:
              'Automatically detects EPIC RPG coin rain events and announces them with max reward amount.',
            inline: false,
          },
          {
            name: '🎁 Lootbox Summoning Detection',
            value:
              'Automatically detects EPIC RPG lootbox summoning events and announces them with role mentions.',
            inline: false,
          },
          {
            name: '⌨️ Commands',
            value: '`eb status` - Check bot status\n`eb help` - View this help menu\n`eb about` - Learn about the bot',
            inline: false,
          },
          {
            name: '⚙️ Features',
            value:
              '✅ Auto-detect coin rain\n✅ Auto-detect lootbox summoning\n✅ Role mentions\n✅ Real-time updates',
            inline: false,
          },
          {
            name: '🎯 How to Use',
            value:
              'The bot automatically monitors messages from EPIC RPG bot and responds accordingly. No manual commands needed for auto-detection!',
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Epic RPG Bot',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      logger.info(`Help command used by ${message.author.tag}`);
    } catch (error) {
      logger.error('Error in help command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};