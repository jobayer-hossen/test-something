const { PermissionFlagsBits } = require('discord.js');
const SummonerPeriod = require('../database/schemas/SummonerPeriod');

module.exports = {
  name: 'evaluatesummoner',
  aliases: ['evalsum', 'forceeval'],
  description: 'Manually trigger Summoner period evaluation',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message, args, client) {
    try {
      if (!client.features.summonerManager) {
        return message.reply('Summoner manager is not available.');
      }

      if (client.features.summonerManager.isEvaluating) {
        return message.reply('A Summoner evaluation is already running.');
      }

      const activePeriod = await SummonerPeriod.findOne({ status: 'active' }).lean();

      if (!activePeriod) {
        return message.reply('No active Summoner period to evaluate.');
      }

      await message.reply('Starting manual Summoner evaluation...');

      await client.features.summonerManager.evaluatePeriod(activePeriod, false);

      return message.reply('Summoner evaluation completed. Check user-logs for results.');

    } catch (error) {
      console.error('Error in force summoner evaluation:', error);
      return message.reply('An error occurred while running the evaluation.');
    }
  },
};