const Logger = require('../logger');
const User = require('../database/schemas/User');
const RoleChangeLog = require('../database/schemas/RoleChangeLog');
const config = require('../config');
const { AuditLogEvent } = require('discord.js');

const logger = new Logger('RoleManager');

class RoleManager {
  constructor(client) {
    this.client = client;
    this.processingUpdates = new Set();
  }

  async handleRoleUpdate(oldMember, newMember) {
    try {
      // ONLY track real users, not bots
      if (newMember.user.bot) return;

      const updateKey = `${newMember.id}-${Date.now()}`;
      
      if (this.processingUpdates.has(updateKey)) return;
      this.processingUpdates.add(updateKey);

      setTimeout(() => this.processingUpdates.delete(updateKey), 5000);

      const oldRoles = oldMember.roles.cache.map(r => r.id);
      const newRoles = newMember.roles.cache.map(r => r.id);

      const addedRoles = newRoles.filter(id => !oldRoles.includes(id));
      const removedRoles = oldRoles.filter(id => !newRoles.includes(id));

      if (addedRoles.length === 0 && removedRoles.length === 0) {
        this.processingUpdates.delete(updateKey);
        return;
      }

      const changeInfo = await this.detectChangeSource(newMember.guild, newMember);

      await User.findOneAndUpdate(
        { userId: newMember.id },
        {
          $set: {
            currentRoles: newRoles,
            rolesLastUpdated: new Date(),
            username: newMember.user.username,
          },
        },
        { upsert: true }
      );

      if (changeInfo.changeType === 'admin_manual') {
        await this.handleAdminOverride(newMember, addedRoles, removedRoles);
      }

      await RoleChangeLog.create({
        userId: newMember.id,
        username: newMember.user.username,
        addedRoles,
        removedRoles,
        changeType: changeInfo.changeType,
        changedBy: changeInfo.changedBy,
        reason: changeInfo.reason,
        timestamp: new Date(),
        guildId: newMember.guild.id,
      });

    } catch (error) {
      logger.error('Error handling role update:', error);
    }
  }

  async detectChangeSource(guild, member) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberRoleUpdate,
      });

      const auditEntry = auditLogs.entries.first();

      if (!auditEntry || Date.now() - auditEntry.createdTimestamp > 5000) {
        return {
          changeType: 'unknown',
          changedBy: 'unknown',
          reason: '',
        };
      }

      const executor = auditEntry.executor;

      if (!executor) {
        return {
          changeType: 'unknown',
          changedBy: 'unknown',
          reason: '',
        };
      }

      if (executor.id === this.client.user.id) {
        return {
          changeType: 'bot_action',
          changedBy: this.client.user.id,
          reason: auditEntry.reason || '',
        };
      }

      if (executor.bot) {
        return {
          changeType: 'external_bot',
          changedBy: executor.id,
          reason: auditEntry.reason || '',
        };
      }

      const executorMember = guild.members.cache.get(executor.id);
      if (executorMember && executorMember.permissions.has('Administrator')) {
        return {
          changeType: 'admin_manual',
          changedBy: executor.id,
          reason: auditEntry.reason || '',
        };
      }

      return {
        changeType: 'unknown',
        changedBy: executor.id,
        reason: auditEntry.reason || '',
      };

    } catch (error) {
      logger.error('Error detecting change source:', error);
      return {
        changeType: 'unknown',
        changedBy: 'unknown',
        reason: '',
      };
    }
  }

  async handleAdminOverride(member, addedRoles, removedRoles) {
    try {
      if (addedRoles.length > 0) {
        await User.findOneAndUpdate(
          { userId: member.id },
          {
            $addToSet: { protectedRoles: { $each: addedRoles } },
          },
          { upsert: true }
        );
      }

      if (addedRoles.includes(config.SUMMONER_ROLE_ID)) {
        await User.findOneAndUpdate(
          { userId: member.id },
          { $set: { summonerManualOverride: true } },
          { upsert: true }
        );
      }

      if (removedRoles.includes(config.SUMMONER_ROLE_ID)) {
        await User.findOneAndUpdate(
          { userId: member.id },
          { $set: { summonerManualOverride: true } },
          { upsert: true }
        );
      }

    } catch (error) {
      logger.error('Error handling admin override:', error);
    }
  }
}

module.exports = RoleManager;