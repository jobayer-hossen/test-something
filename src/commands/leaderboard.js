const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');
const userService = require('../database/services/userService');

const logger = new Logger('LeaderboardCommand');

module.exports = {
  name: 'leaderboard',
  description: 'View top players leaderboard',

  async execute(message, args, client) {
    try {
      // Get sort type from args (coins, xp, commandsUsed, level)
      const sortBy = args[0]?.toLowerCase() || 'coins';
      const validSortTypes = ['coins', 'xp', 'commandsused', 'level', 'commands'];

      // Map command to database field
      let sortField = 'coins';
      if (sortBy === 'xp') sortField = 'xp';
      if (sortBy === 'commands' || sortBy === 'commandsused') sortField = 'commandsUsed';
      if (sortBy === 'level') sortField = 'level';

      // Get top 10 users
      const topUsers = await userService.getTopUsers(10, sortField);

      if (!topUsers || topUsers.length === 0) {
        return await message.channel.send('❌ No users found in database!');
      }

      // Build leaderboard string
      let leaderboardText = '';
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      topUsers.forEach((user, index) => {
        const medal = medals[index];
        const value = this.formatValue(user[sortField], sortField);
        leaderboardText += `${medal} **${user.username}** - ${value}\n`;
      });

      // Create leaderboard embed
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 Leaderboard - Top 10 by ${this.getSortLabel(sortField)}`)
        .setDescription(leaderboardText)
        .addFields(
          {
            name: '📊 Available Sorts',
            value: '`eb leaderboard coins` - By coins\n`eb leaderboard xp` - By XP\n`eb leaderboard level` - By level\n`eb leaderboard commands` - By commands used',
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot | Leaderboard System',
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });

      // Track command usage
      await userService.incrementCommandsUsed(message.author.id);

      logger.info(`Leaderboard viewed (sorted by ${sortField})`);
    } catch (error) {
      logger.error('Error in leaderboard command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },

  /**
   * Format value based on type
   */
  formatValue(value, type) {
    if (type === 'coins') {
      return `💰 ${value.toLocaleString()} coins`;
    }
    if (type === 'xp') {
      return `📈 ${value} XP`;
    }
    if (type === 'commandsUsed') {
      return `⌨️ ${value} commands`;
    }
    if (type === 'level') {
      return `⭐ Level ${value}`;
    }
    return value;
  },

  /**
   * Get sort label
   */
  getSortLabel(sortField) {
    const labels = {
      coins: 'Coins 💰',
      xp: 'XP 📈',
      commandsUsed: 'Commands ⌨️',
      level: 'Level ⭐',
    };
    return labels[sortField] || 'Coins';
  },
};