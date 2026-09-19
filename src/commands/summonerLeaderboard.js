const { EmbedBuilder } = require('discord.js');
const CommandTracker = require('../database/schemas/CommandTracker');
const SummonerPeriod = require('../database/schemas/SummonerPeriod');
const config = require('../config');

module.exports = {
  name: 'summonerboard',
  aliases: ['sboard', 'slb'],
  description: 'View Summoner leaderboard for current period',

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

      const allRecords = await CommandTracker.find({
        command: config.TOOTHBRUSH_COMMAND,
        date: { $in: dates },
      }).lean();

      const userMap = new Map();

      for (const record of allRecords) {
        const existing = userMap.get(record.userId) || {
          userId: record.userId,
          username: record.username,
          displayName: record.displayName || record.username,
          total: 0,
        };

        existing.total += record.count;
        userMap.set(record.userId, existing);
      }

      const sortedUsers = Array.from(userMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      if (sortedUsers.length === 0) {
        return message.reply('No toothbrush data found for the current period.');
      }

      const medals = ['🥇', '🥈', '🥉'];

      let description = `**Period #${activePeriod.periodNumber}**\n\n`;

      sortedUsers.forEach((user, index) => {
        const medal = medals[index] || `\`${String(index + 1).padStart(2, '0')}\``;
        const name = user.displayName.substring(0, 20);
        const count = user.total.toLocaleString();
        const status = user.total >= config.SUMMONER_THRESHOLD ? '✅' : '';

        description += `${medal} **${name}** - ${count} ${status}\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x00D9FF)
        .setTitle('Summoner Leaderboard')
        .setDescription(description)
        .setFooter({ text: `Threshold: ${config.SUMMONER_THRESHOLD} toothbrushes | ✅ = Qualified` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in summoner leaderboard:', error);
      return message.reply('An error occurred while fetching the leaderboard.');
    }
  },
};