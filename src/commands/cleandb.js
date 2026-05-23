const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');
const User = require('../database/schemas/User');

const logger = new Logger('CleanDBCommand');

module.exports = {
  name: 'cleandb',
  description: 'Clean bot users from database (Admin only)',

  async execute(message, args, client) {
    try {
      // Check if user is admin (change this ID to your admin ID)
      if (message.author.id !== '782630678389981244') {
        return await message.channel.send('❌ Only admins can use this command!');
      }

      const thinkingMsg = await message.channel.send('🧹 Cleaning database...');

      // Get bot user IDs from guild
      const botIds = message.guild.members.cache
        .filter(member => member.user.bot)
        .map(member => member.user.id);

      logger.info(`Found ${botIds.length} bots to remove`);

      // Delete bot users from database
      const result = await User.deleteMany({ userId: { $in: botIds } });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Database Cleaned')
        .setDescription('Bot users have been removed from the database!')
        .addFields(
          {
            name: '🗑️ Deleted',
            value: `${result.deletedCount} bot users`,
            inline: true,
          },
          {
            name: '📊 Remaining',
            value: `${await User.countDocuments()} users`,
            inline: true,
          }
        )
        .setTimestamp();

      await thinkingMsg.edit({ content: null, embeds: [embed] });

      logger.info(`Cleaned ${result.deletedCount} bot users from database`);
    } catch (error) {
      logger.error('Error in cleandb command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};