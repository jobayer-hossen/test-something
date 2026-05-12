const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('StatusCommand');

module.exports = {
  name: 'status',
  description: 'Check bot status and statistics',

  async execute(message, args, client) {
    try {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const ping = client.ws.ping;
      const status = ping < 100 ? '✅ Excellent' : ping < 200 ? '✅ Good' : '⚠️ Fair';

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🤖 Epic Bot Status')
        .addFields(
          {
            name: '🟢 Status',
            value: status,
            inline: true,
          },
          {
            name: '⏱️ Uptime',
            value: `${hours}h ${minutes}m ${seconds}s`,
            inline: true,
          },
          {
            name: '🔌 Ping',
            value: `${ping}ms`,
            inline: true,
          },
          {
            name: '💾 Memory Usage',
            value: `${memoryUsage}MB`,
            inline: true,
          },
          {
            name: '📊 Guilds',
            value: `${client.guilds.cache.size}`,
            inline: true,
          },
          {
            name: '👥 Users',
            value: `${client.users.cache.size}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      logger.info(`Status command used by ${message.author.tag}`);
    } catch (error) {
      logger.error('Error in status command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};