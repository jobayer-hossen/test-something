const { EmbedBuilder } = require('discord.js');
const CommandTracker = require('../database/schemas/CommandTracker');
const SummonerPeriod = require('../database/schemas/SummonerPeriod');
const User = require('../database/schemas/User');
const config = require('../config');

module.exports = {
  name: 'myprogress',
  aliases: ['mp', 'progress'],
  description: 'Check your Summoner progress for current period',

  async execute(message, args, client) {
    try {
      const activePeriod = await SummonerPeriod.findOne({ status: 'active' }).lean();

      if (!activePeriod) {
        return message.reply('No active Summoner period found.');
      }

      const startDate = new Date(activePeriod.startDate);
      const endDate = new Date(activePeriod.endDate);

      const dates = [];
      const current = new Date(startDate);

      while (current <= endDate && current <= new Date()) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const records = await CommandTracker.find({
        userId: message.author.id,
        command: config.TOOTHBRUSH_COMMAND,
        date: { $in: dates },
      }).lean();

      const totalCount = records.reduce((sum, record) => sum + record.count, 0);
      const remaining = Math.max(0, config.SUMMONER_THRESHOLD - totalCount);
      const percentage = Math.min(100, Math.floor((totalCount / config.SUMMONER_THRESHOLD) * 100));

      const user = await User.findOne({ userId: message.author.id }).lean();
      const hasRole = message.member.roles.cache.has(config.SUMMONER_ROLE_ID);
      const hasOverride = user?.summonerManualOverride || false;

      const progressBar = this.createProgressBar(totalCount, config.SUMMONER_THRESHOLD);

      const embed = new EmbedBuilder()
        .setColor(totalCount >= config.SUMMONER_THRESHOLD ? 0x00FF00 : 0xFFB84D)
        .setTitle(`Summoner Progress - Period #${activePeriod.periodNumber}`)
        .setDescription(`${message.author.username}'s progress`)
        .addFields(
          { name: 'Toothbrush Count', value: `${totalCount}/${config.SUMMONER_THRESHOLD}`, inline: true },
          { name: 'Remaining', value: remaining > 0 ? `${remaining}` : 'Threshold met!', inline: true },
          { name: 'Progress', value: progressBar, inline: false },
          { name: 'Has Summoner Role', value: hasRole ? 'Yes' : 'No', inline: true },
          { name: 'Manual Override', value: hasOverride ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ text: `Period ends on ${endDate.toLocaleDateString()}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in my progress command:', error);
      return message.reply('An error occurred while fetching your progress.');
    }
  },

  createProgressBar(current, total) {
    const percentage = Math.min(100, Math.floor((current / total) * 100));
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}%`;
  },
};