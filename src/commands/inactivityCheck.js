const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'inactivitycheck',
  aliases: ['incheck', 'checkinactive'],
  description: 'Manually trigger inactivity check',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message, args, client) {
    try {
      if (!client.features.inactivityMonitor) {
        return message.reply('Inactivity monitor is not available.');
      }

      if (client.features.inactivityMonitor.isRunning) {
        return message.reply('An inactivity check is already running.');
      }

      await message.reply('Starting manual inactivity check...');

      await client.features.inactivityMonitor.runInactivityCheck();

      return message.reply('Inactivity check completed. Check user-logs for results.');

    } catch (error) {
      console.error('Error in manual inactivity check:', error);
      return message.reply('An error occurred while running the inactivity check.');
    }
  },
};