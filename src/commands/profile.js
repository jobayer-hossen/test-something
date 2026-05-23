const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');
const userService = require('../database/services/userService');

const logger = new Logger('ProfileCommand');

module.exports = {
  name: 'profile',
  description: 'View user profile and statistics',

  async execute(message, args, client) {
    try {
      // Get mentioned user or use message author
      const targetUser = message.mentions.users.first() || message.author;

      // Get or create user in database
      const user = await userService.getOrCreateUser(targetUser.id, targetUser.username);

      if (!user) {
        return await message.channel.send('❌ Could not fetch user profile!');
      }

      // Get user rank
      const rank = await userService.getUserRank(targetUser.id, 'coins');

      // Create profile embed
      const embed = new EmbedBuilder()
        .setColor('#9D4EDD')
        .setTitle(`👤 ${targetUser.username}'s Profile`)
        .setThumbnail(targetUser.avatarURL())
        .addFields(
          {
            name: '📊 STATISTICS',
            value: ' ',
            inline: false,
          },
          {
            name: '⭐ Level',
            value: `${user.level}`,
            inline: true,
          },
          {
            name: '📈 XP',
            value: `${user.xp}`,
            inline: true,
          },
          {
            name: '💰 Coins',
            value: `${user.coins.toLocaleString()}`,
            inline: true,
          },
          {
            name: '⌨️ Commands Used',
            value: `${user.commandsUsed}`,
            inline: true,
          },
          {
            name: '🏆 Rank (by coins)',
            value: `#${rank}`,
            inline: true,
          },
          {
            name: '📅 Member Since',
            value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: '🎯 ACHIEVEMENTS',
            value: ' ',
            inline: false,
          },
          {
            name: '🌟 Milestones',
            value: this.getMilestones(user),
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot | Profile System',
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });

      // Track command usage
      await userService.incrementCommandsUsed(message.author.id);

      logger.info(`Profile viewed for ${targetUser.tag}`);
    } catch (error) {
      logger.error('Error in profile command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },

  /**
   * Get milestones based on user stats
   */
  getMilestones(user) {
    const milestones = [];

    if (user.level >= 5) milestones.push('🥉 Level 5');
    if (user.level >= 10) milestones.push('🥈 Level 10');
    if (user.level >= 20) milestones.push('🥇 Level 20');
    if (user.coins >= 1000000) milestones.push('💰 1M Coins');
    if (user.coins >= 1000000000) milestones.push('💸 1B Coins');
    if (user.commandsUsed >= 10) milestones.push('🎯 10 Commands');
    if (user.commandsUsed >= 50) milestones.push('⚡ 50 Commands');
    if (user.xp >= 100) milestones.push('✨ 100 XP');

    return milestones.length > 0 ? milestones.join('\n') : 'No milestones yet!';
  },
};