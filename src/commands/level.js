const { EmbedBuilder } = require('discord.js');
const userService = require('../database/services/userService');

module.exports = {
  name: 'level',
  description: 'Check your current level and base unlock progress',
  async execute(message, args, client) {
    const user = await userService.getOrCreateUser(message.author.id, message.author.username);
    
    const xpNeeded = user.level * 100;
    const progress = Math.round((user.xp / xpNeeded) * 100);
    const unlockStatus = user.level >= 10 ? "✅ **UNLOCKED**" : `❌ Locked (Reach Level 10)`;

    const embed = new EmbedBuilder()
      .setColor(user.level >= 10 ? '#00FF00' : '#FFA500')
      .setTitle(`⭐ ${message.author.username}'s Level Progress`)
      .addFields(
        { name: 'Current Level', value: `Lvl ${user.level}`, inline: true },
        { name: 'XP Progress', value: `${user.xp} / ${xpNeeded} (${progress}%)`, inline: true },
        { name: '🏠 Base Status', value: unlockStatus, inline: false }
      )
      .setFooter({ text: "Send messages in the server to earn XP!" });

    await message.channel.send({ embeds: [embed] });
  }
};