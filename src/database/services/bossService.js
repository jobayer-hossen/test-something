const Boss = require('../schemas/Boss');
const Logger = require('../../logger');
const logger = new Logger('BossService');

const BOSS_NAMES = [
  'Epic Boss', 'Shadow Titan', 'Inferno Dragon',
  'Void Reaper', 'Storm Colossus', 'Ancient Golem',
];

class BossService {
  generateBossHp(playerCount = 5) {
    // Scale HP: base 5000 + 500 per expected player
    return 5000 + playerCount * 500;
  }

  async spawnBoss(guildId, channelId) {
    try {
      // Check if boss already active
      const existing = await Boss.findOne({ guildId: guildId, isActive: true });
      if (existing) return null;

      const name = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
      const maxHp = this.generateBossHp();

      const boss = new Boss({
        isActive: true,
        name,
        maxHp,
        currentHp: maxHp,
        spawnChannelId: channelId,
        spawnGuildId: guildId,
        participants: [],
        isDefeated: false,
      });

      await boss.save();
      return boss;
    } catch (error) {
      logger.error('Error spawning boss:', error.message);
      return null;
    }
  }

  async getActiveBoss(guildId) {
    return Boss.findOne({ spawnGuildId: guildId, isActive: true, isDefeated: false });
  }

  async joinFight(guildId, userId, username) {
    try {
      const boss = await this.getActiveBoss(guildId);
      if (!boss) return { success: false, reason: 'no_boss' };
      if (boss.isDefeated) return { success: false, reason: 'defeated' };

      const alreadyIn = boss.participants.find((p) => p.userId === userId);
      if (!alreadyIn) {
        boss.participants.push({ userId, username, damageDealt: 0, hits: 0 });
        await boss.save();
      }

      // Check minimum players
      if (boss.participants.length < boss.minPlayers) {
        return {
          success: true,
          boss,
          waitingForPlayers: true,
          needed: boss.minPlayers - boss.participants.length,
        };
      }

      return { success: true, boss, waitingForPlayers: false };
    } catch (error) {
      logger.error('Error joining fight:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async dealDamage(guildId, userId, username) {
    try {
      const boss = await this.getActiveBoss(guildId);
      if (!boss) return { success: false, reason: 'no_boss' };
      if (boss.isDefeated) return { success: false, reason: 'defeated' };

      if (boss.participants.length < boss.minPlayers) {
        return { success: false, reason: 'not_enough_players' };
      }

      const participant = boss.participants.find((p) => p.userId === userId);
      if (!participant) return { success: false, reason: 'not_joined' };

      // Random damage 50-200
      const damage = Math.floor(Math.random() * 151) + 50;
      const actualDamage = Math.min(damage, boss.currentHp);

      boss.currentHp -= actualDamage;
      participant.damageDealt += actualDamage;
      participant.hits += 1;
      boss.lastHitter = { userId, username };

      const killed = boss.currentHp <= 0;
      if (killed) {
        boss.isActive = false;
        boss.isDefeated = true;
      }

      await boss.save();

      return {
        success: true,
        damage: actualDamage,
        boss,
        killed,
        participants: boss.participants,
        lastHitter: boss.lastHitter,
      };
    } catch (error) {
      logger.error('Error dealing damage:', error.message);
      return { success: false, reason: 'error' };
    }
  }
}

module.exports = new BossService();