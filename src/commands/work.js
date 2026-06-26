const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const bossService = require('../database/services/bossService');
const { EmbedBuilder } = require('discord.js');

const WORK_MESSAGES = [
  'You mined some precious ore',
  'You crafted legendary weapons',
  'You slayed some goblins for bounty',
  'You escorted a merchant safely',
  'You completed a guild quest',
  'You gathered rare herbs',
];

module.exports = {
  name: 'work',
  description: 'Work to earn 25–80 gold (1h cooldown)',

  async execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;

    await userService.getOrCreateUser(userId, username);

    const result = await economyService.claimWork(userId, username);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⏰ Still Working!')
        .setDescription(
          `You're still tired from last time.\n` +
          `**Rest for:** \`${result.formatted}\``
        )
        .setFooter({ text: message.author.username })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const workMsg = WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)];

    const embed = new EmbedBuilder()
      .setColor('#4CAF50')
      .setTitle('⚒️ Work Complete!')
      .setDescription(
        `${workMsg}!\n` +
        `You earned **${result.reward} 💰 gold**!\n` +
        `**New Balance:** \`${result.newBalance} 💰\``
      )
      .addFields({ name: '⏰ Next Work', value: 'In 1 hour', inline: true })
      .setFooter({ text: message.author.username })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

    // Spawn boss if triggered
    if (result.spawnBoss) {
      const boss = await bossService.spawnBoss(message.guild.id, message.channel.id);
      if (boss) {
        const bossEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(`⚠️ EPIC BOSS APPEARED: ${boss.name}!`)
          .setDescription(
            `A powerful boss has been disturbed by your work!\n\n` +
            `**HP:** \`${boss.currentHp}/${boss.maxHp}\`\n` +
            `**Min Players:** \`${boss.minPlayers}\`\n\n` +
            `Use \`eb fight\` to join the battle!\n` +
            `⚠️ Need at least **${boss.minPlayers} fighters** to start dealing damage!`
          )
          .setFooter({ text: 'All participants earn rewards • Last hit = bonus reward!' })
          .setTimestamp();

        message.channel.send({ embeds: [bossEmbed] });
      }
    }
  },
};