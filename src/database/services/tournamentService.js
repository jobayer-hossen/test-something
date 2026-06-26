const Tournament = require('../schemas/Tournament');
const Badge = require('../schemas/Badge');
const Logger = require('../../logger');
const logger = new Logger('TournamentService');

class TournamentService {
  async getActiveTournament(guildId) {
    return Tournament.findOne({ guildId, isActive: true });
  }

  async spawnTournament(guildId, channelId) {
    try {
      const existing = await this.getActiveTournament(guildId);
      if (existing) return null;

      const endsAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min join window

      const tournament = new Tournament({
        isActive: true,
        guildId,
        channelId,
        participants: [],
        phase: 'waiting',
        startedAt: new Date(),
        endsAt,
      });

      await tournament.save();
      return tournament;
    } catch (error) {
      logger.error('Error spawning tournament:', error.message);
      return null;
    }
  }

  async joinTournament(guildId, userId, username) {
    try {
      const tournament = await this.getActiveTournament(guildId);
      if (!tournament) return { success: false, reason: 'no_tournament' };
      if (tournament.phase !== 'waiting') return { success: false, reason: 'already_started' };

      const alreadyIn = tournament.participants.find((p) => p.userId === userId);
      if (alreadyIn) return { success: false, reason: 'already_joined' };

      tournament.participants.push({ userId, username });
      await tournament.save();

      return { success: true, tournament, count: tournament.participants.length };
    } catch (error) {
      logger.error('Error joining tournament:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async startBattle(guildId) {
    try {
      const tournament = await this.getActiveTournament(guildId);
      if (!tournament) return { success: false, reason: 'no_tournament' };
      if (tournament.participants.length < 2) {
        return { success: false, reason: 'not_enough_players' };
      }

      tournament.phase = 'battling';

      // Shuffle participants
      const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5);

      // Simulate battles: randomly pick winner
      let remaining = shuffled;
      const rounds = [];

      while (remaining.length > 1) {
        const nextRound = [];
        const roundResults = [];

        for (let i = 0; i < remaining.length; i += 2) {
          if (i + 1 >= remaining.length) {
            nextRound.push(remaining[i]);
            roundResults.push({ winner: remaining[i], bye: true });
          } else {
            const winner = Math.random() < 0.5 ? remaining[i] : remaining[i + 1];
            const loser = winner === remaining[i] ? remaining[i + 1] : remaining[i];
            nextRound.push(winner);
            roundResults.push({ winner, loser });
          }
        }

        rounds.push(roundResults);
        remaining = nextRound;
      }

      const winner = remaining[0];
      const badge = await this.awardBadge(winner.userId, winner.username);

      tournament.winner = { userId: winner.userId, username: winner.username };
      tournament.badgeAwarded = badge.awarded;
      tournament.phase = 'finished';
      tournament.isActive = false;
      tournament.bracket = rounds;

      await tournament.save();

      return {
        success: true,
        winner,
        rounds,
        badge: badge.awarded,
        isMaster: badge.isMaster,
      };
    } catch (error) {
      logger.error('Error starting battle:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async awardBadge(userId, username) {
    try {
      let badgeDoc = await Badge.findOne({ userId });
      if (!badgeDoc) {
        badgeDoc = new Badge({ userId, username });
      }

      const allBadges = Badge.ALL_BADGES;
      const missing = allBadges.filter((b) => !badgeDoc.badges.includes(b));

      let awarded;
      if (missing.length > 0) {
        awarded = missing[Math.floor(Math.random() * missing.length)];
      } else {
        awarded = allBadges[Math.floor(Math.random() * allBadges.length)];
      }

      if (!badgeDoc.badges.includes(awarded)) {
        badgeDoc.badges.push(awarded);
      }

      badgeDoc.tournamentsWon += 1;
      badgeDoc.updatedAt = new Date();

      const isMaster = badgeDoc.hasAllBadges() && !badgeDoc.isTournamentMaster;
      if (isMaster) {
        badgeDoc.isTournamentMaster = true;
        badgeDoc.tournamentMasterAwardedAt = new Date();
      }

      await badgeDoc.save();
      return { awarded, isMaster, badges: badgeDoc.badges };
    } catch (error) {
      logger.error('Error awarding badge:', error.message);
      return { awarded: '🔥', isMaster: false };
    }
  }

  async getBadges(userId) {
    return Badge.findOne({ userId });
  }
}

module.exports = new TournamentService();