const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const User = require('../database/schemas/User');

module.exports = {
  name: 'inactivity',
  aliases: ['in'],
  description: 'Manage inactivity exemptions',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message, args, client) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return message.reply('Usage: `eb inactivity <exempt|status> @user`');
    }

    if (subcommand === 'exempt' || subcommand === 'ex') {
      return this.handleExempt(message, args);
    }

    if (subcommand === 'status' || subcommand === 'st') {
      return this.handleStatus(message, args);
    }

    return message.reply('Unknown subcommand. Use: `exempt` or `status`');
  },

  async handleExempt(message, args) {
    const userMention = message.mentions.users.first();
    
    if (!userMention) {
      return message.reply('Please mention a user: `eb in ex @user`');
    }

    try {
      const user = await User.findOne({ userId: userMention.id });
      const currentStatus = user?.inactivityExempt || false;

      await User.findOneAndUpdate(
        { userId: userMention.id },
        {
          $set: {
            inactivityExempt: !currentStatus,
            username: userMention.username,
          },
        },
        { upsert: true }
      );

      const newStatus = !currentStatus;
      const statusText = newStatus 
        ? 'is now **exempt** from inactivity checks. Their roles will never be removed automatically.' 
        : 'is **no longer exempt** from inactivity checks.';

      return message.reply(`${userMention} ${statusText}`);

    } catch (error) {
      console.error('Error in inactivity exempt:', error);
      return message.reply('An error occurred while updating exemption status.');
    }
  },

  async handleStatus(message, args) {
    const userMention = message.mentions.users.first();

    if (!userMention) {
      return message.reply('Please mention a user: `eb in st @user`');
    }

    try {
      const user = await User.findOne({ userId: userMention.id }).lean();

      if (!user) {
        return message.reply(`No data found for ${userMention}.`);
      }

      const lastMessage = user.lastMessageDate 
        ? `<t:${Math.floor(new Date(user.lastMessageDate).getTime() / 1000)}:R>`
        : 'Never';

      const daysSince = user.lastMessageDate
        ? Math.floor((Date.now() - new Date(user.lastMessageDate).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A';

      const exempt = user.inactivityExempt ? 'Yes' : 'No';
      
      const protectedRoles = user.protectedRoles && user.protectedRoles.length > 0
        ? user.protectedRoles.map(id => `<@&${id}>`).join(', ')
        : 'None';

      const summonerOverride = user.summonerManualOverride ? 'Yes' : 'No';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Inactivity Status for ${userMention.username}`)
        .addFields(
          { name: 'Last Message', value: lastMessage, inline: true },
          { name: 'Days Since', value: String(daysSince), inline: true },
          { name: 'Inactivity Exempt', value: exempt, inline: true },
          { name: 'Protected Roles', value: protectedRoles, inline: false },
          { name: 'Summoner Override', value: summonerOverride, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in inactivity status:', error);
      return message.reply('An error occurred while fetching status.');
    }
  },
};