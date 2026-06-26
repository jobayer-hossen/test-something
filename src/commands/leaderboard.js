const economyService = require('../database/services/economyService');
const Badge = require('../database/schemas/Badge');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'leaderboard',
  description: 'View top players',

  async execute(message, args, client) {
    const type = args[0]?.toLowerCase() || 'gold';

    if (type === 'badges') {
      return this.showBadgeLeaderboard(message);
    }

    return this.showGoldLeaderboard(message);
  },

  async showGoldLeaderboard(message) {
    const users = await economyService.getLeaderboard(10);

    const medals = ['🥇', '🥈', '🥉'];
    const lines = users.map((u, i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} **${u.username}** — ${u.coins.toLocaleString()} 💰`;
    });

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Gold Leaderboard')
      .setDescription(lines.join('\n') || 'No data yet!')
      .setFooter({ text: 'eb leaderboard badges — View badge rankings' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async showBadgeLeaderboard(message) {
    const masters = await Badge.find({ isTournamentMaster: true }).limit(5);
    const topWinners = await Badge.find({}).sort({ tournamentsWon: -1 }).limit(10);

    const masterLines =
      masters.length > 0
        ? masters.map((b) => `👑 **${b.username}** — ${b.badges.join('')}`).join('\n')
        : 'No Tournament Masters yet!';

    const winnerLines = topWinners
      .map((b, i) => `**${i + 1}.** ${b.username} — ${b.tournamentsWon} wins — ${b.badges.join('')}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🏆 Badge Leaderboard')
      .addFields(
        { name: '👑 Tournament Masters', value: masterLines },
        { name: '🏅 Top Tournament Winners', value: winnerLines || 'None yet!' }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};