const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('BonkCommand');

module.exports = {
  name: 'bonk',
  description: 'Bonk someone with a bat!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb bonk @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('🔨 You bonked yourself! Go to horny jail!');
      }

      const bonkMessages = [
        `🔨 BONK! ${user.username} has been sent to horny jail!`,
        `⚾ *BONK* ${message.author.username} bonks ${user.username}!`,
        `🔨 ${user.username} got bonked hard!`,
        `⚾ Go to horny jail! *BONK* ${user.username}!`,
        `🔨 ${message.author.username} wields the bonk bat on ${user.username}!`,
        `💢 *BONK* ${user.username} is bonked to the shadow realm!`,
        `🔨 CRITICAL BONK! ${user.username}!`,
        `⚾ The bonk heard around the world! ${user.username}!`,
      ];

      const randomMessage = bonkMessages[Math.floor(Math.random() * bonkMessages.length)];

      const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle('🔨 BONK!')
        .setDescription(randomMessage)
        .addFields(
          {
            name: '💢 Impact',
            value: '━━━━━━━━━━━━━━━━━━ **CRITICAL HIT!** ━━━━━━━━━━━━━━━━━━',
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'To horny jail you go! 🔨',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('🔨');
      await message.react('⚾');

      logger.info(`${message.author.tag} bonked ${user.tag}`);
    } catch (error) {
      logger.error('Error in bonk command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};