const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'daily',
  description: 'Claim your daily 250 gold reward',

  async execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;

    await userService.getOrCreateUser(userId, username);

    const result = await economyService.claimDaily(userId, username);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⏰ Daily Already Claimed!')
        .setDescription(
          `You already claimed your daily reward.\n` +
          `**Come back in:** \`${result.formatted}\``
        )
        .setFooter({ text: message.author.username })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 Daily Reward Claimed!')
      .setDescription(
        `You received **250 💰 gold**!\n` +
        `**New Balance:** \`${result.newBalance} 💰\``
      )
      .addFields(
        { name: '⏰ Next Claim', value: 'In 24 hours', inline: true },
        { name: '💡 Tip', value: 'Use `eb work` and `eb search` for more gold!', inline: true }
      )
      .setFooter({ text: message.author.username })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};