const tournamentService = require('../database/services/tournamentService');
const economyService = require('../database/services/economyService');
const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('TournamentManager');

const JOIN_WORDS = ['lol', 'cry', 'bet', 'run', 'enchant'];
const TOURNAMENT_INTERVAL = 60 * 60 * 1000; // 1 hour
const JOIN_WINDOW = 5 * 60 * 1000; // 5 min to join
const BATTLE_DELAY = 10 * 1000; // 10s after window closes

class TournamentManager {
  constructor(client) {
    this.client = client;
    this.tournamentChannel = null;
    this.activeGuildId = null;
    this.joinTimer = null;
    this.spawnTimer = null;
  }

  start(guildId, channelId) {
    this.activeGuildId = guildId;
    this.tournamentChannel = channelId;
    logger.info(`Tournament Manager started for guild ${guildId}`);
    this.scheduleNext();
  }

  scheduleNext() {
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    this.spawnTimer = setTimeout(() => this.spawnTournament(), TOURNAMENT_INTERVAL);
    logger.info(`Next tournament in ${TOURNAMENT_INTERVAL / 60000} minutes`);
  }

  async spawnTournament() {
    try {
      if (!this.activeGuildId || !this.tournamentChannel) return;

      const tournament = await tournamentService.spawnTournament(
        this.activeGuildId,
        this.tournamentChannel
      );

      if (!tournament) {
        this.scheduleNext();
        return;
      }

      const channel = await this.client.channels.fetch(this.tournamentChannel).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('🏟️ TOURNAMENT MASTER EVENT BEGINS!')
        .setDescription(
          `A grand tournament has been summoned!\n\n` +
          `**⏰ Join Window:** 5 minutes\n` +
          `**🎖️ Prize:** Random Badge (collect all 7 for Tournament Master!)\n\n` +
          `**🗡️ How to Join:**\n` +
          JOIN_WORDS.map((w) => `\`${w}\``).join(' • ') +
          `\n\n**All badges:** 🔥 💧 ⚡ 🌪️ 🌈 ❄️ 🌿`
        )
        .setFooter({ text: 'Collect all 7 badges to unlock Tournament Master role!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // After join window, start battle
      this.joinTimer = setTimeout(async () => {
        await this.startBattle(channel);
      }, JOIN_WINDOW + BATTLE_DELAY);

      this.scheduleNext();
    } catch (error) {
      logger.error('Error spawning tournament:', error.message);
      this.scheduleNext();
    }
  }

  async handleJoinWord(message) {
    if (!this.activeGuildId || message.guild?.id !== this.activeGuildId) return;

    const content = message.content.toLowerCase().trim();
    if (!JOIN_WORDS.includes(content)) return;

    const result = await tournamentService.joinTournament(
      message.guild.id,
      message.author.id,
      message.author.username
    );

    if (!result.success) {
      if (result.reason === 'already_joined') {
        await message.react('✅').catch(() => {});
      }
      return;
    }

    await message.react('⚔️').catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('⚔️ Joined Tournament!')
      .setDescription(
        `**${message.author.username}** entered the arena!\n` +
        `**Total Fighters:** \`${result.count}\``
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }

  async startBattle(channel) {
    try {
      if (!this.activeGuildId) return;

      const tournament = await tournamentService.getActiveTournament(this.activeGuildId);
      if (!tournament || tournament.participants.length < 2) {
        const embed = new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle('🏟️ Tournament Cancelled')
          .setDescription('Not enough participants! (Minimum: 2 players)')
          .setTimestamp();

        // Mark inactive
        if (tournament) {
          tournament.isActive = false;
          tournament.phase = 'finished';
          await tournament.save();
        }

        await channel.send({ embeds: [embed] });
        return;
      }

      const startEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⚔️ BATTLE BEGINS!')
        .setDescription(
          `**${tournament.participants.length}** warriors enter the arena!\n` +
          `May the strongest prevail! ⚔️`
        )
        .setTimestamp();

      await channel.send({ embeds: [startEmbed] });

      // Simulate rounds
      await new Promise((r) => setTimeout(r, 3000));

      const result = await tournamentService.startBattle(this.activeGuildId);

      if (!result.success) {
        await channel.send('❌ Battle failed unexpectedly!');
        return;
      }

      // Show round results
      for (let i = 0; i < result.rounds.length; i++) {
        const roundLines = result.rounds[i]
          .map((match) =>
            match.bye
              ? `⏭️ **${match.winner.username}** advances (bye)`
              : `⚔️ **${match.winner.username}** defeated **${match.loser.username}**`
          )
          .join('\n');

        const roundEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🏟️ Round ${i + 1}`)
          .setDescription(roundLines)
          .setTimestamp();

        await channel.send({ embeds: [roundEmbed] });
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Winner announcement
      const masterLine = result.isMaster
        ? `\n\n👑 **${result.winner.username}** has collected ALL 7 badges!\n**TOURNAMENT MASTER UNLOCKED!** 👑`
        : '';

      const winnerEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 TOURNAMENT WINNER!')
        .setDescription(
          `🎉 **${result.winner.username}** is the last one standing!\n\n` +
          `**Badge Earned:** ${result.badge}\n` +
          masterLine
        )
        .setFooter({ text: 'Collect all 7 badges: 🔥 💧 ⚡ 🌪️ 🌈 ❄️ 🌿' })
        .setTimestamp();

      await channel.send({ embeds: [winnerEmbed] });

      // Apply Tournament Master role if earned
      if (result.isMaster) {
        await this.applyMasterRole(channel.guild, result.winner.userId);
      }
    } catch (error) {
      logger.error('Error in tournament battle:', error.message);
    }
  }

  async applyMasterRole(guild, userId) {
    try {
      // Find or create Tournament Master role
      let role = guild.roles.cache.find((r) => r.name === 'Tournament Master');
      if (!role) {
        role = await guild.roles.create({
          name: 'Tournament Master',
          color: '#FFD700',
          reason: 'Auto-created for Tournament Master achievement',
        });
      }

      const member = await guild.members.fetch(userId);
      if (member) await member.roles.add(role);
      logger.info(`Applied Tournament Master role to ${userId}`);
    } catch (error) {
      logger.error('Error applying master role:', error.message);
    }
  }
}

module.exports = TournamentManager;