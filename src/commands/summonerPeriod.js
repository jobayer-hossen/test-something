const { EmbedBuilder } = require('discord.js');
const SummonerPeriod = require('../database/schemas/SummonerPeriod');
const config = require('../config');

module.exports = {
  name: 'summonerperiod',
  aliases: ['speriod', 'sp'],
  description: 'View current Summoner period information',

  async execute(message, args, client) {
    try {
      const activePeriod = await SummonerPeriod.findOne({ status: 'active' }).lean();

      if (!activePeriod) {
        return message.reply('No active Summoner period found.');
      }

      const startDate = new Date(activePeriod.startDate);
      const endDate = new Date(activePeriod.endDate);
      const now = new Date();

      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const daysElapsed = totalDays - daysRemaining;

      const startTimestamp = `<t:${Math.floor(startDate.getTime() / 1000)}:D>`;
      const endTimestamp = `<t:${Math.floor(endDate.getTime() / 1000)}:D>`;

      const progressBar = this.createProgressBar(daysElapsed, totalDays);

      const embed = new EmbedBuilder()
        .setColor(0x00D9FF)
        .setTitle(`Summoner Period #${activePeriod.periodNumber}`)
        .addFields(
          { name: 'Start Date', value: startTimestamp, inline: true },
          { name: 'End Date', value: endTimestamp, inline: true },
          { name: 'Days Remaining', value: `${daysRemaining} days`, inline: true },
          { name: 'Progress', value: progressBar, inline: false },
          { name: 'Required Threshold', value: `${config.SUMMONER_THRESHOLD} toothbrushes`, inline: true },
          { name: 'Period Length', value: `${config.SUMMONER_PERIOD_DAYS} days`, inline: true }
        )
        .setFooter({ text: `Use "eb ct ${config.SUMMONER_PERIOD_DAYS}d" to check your progress` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in summoner period command:', error);
      return message.reply('An error occurred while fetching period information.');
    }
  },

  createProgressBar(current, total) {
    const percentage = Math.floor((current / total) * 100);
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}%`;
  },
};