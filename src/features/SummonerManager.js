const Logger = require('../logger');
const User = require('../database/schemas/User');
const CommandTracker = require('../database/schemas/CommandTracker');
const SummonerPeriod = require('../database/schemas/SummonerPeriod');
const RoleChangeLog = require('../database/schemas/RoleChangeLog');
const config = require('../config');
const { EmbedBuilder } = require('discord.js');

const logger = new Logger('SummonerManager');

class SummonerManager {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
    this.trackedUsers = new Map();
    this.isEvaluating = false;
  }

  async initialize() {
    try {
      await this.ensureActivePeriod();
      await this.checkPeriodStatus();
      this.startMonitoring();
      await this.postSummonerPerks();
    } catch (error) {
      logger.error('Error initializing SummonerManager:', error);
    }
  }

  async ensureActivePeriod() {
    try {
      const activePeriod = await SummonerPeriod.findOne({ status: 'active' });

      if (!activePeriod) {
        const lastPeriod = await SummonerPeriod.findOne().sort({ periodNumber: -1 });
        const periodNumber = lastPeriod ? lastPeriod.periodNumber + 1 : 1;

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + config.SUMMONER_PERIOD_DAYS);

        await SummonerPeriod.create({
          periodNumber,
          startDate,
          endDate,
          status: 'active',
          results: [],
        });
      }

    } catch (error) {
      logger.error('Error ensuring active period:', error);
    }
  }

  async checkPeriodStatus() {
    try {
      const activePeriod = await SummonerPeriod.findOne({ status: 'active' });

      if (!activePeriod) return;

      const now = new Date();
      const endDate = new Date(activePeriod.endDate);

      if (now >= endDate) {
        await this.evaluatePeriod(activePeriod, true);
      }

    } catch (error) {
      logger.error('Error checking period status:', error);
    }
  }

  startMonitoring() {
    this.checkInterval = setInterval(async () => {
      await this.checkPeriodStatus();
    }, 3600000); // Check every hour
  }

  async trackToothbrush(userId) {
    try {
      const activePeriod = await SummonerPeriod.findOne({ status: 'active' });
      if (!activePeriod) return;

      const count = await this.getUserToothbrushCount(userId, activePeriod);

      if (count >= config.SUMMONER_THRESHOLD) {
        await this.awardSummonerRole(userId, activePeriod.periodNumber, count);
      }

    } catch (error) {
      logger.error('Error tracking toothbrush:', error);
    }
  }

  async getUserToothbrushCount(userId, period) {
    try {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);

      const dates = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const records = await CommandTracker.find({
        userId,
        command: config.TOOTHBRUSH_COMMAND,
        date: { $in: dates },
      }).lean();

      return records.reduce((sum, record) => sum + record.count, 0);

    } catch (error) {
      logger.error('Error getting toothbrush count:', error);
      return 0;
    }
  }

  async awardSummonerRole(userId, periodNumber, count) {
    try {
      const guild = await this.client.guilds.fetch(config.GUILD_ID);
      if (!guild) return;

      let member;
      try {
        member = await guild.members.fetch(userId);
      } catch (error) {
        return;
      }

      if (member.roles.cache.has(config.SUMMONER_ROLE_ID)) {
        return;
      }

      const user = await User.findOne({ userId });
      if (user && user.summonerManualOverride) {
        return;
      }

      await member.roles.add(config.SUMMONER_ROLE_ID, 'Reached 500 toothbrushes');

      await User.findOneAndUpdate(
        { userId },
        {
          $set: {
            summonerAwardedDate: new Date(),
            summonerAwardedInPeriod: periodNumber,
          },
        },
        { upsert: true }
      );

      await RoleChangeLog.create({
        userId,
        username: member.user.username,
        addedRoles: [config.SUMMONER_ROLE_ID],
        removedRoles: [],
        changeType: 'bot_action',
        changedBy: this.client.user.id,
        reason: `Summoner awarded: ${count} toothbrushes in period ${periodNumber}`,
        timestamp: new Date(),
        guildId: guild.id,
      });

      await this.sendAwardAnnouncement(guild, member);

    } catch (error) {
      logger.error('Error awarding summoner role:', error);
    }
  }

  async sendAwardAnnouncement(guild, member) {
    try {
      const channel = await guild.channels.fetch(config.ANNOUNCEMENT_CHANNEL_ID);
      if (!channel) return;

      const epicPerksChannel = `<#${config.EPIC_PERKS_CHANNEL_ID}>`;
      const summonerRole = `<@&${config.SUMMONER_ROLE_ID}>`;

      await channel.send(
        `🎉 ${member} received the ${summonerRole} role! Read ${epicPerksChannel} to discover the Summoner perks.`
      );

    } catch (error) {
      logger.error('Error sending award announcement:', error);
    }
  }

  async evaluatePeriod(period, wasDelayed = false) {
    if (this.isEvaluating) return;

    this.isEvaluating = true;

    try {
      const guild = await this.client.guilds.fetch(config.GUILD_ID);
      if (!guild) {
        this.isEvaluating = false;
        return;
      }

      await SummonerPeriod.findByIdAndUpdate(period._id, {
        $set: { status: 'evaluating' },
      });

      const summonerRole = await guild.roles.fetch(config.SUMMONER_ROLE_ID);
      if (!summonerRole) {
        this.isEvaluating = false;
        return;
      }

      const membersWithRole = summonerRole.members;
      const results = [];

      for (const [memberId, member] of membersWithRole) {
        try {
          const user = await User.findOne({ userId: memberId });

          if (user && user.summonerManualOverride) {
            results.push({
              userId: memberId,
              username: member.user.username,
              toothbrushCount: 0,
              hadRole: true,
              action: 'manual_override_skip',
              timestamp: new Date(),
            });
            continue;
          }

          const count = await this.getUserToothbrushCount(memberId, period);

          if (count >= config.SUMMONER_THRESHOLD) {
            results.push({
              userId: memberId,
              username: member.user.username,
              toothbrushCount: count,
              hadRole: true,
              action: 'kept',
              timestamp: new Date(),
            });
          } else {
            await member.roles.remove(
              config.SUMMONER_ROLE_ID,
              `Failed to maintain ${config.SUMMONER_THRESHOLD} toothbrushes`
            );

            await RoleChangeLog.create({
              userId: memberId,
              username: member.user.username,
              addedRoles: [],
              removedRoles: [config.SUMMONER_ROLE_ID],
              changeType: 'bot_action',
              changedBy: this.client.user.id,
              reason: `Period evaluation: ${count}/${config.SUMMONER_THRESHOLD} toothbrushes`,
              timestamp: new Date(),
              guildId: guild.id,
            });

            results.push({
              userId: memberId,
              username: member.user.username,
              toothbrushCount: count,
              hadRole: true,
              action: 'removed',
              timestamp: new Date(),
            });

            await this.sendRemovalLog(guild, member, count, period);
          }

        } catch (error) {
          logger.error(`Error evaluating member ${memberId}:`, error);
        }
      }

      await SummonerPeriod.findByIdAndUpdate(period._id, {
        $set: {
          status: 'completed',
          evaluationDate: new Date(),
          wasDelayed,
          results,
        },
      });

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + config.SUMMONER_PERIOD_DAYS);

      await SummonerPeriod.create({
        periodNumber: period.periodNumber + 1,
        startDate,
        endDate,
        status: 'active',
        results: [],
      });

    } catch (error) {
      logger.error('Error evaluating period:', error);
    } finally {
      this.isEvaluating = false;
    }
  }

  async sendRemovalLog(guild, member, count, period) {
    try {
      const channel = await guild.channels.fetch(config.USER_LOGS_CHANNEL_ID);
      if (!channel) return;

      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);

      const periodStart = `<t:${Math.floor(startDate.getTime() / 1000)}:D>`;
      const periodEnd = `<t:${Math.floor(endDate.getTime() / 1000)}:D>`;

      const embed = new EmbedBuilder()
        .setColor(0xFFB84D)
        .setTitle('Summoner Role Removed')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`, inline: false },
          { name: 'Toothbrush Count', value: `${count}/${config.SUMMONER_THRESHOLD}`, inline: true },
          { name: 'Period', value: `${periodStart} to ${periodEnd}`, inline: true },
          { name: 'Reason', value: 'Did not meet the 500 toothbrush threshold', inline: false }
        )
        .setFooter({ text: 'Complete 500 toothbrushes in 14 days to keep the role' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Error sending removal log:', error);
    }
  }

  async postSummonerPerks() {
    try {
      const guild = await this.client.guilds.fetch(config.GUILD_ID);
      if (!guild) return;

      const channel = await guild.channels.fetch(config.EPIC_PERKS_CHANNEL_ID);
      if (!channel) return;

      const messages = await channel.messages.fetch({ limit: 10 });
      const existingEmbed = messages.find(msg => 
        msg.author.id === this.client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title === 'Summoner Role'
      );

      if (existingEmbed) return;

      const embed = new EmbedBuilder()
        .setColor(0x00D9FF)
        .setTitle('Summoner Role')
        .setDescription('The Summoner role is awarded to the most dedicated members!')
        .addFields(
          {
            name: 'How to Earn',
            value: `Complete **${config.SUMMONER_THRESHOLD} legendary toothbrushes** within **${config.SUMMONER_PERIOD_DAYS} days**`,
            inline: false,
          },
          {
            name: 'Evaluation Period',
            value: `Global ${config.SUMMONER_PERIOD_DAYS}-day cycles for all members`,
            inline: false,
          },
          {
            name: 'How It Works',
            value: 
              `• Role is awarded immediately when you hit ${config.SUMMONER_THRESHOLD}\n` +
              `• Every ${config.SUMMONER_PERIOD_DAYS} days, your progress is evaluated\n` +
              `• Keep the role by maintaining ${config.SUMMONER_THRESHOLD}+ toothbrushes\n` +
              `• Fall below ${config.SUMMONER_THRESHOLD} = role is removed`,
            inline: false,
          },
          {
            name: 'Perks',
            value:
              '• Access to exclusive Summoner commands\n' +
              '• Special role color and recognition\n' +
              '• Priority in events',
            inline: false,
          },
          {
            name: 'Check Your Progress',
            value: `Use \`eb ct ${config.SUMMONER_PERIOD_DAYS}d\` to see your toothbrush count`,
            inline: false,
          }
        )
        .setFooter({ text: 'Keep grinding to maintain your Summoner status!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Error posting summoner perks:', error);
    }
  }

  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

module.exports = SummonerManager;