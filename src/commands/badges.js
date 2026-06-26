const tournamentService = require('../database/services/tournamentService');
const { EmbedBuilder } = require('discord.js');
const Badge = require('../database/schemas/Badge');

module.exports = {
  name: 'badges',
  description: 'View your tournament badges',

  async execute(message, args, client) {
    const targetUser = message.mentions.users.first() || message.author;
    const badgeDoc = await tournamentService.getBadges(targetUser.id);

    const allBadges = Badge.ALL_BADGES;

    if (!badgeDoc || badgeDoc.badges.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`🏅 ${targetUser.username}'s Badges`)
        .setDescription(
          'No badges yet!\nWin tournaments to collect badges.\n\n' +
          `**Available:** ${allBadges.join(' ')}`
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const collected = badgeDoc.badges.join(' ');
    const missing = allBadges.filter((b) => !badgeDoc.badges.includes(b));
    const missingDisplay = missing.length > 0 ? missing.join(' ') : 'None! 🎉';
    const progressBar = this.buildProgressBar(badgeDoc.badges.length, allBadges.length);

    const embed = new EmbedBuilder()
      .setColor(badgeDoc.isTournamentMaster ? '#FFD700' : '#3498DB')
      .setTitle(
        `${badgeDoc.isTournamentMaster ? '👑 TOURNAMENT MASTER' : '🏅 Badge Collection'} — ${targetUser.username}`
      )
      .addFields(
        { name: '🏅 Collected Badges', value: collected || 'None', inline: false },
        { name: '❌ Missing Badges', value: missingDisplay, inline: false },
        {
          name: '📊 Progress',
          value: `${progressBar} \`${badgeDoc.badges.length}/${allBadges.length}\``,
          inline: false,
        },
        { name: '🏆 Tournaments Won', value: `${badgeDoc.tournamentsWon}`, inline: true }
      )
      .setFooter({
        text: badgeDoc.isTournamentMaster
          ? '👑 This player has achieved Tournament Master!'
          : 'Collect all 7 badges to become Tournament Master!',
      })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  buildProgressBar(current, max) {
    const filled = Math.round((current / max) * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  },
};