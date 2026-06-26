const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const bossService = require('../database/services/bossService');
const { EmbedBuilder } = require('discord.js');

const SEARCH_LOCATIONS = [
  'the Enchanted Forest', 'the Ancient Dungeon', 'the Abandoned Castle',
  'the Mystic Cave', 'the Dragon Graveyard', 'the Haunted Ruins',
  'the Sunken Temple', 'the Frozen Wasteland',
];

module.exports = {
  name: 'search',
  description: 'Search for 50–200 gold (3h cooldown)',

  async execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;

    await userService.getOrCreateUser(userId, username);

    const result = await economyService.claimSearch(userId, username);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⏰ Still Searching!')
        .setDescription(
          `You're still exploring from last time.\n` +
          `**Return in:** \`${result.formatted}\``
        )
        .setFooter({ text: message.author.username })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const location = SEARCH_LOCATIONS[Math.floor(Math.random() * SEARCH_LOCATIONS.length)];

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🔍 Search Complete!')
      .setDescription(
        `You searched through **${location}**!\n` +
        `You found **${result.reward} 💰 gold**!\n` +
        `**New Balance:** \`${result.newBalance} 💰\``
      )
      .addFields({ name: '⏰ Next Search', value: 'In 3 hours', inline: true })
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
            `Your search awakened a dormant boss!\n\n` +
            `**HP:** \`${boss.currentHp}/${boss.maxHp}\`\n` +
            `**Min Players:** \`${boss.minPlayers}\`\n\n` +
            `Use \`eb fight\` to join the battle!\n` +
            `⚠️ Need at least **${boss.minPlayers} fighters** to start!`
          )
          .setFooter({ text: 'All participants earn rewards • Last hit = bonus reward!' })
          .setTimestamp();

        message.channel.send({ embeds: [bossEmbed] });
      }
    }
  },
};