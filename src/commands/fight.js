const bossService = require('../database/services/bossService');
const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const { EmbedBuilder } = require('discord.js');

// Per-user fight cooldown (30 seconds)
const fightCooldowns = new Map();
const FIGHT_COOLDOWN = 30 * 100;

module.exports = {
  name: 'fight',
  description: 'Fight the Epic Boss!',

  async execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    const guildId = message.guild.id;

    await userService.getOrCreateUser(userId, username);

    // Personal cooldown check
    const lastFight = fightCooldowns.get(userId);
    if (lastFight) {
      const remaining = FIGHT_COOLDOWN - (Date.now() - lastFight);
      if (remaining > 0) {
        const secs = Math.ceil(remaining / 100);
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⚔️ Catching Breath...')
          .setDescription(`You need to rest! Fight again in **${secs}s**`)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
    }

    // Try to join fight first
    const joinResult = await bossService.joinFight(guildId, userId, username);

    if (!joinResult.success) {
      const reasons = {
        no_boss: '❌ No boss is active right now! Use `eb work` or `eb search` to trigger one.',
        defeated: '❌ The boss has already been defeated!',
        error: '❌ Something went wrong. Try again!',
      };

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⚔️ Cannot Fight!')
        .setDescription(reasons[joinResult.reason] || '❌ Unknown error')
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Waiting for players
    if (joinResult.waitingForPlayers) {
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`⚔️ Joined the Fight Against ${joinResult.boss.name}!`)
        .setDescription(
          `You joined the battle!\n` +
          `**Waiting for more warriors...**\n\n` +
          `**Current:** \`${joinResult.boss.participants.length}/${joinResult.boss.minPlayers}\` players\n` +
          `**Still need:** \`${joinResult.needed}\` more fighters!`
        )
        .addFields({
          name: '📢 Spread the Word!',
          value: 'Get your friends to use `eb fight` to join!',
        })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Deal damage
    fightCooldowns.set(userId, Date.now());
    const fightResult = await bossService.dealDamage(guildId, userId, username);

    if (!fightResult.success) {
      const reasons = {
        no_boss: '❌ Boss disappeared!',
        not_joined: '❌ Use `eb fight` to join the battle first!',
        not_enough_players: `❌ Need ${5} players to start fighting!`,
        defeated: '❌ Boss already defeated!',
      };

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⚔️ Fight Failed!')
        .setDescription(reasons[fightResult.reason] || '❌ Error')
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const { boss, damage, killed } = fightResult;
    const hpPercent = Math.floor((boss.currentHp / boss.maxHp) * 100);
    const hpBar = this.buildHpBar(boss.currentHp, boss.maxHp);

    if (killed) {
      // Distribute rewards
      const rewards = [];
      for (const participant of fightResult.participants) {
        const isLastHit = participant.userId === fightResult.lastHitter.userId;
        const reward = isLastHit
          ? 300 + Math.floor(Math.random() * 151) + 50
          : Math.floor(Math.random() * 151) + 50;

        await economyService.addCoins(participant.userId, reward);
        rewards.push({
          username: participant.username,
          reward,
          isLastHit,
          damage: participant.damageDealt,
        });
      }

      rewards.sort((a, b) => b.damage - a.damage);

      const rewardLines = rewards
        .map(
          (r) =>
            `${r.isLastHit ? '🏆' : '⚔️'} **${r.username}**: +${r.reward} 💰` +
            `${r.isLastHit ? ' *(Kill Shot!)*' : ''}`
        )
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`💀 ${boss.name} DEFEATED!`)
        .setDescription(
          `**${message.author.username}** dealt the killing blow!\n\n` +
          `**Final damage dealt:** \`${damage}\`\n\n` +
          `**🎁 Rewards:**\n${rewardLines}`
        )
        .setFooter({ text: `${fightResult.participants.length} warriors participated` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle(`⚔️ Attack on ${boss.name}!`)
      .setDescription(
        `**${username}** dealt **${damage}** damage!\n\n` +
        `**${boss.name} HP:**\n${hpBar}\n` +
        `\`${boss.currentHp}/${boss.maxHp}\` (\`${hpPercent}%\`)\n\n` +
        `**Fighters:** \`${boss.participants.length}\``
      )
      .setFooter({ text: 'Keep fighting! Last hit earns 300+ gold bonus!' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  buildHpBar(current, max, length = 15) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    const color = filled > length * 0.5 ? '🟩' : filled > length * 0.25 ? '🟨' : '🟥';
    return color.repeat(filled) + '⬛'.repeat(empty);
  },
};