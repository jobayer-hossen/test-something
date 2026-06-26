const Harem = require('../schemas/Harem');
const Logger = require('../../logger');
const logger = new Logger('HaremService');

class HaremService {
  async createHarem(ownerId, ownerUsername, name, guildId, initialMembers = []) {
    try {
      const existing = await Harem.findOne({ ownerId, guildId, isActive: true });
      if (existing) return { success: false, reason: 'already_has_harem' };

      if (initialMembers.length < 2) {
        return { success: false, reason: 'need_3_members' };
      }

      const members = [
        { userId: ownerId, username: ownerUsername },
        ...initialMembers.map((m) => ({ userId: m.userId, username: m.username })),
      ];

      const harem = new Harem({
        name,
        ownerId,
        ownerUsername,
        guildId,
        members,
        treasury: 0,
        dailyDistribution: 100,
      });

      await harem.save();
      return { success: true, harem };
    } catch (error) {
      logger.error('Error creating harem:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async getHarem(ownerId, guildId) {
    return Harem.findOne({ ownerId, guildId, isActive: true });
  }

  async getHaremByMember(userId, guildId) {
    return Harem.findOne({
      guildId,
      isActive: true,
      'members.userId': userId,
    });
  }

  async addMember(haremId, userId, username) {
    try {
      const harem = await Harem.findById(haremId);
      if (!harem) return { success: false, reason: 'not_found' };

      const alreadyIn = harem.members.find((m) => m.userId === userId);
      if (alreadyIn) return { success: false, reason: 'already_member' };

      harem.members.push({ userId, username });
      await harem.save();
      return { success: true, harem };
    } catch (error) {
      logger.error('Error adding member:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async depositToTreasury(ownerId, guildId, amount) {
    try {
      const harem = await this.getHarem(ownerId, guildId);
      if (!harem) return { success: false, reason: 'no_harem' };

      harem.treasury += amount;
      await harem.save();
      return { success: true, treasury: harem.treasury };
    } catch (error) {
      logger.error('Error depositing:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async distributeDaily(haremId) {
    try {
      const harem = await Harem.findById(haremId);
      if (!harem) return { success: false, reason: 'not_found' };

      const now = Date.now();
      const lastDist = harem.lastDistribution
        ? harem.lastDistribution.getTime()
        : 0;

      if (now - lastDist < 24 * 60 * 60 * 1000) {
        return { success: false, reason: 'cooldown' };
      }

      const nonOwnerMembers = harem.members.filter(
        (m) => m.userId !== harem.ownerId
      );

      const perMember = harem.dailyDistribution;
      const totalNeeded = perMember * nonOwnerMembers.length;

      if (harem.treasury < totalNeeded) {
        return {
          success: false,
          reason: 'insufficient_treasury',
          treasury: harem.treasury,
          needed: totalNeeded,
        };
      }

      harem.treasury -= totalNeeded;
      harem.lastDistribution = new Date();

      for (const member of harem.members) {
        if (member.userId !== harem.ownerId) {
          member.totalReceived += perMember;
        }
      }

      await harem.save();

      return {
        success: true,
        perMember,
        members: nonOwnerMembers,
        remainingTreasury: harem.treasury,
      };
    } catch (error) {
      logger.error('Error distributing daily:', error.message);
      return { success: false, reason: 'error' };
    }
  }

  async returnGold(memberId, haremId, amount) {
    try {
      const harem = await Harem.findById(haremId);
      if (!harem) return { success: false, reason: 'not_found' };

      const member = harem.members.find((m) => m.userId === memberId);
      if (!member) return { success: false, reason: 'not_member' };

      member.totalReturned += amount;
      harem.treasury += amount;
      await harem.save();

      return { success: true, treasury: harem.treasury };
    } catch (error) {
      logger.error('Error returning gold:', error.message);
      return { success: false, reason: 'error' };
    }
  }
}

module.exports = new HaremService();