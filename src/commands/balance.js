const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'balance',
  description: 'Check your gold balance',

  async execute(message, args, client) {
    const targetUser = message.mentions.users.first() || message.author;
    await userService.getOrCreateUser(targetUser.id, targetUser.username);
    const balance = await economyService.getBalance(targetUser.id);
    const userDoc = await userService.getUserLevel(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 ${targetUser.username}'s Wallet`)
      .addFields(
        { name: '💰 Gold', value: `${balance.toLocaleString()} gold`, inline: true },
        { name: '⚡ Level', value: `${userDoc || 1}`, inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: 'Use eb daily, eb work, eb search to earn more!' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};