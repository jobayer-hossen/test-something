const { PermissionFlagsBits } = require('discord.js');
const User = require('../database/schemas/User');
const RoleChangeLog = require('../database/schemas/RoleChangeLog');
const config = require('../config');

module.exports = {
  name: 'summoner',
  aliases: ['sum'],
  description: 'Manage Summoner role overrides',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message, args, client) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand !== 'override' && subcommand !== 'ov') {
      return message.reply('Usage: `eb summoner override @user <add|remove|clear>`');
    }

    const userMention = message.mentions.users.first();
    const action = args[2]?.toLowerCase();

    if (!userMention) {
      return message.reply('Please mention a user: `eb sum ov @user <add|remove|clear>`');
    }

    if (!action || !['add', 'remove', 'rem', 'clear', 'clr'].includes(action)) {
      return message.reply('Action must be: `add`, `remove`, or `clear`');
    }

    try {
      const member = await message.guild.members.fetch(userMention.id);

      if (action === 'add') {
        return this.handleAdd(message, member);
      }

      if (action === 'remove' || action === 'rem') {
        return this.handleRemove(message, member);
      }

      if (action === 'clear' || action === 'clr') {
        return this.handleClear(message, member);
      }

    } catch (error) {
      console.error('Error in summoner override:', error);
      return message.reply('An error occurred while processing the override.');
    }
  },

  async handleAdd(message, member) {
    try {
      await member.roles.add(config.SUMMONER_ROLE_ID, 'Admin override: manual add');

      await User.findOneAndUpdate(
        { userId: member.id },
        {
          $set: {
            summonerManualOverride: true,
            username: member.user.username,
          },
        },
        { upsert: true }
      );

      await RoleChangeLog.create({
        userId: member.id,
        username: member.user.username,
        addedRoles: [config.SUMMONER_ROLE_ID],
        removedRoles: [],
        changeType: 'admin_manual',
        changedBy: message.author.id,
        reason: 'Admin override: forced add',
        timestamp: new Date(),
        guildId: message.guild.id,
      });

      return message.reply(
        `Summoner role added to ${member}.\n` +
        `Manual override enabled - role will not be removed automatically.`
      );

    } catch (error) {
      console.error('Error adding summoner role:', error);
      return message.reply('Failed to add Summoner role.');
    }
  },

  async handleRemove(message, member) {
    try {
      await member.roles.remove(config.SUMMONER_ROLE_ID, 'Admin override: manual remove');

      await User.findOneAndUpdate(
        { userId: member.id },
        {
          $set: {
            summonerManualOverride: true,
            username: member.user.username,
          },
        },
        { upsert: true }
      );

      await RoleChangeLog.create({
        userId: member.id,
        username: member.user.username,
        addedRoles: [],
        removedRoles: [config.SUMMONER_ROLE_ID],
        changeType: 'admin_manual',
        changedBy: message.author.id,
        reason: 'Admin override: forced remove',
        timestamp: new Date(),
        guildId: message.guild.id,
      });

      return message.reply(
        `Summoner role removed from ${member}.\n` +
        `Manual override enabled - role will not be auto-assigned.`
      );

    } catch (error) {
      console.error('Error removing summoner role:', error);
      return message.reply('Failed to remove Summoner role.');
    }
  },

  async handleClear(message, member) {
    try {
      await User.findOneAndUpdate(
        { userId: member.id },
        {
          $set: {
            summonerManualOverride: false,
            username: member.user.username,
          },
        },
        { upsert: true }
      );

      return message.reply(
        `Manual override cleared for ${member}.\n` +
        `Summoner role will now be managed automatically based on toothbrush count.`
      );

    } catch (error) {
      console.error('Error clearing override:', error);
      return message.reply('Failed to clear override.');
    }
  },
};