const { PermissionFlagsBits } = require('discord.js');
const User = require('../database/schemas/User');

module.exports = {
  name: 'role',
  aliases: ['rp', 'ru'],
  description: 'Protect or unprotect roles from inactivity removal',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message, args, client) {
    const command = message.content.toLowerCase();
    const isProtect = command.includes('rp') || args[0] === 'protect';
    const isUnprotect = command.includes('ru') || args[0] === 'unprotect';

    if (!isProtect && !isUnprotect) {
      return message.reply('Usage: `eb rp @user @role` or `eb ru @user @role`');
    }

    const userMention = message.mentions.users.first();
    const roleMention = message.mentions.roles.first();

    if (!userMention || !roleMention) {
      return message.reply('Please mention both a user and a role.');
    }

    try {
      if (isProtect) {
        await User.findOneAndUpdate(
          { userId: userMention.id },
          {
            $addToSet: { protectedRoles: roleMention.id },
            $set: { username: userMention.username },
          },
          { upsert: true }
        );

        return message.reply(
          `${roleMention} is now **protected** for ${userMention}.\n` +
          `This role will not be removed during inactivity checks.`
        );
      }

      if (isUnprotect) {
        await User.findOneAndUpdate(
          { userId: userMention.id },
          {
            $pull: { protectedRoles: roleMention.id },
            $set: { username: userMention.username },
          }
        );

        return message.reply(
          `${roleMention} is **no longer protected** for ${userMention}.\n` +
          `This role can be removed during inactivity checks.`
        );
      }

    } catch (error) {
      console.error('Error managing role protection:', error);
      return message.reply('An error occurred while managing role protection.');
    }
  },
};