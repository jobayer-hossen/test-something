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
        .setDescription('Your Ultimate EPIC RPG Companion! 🎮')
        .addFields(
          {
            name: '🎯 MISSION',
            value:
              'Epic Bot automatically detects and announces EPIC RPG in-game events with instant real-time notifications to keep your server always updated.',
            inline: false,
          },
          {
            name: '🚀 Core Features',
            value:
              '• 🌧️ Auto Coin Rain Detection\n• 🎁 Auto Lootbox Detection\n• 📢 Instant Notifications\n• 🎯 Smart Role Mentions\n• 🔔 Mention Sticker System\n• 🎭 6+ Action Commands',
            inline: false,
          },
          {
            name: '📊 BOT STATISTICS',
            value: ' ',
            inline: false,
          },
          {
            name: '🖥️ Technical Info',
            value: `Version: **1.0.0**\nNode.js: ${process.version}\nLibrary: Discord.js v14\nPrefix: **eb** (case-insensitive)`,
            inline: true,
          },
          {
            name: '📈 Performance',
            value: `Guilds: **${client.guilds.cache.size}**\nUsers: **${client.users.cache.size}**\nPing: **${client.ws.ping}ms**`,
            inline: true,
          },
          {
            name: '👨‍💻 DEVELOPER',
            value: ' ',
            inline: false,
          },
          {
            name: 'Creator',
            value: '<@782630678389981244>',
            inline: true,
          },
          {
            name: '📧 Contact',
            value: 'Discord DM or Server Admin',
            inline: true,
          },
          {
            name: '⚙️ SYSTEM STATUS',
            value: ' ',
            inline: false,
          },
          {
            name: '✨ Active Features',
            value:
              '✅ Coin Rain Monitoring\n✅ Lootbox Monitoring\n✅ Action Commands\n✅ Mention System\n',
            inline: true,
          },
          {
            name: '🔐 Security',
            value:
              '✅ Token Secured\n✅ Rate Limited\n✅ Error Handling\n✅ Verified Bot',
            inline: true,
          },
          {
            name: '🌟 WHY CHOOSE EPIC BOT',
            value:
              '⚡ Lightning Fast Responses\n🎯 Accurate Event Detection\n📱 Mobile Friendly\n🔄 Always Updating\n💪 Reliable & Stable\n🎨 Beautiful Embeds',
            inline: false,
          },
          {
            name: '📝 Latest Updates',
            value:
              '• Added mention sticker system\n• Enhanced action commands\n• Improved event detection\n• Better error handling\n',
            inline: false,
          },
          {
            name: '💬 Support & Feedback',
            value:
              'Have suggestions? Found a bug? Contact the server administrators or reach out to the developer!',
            inline: false,
          }
        )
        .setThumbnail(client.user.avatarURL())
        .setImage(client.user.avatarURL())
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot © 2026',
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });
      logger.info(`About command used by ${message.author.tag}`);
    } catch (error) {
      logger.error('Error in about command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};