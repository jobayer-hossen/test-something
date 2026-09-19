const Logger = require('../logger');
const User = require('../database/schemas/User');
const InactivityCheckLog = require('../database/schemas/InactivityCheckLog');
const RoleChangeLog = require('../database/schemas/RoleChangeLog');
const config = require('../config');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const logger = new Logger('InactivityMonitor');

class InactivityMonitor {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
    this.isRunning = false;
    this.userLogsChannel = null;
  }

  async initialize() {
    try {
      await this.cacheUserLogsChannel();
      await this.scheduleChecks();
      await this.checkOnStartup();
    } catch (error) {
      logger.error('Error initializing InactivityMonitor:', error);
    }
  }

  async cacheUserLogsChannel() {
    try {
      const guild = await this.client.guilds.fetch(config.GUILD_ID);
      if (guild) {
        this.userLogsChannel = await guild.channels.fetch(config.USER_LOGS_CHANNEL_ID);
      }
    } catch (error) {
      logger.error('Error caching user logs channel:', error);
    }
  }

  async checkOnStartup() {
    try {
      const now = new Date();
      const today = now.getDate();

      if (!config.INACTIVITY_CHECK_DAYS.includes(today)) {
        return;
      }

      const lastCheck = await InactivityCheckLog.findOne()
        .sort({ checkDate: -1 })
        .lean();

      if (lastCheck) {
        const lastCheckDate = new Date(lastCheck.checkDate);
        const isSameDay = lastCheckDate.toDateString() === now.toDateString();

        if (isSameDay) {
          return;
        }
      }

      await this.runInactivityCheck();

    } catch (error) {
      logger.error('Error in startup check:', error);
    }
  }

  scheduleChecks() {
    const checkTime = () => {
      const now = new Date();
      const today = now.getDate();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (config.INACTIVITY_CHECK_DAYS.includes(today) &&
          currentHour === 0 &&
          currentMinute === 0) {
        this.runInactivityCheck();
      }
    };

    this.checkInterval = setInterval(checkTime, 60000);
  }

  async runInactivityCheck() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const guild = await this.client.guilds.fetch(config.GUILD_ID);
      if (!guild) {
        logger.error('Guild not found');
        this.isRunning = false;
        return;
      }

      // Ensure we have the channel cached
      if (!this.userLogsChannel) {
        await this.cacheUserLogsChannel();
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - config.INACTIVITY_THRESHOLD_DAYS);

      const inactiveUsers = await User.find({
        lastMessageDate: { $lt: thirtyDaysAgo },
        inactivityExempt: { $ne: true },
      }).lean();

      const checkLog = {
        checkDate: new Date(),
        usersChecked: inactiveUsers.length,
        usersAffected: 0,
        rolesRemoved: 0,
        actions: [],
        executionTime: 0,
        errors: [],
      };

      let processedCount = 0;
      let affectedCount = 0;

      for (const user of inactiveUsers) {
        try {
          const result = await this.processInactiveUser(guild, user, thirtyDaysAgo);

          if (result.success) {
            processedCount++;

            if (result.removedRoles.length > 0) {
              affectedCount++;
              checkLog.usersAffected++;
              checkLog.rolesRemoved += result.removedRoles.length;
              checkLog.actions.push(result.action);

              // Send log to channel
              await this.sendInactivityLog(guild, result.member, result.action);
            }
          }

        } catch (error) {
          logger.error(`Error processing user ${user.userId}:`, error);
          checkLog.errors.push(`${user.userId}: ${error.message}`);
        }
      }

      checkLog.executionTime = Date.now() - startTime;

      // Only log if we actually processed users
      if (processedCount > 0) {
        await InactivityCheckLog.create(checkLog);
      }

      // Send summary if we have a channel
      if (this.userLogsChannel) {
        await this.sendSummaryLog(guild, checkLog);
      }

    } catch (error) {
      logger.error('Error running inactivity check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async processInactiveUser(guild, user, thresholdDate) {
    try {
      let member;
      try {
        member = await guild.members.fetch(user.userId);
      } catch (error) {
        logger.debug(`Member ${user.userId} not found in guild`);
        return { success: false };
      }

      // Skip bots and server owner
      if (member.user.bot || member.id === guild.ownerId) {
        return { success: false };
      }

      const inactiveDays = Math.floor(
        (Date.now() - new Date(user.lastMessageDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const rolesToRemove = [];
      const keptRoles = [];

      for (const [roleId, role] of member.roles.cache) {
        if (roleId === guild.id) {
          continue; // Skip @everyone
        }

        if (role.managed) {
          keptRoles.push(roleId);
          continue;
        }

        if (role.permissions.has(PermissionFlagsBits.Administrator)) {
          keptRoles.push(roleId);
          continue;
        }

        if (role.position >= guild.members.me.roles.highest.position) {
          keptRoles.push(roleId);
          continue;
        }

        if (user.protectedRoles && user.protectedRoles.includes(roleId)) {
          keptRoles.push(roleId);
          continue;
        }

        rolesToRemove.push(role);
      }

      if (rolesToRemove.length === 0) {
        return { success: true, member, removedRoles: [], action: null };
      }

      // Remove roles
      await member.roles.remove(rolesToRemove, 'Inactivity: 30+ days without messages');

      // Update user record
      await User.findOneAndUpdate(
        { userId: user.userId },
        { $set: { lastInactivityCheck: new Date() } }
      );

      // Log role change
      await RoleChangeLog.create({
        userId: member.id,
        username: member.user.username,
        addedRoles: [],
        removedRoles: rolesToRemove.map(r => r.id),
        changeType: 'bot_action',
        changedBy: this.client.user.id,
        reason: `Inactivity: ${inactiveDays} days`,
        timestamp: new Date(),
        guildId: guild.id,
      });

      return {
        success: true,
        member,
        removedRoles: rolesToRemove.map(r => r.id),
        action: {
          userId: user.userId,
          username: member.user.username,
          lastMessageDate: user.lastMessageDate,
          inactiveDays,
          removedRoles: rolesToRemove.map(r => r.id),
          keptRoles,
          reason: `30+ days of inactivity`,
        },
      };

    } catch (error) {
      logger.error(`Error processing inactive user ${user.userId}:`, error);
      throw error;
    }
  }

  async sendInactivityLog(guild, member, action) {
    if (!this.userLogsChannel) {
      logger.warn('User logs channel not available');
      return;
    }

    try {
      const lastActivityDate = new Date(action.lastMessageDate);
      const formattedDate = `<t:${Math.floor(lastActivityDate.getTime() / 1000)}:F>`;

      const removedRolesList = action.removedRoles.length > 0
        ? action.removedRoles.map(id => `<@&${id}>`).join(', ')
        : 'None';

      const keptRolesList = action.keptRoles.length > 0
        ? action.keptRoles.map(id => `<@&${id}>`).join(', ')
        : 'None';

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('Inactivity Update')
        .addFields(
          { name: 'Member', value: `<@${action.userId}>`, inline: false },
          { name: 'Last Activity', value: formattedDate, inline: true },
          { name: 'Inactive Days', value: `${action.inactiveDays} days`, inline: true },
          { name: 'Removed Roles', value: removedRolesList, inline: false },
          { name: 'Protected Roles', value: keptRolesList, inline: false }
        )
        .setFooter({ text: 'Roles removed due to 30+ days of inactivity' })
        .setTimestamp();

      await this.userLogsChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Error sending inactivity log:', error);
    }
  }

  async sendSummaryLog(guild, checkLog) {
    if (!this.userLogsChannel) return;

    try {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Inactivity Check Summary')
        .addFields(
          { name: 'Users Checked', value: String(checkLog.usersChecked), inline: true },
          { name: 'Users Affected', value: String(checkLog.usersAffected), inline: true },
          { name: 'Roles Removed', value: String(checkLog.rolesRemoved), inline: true },
          { name: 'Execution Time', value: `${checkLog.executionTime}ms`, inline: true }
        )
        .setFooter({ text: 'Inactivity check completed' })
        .setTimestamp();

      await this.userLogsChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Error sending summary log:', error);
    }
  }

  async manualCheck(interaction) {
    if (this.isRunning) {
      return interaction.reply({
        content: 'Inactivity check is already running.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await this.runInactivityCheck();
      await interaction.editReply('Inactivity check completed.');
    } catch (error) {
      logger.error('Error in manual check:', error);
      await interaction.editReply('An error occurred during the inactivity check.');
    }
  }

  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

module.exports = InactivityMonitor;