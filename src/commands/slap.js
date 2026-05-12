const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('SlapCommand');

module.exports = {
  name: 'slap',
  description: 'Give someone a playful slap!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb slap @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('🤕 You slapped yourself! Ouch!');
      }

      const slapMessages = [
        `👋 SLAP! ${message.author.username} slapped ${user.username}!`,
        `💥 *SMACK* ${user.username} got slapped!`,
        `👋 ${message.author.username} gives ${user.username} a playful slap!`,
        `🔥 ${user.username} just got roasted with a slap!`,
        `💨 *WHACK* ${user.username} felt that one!`,
        `😂 That slap hit different! ${user.username}!`,
        `💢 OOF! ${user.username} got slapped hard!`,
        `👋 POW! ${message.author.username} slapped ${user.username}!`,
      ];

      // UNIQUE SLAP GIFS ONLY
      const slapGifs = [
        'https://media.giphy.com/media/3o85xIO33l7RlmLR4I/giphy.gif', // Anime slap
        'https://media.giphy.com/media/xTiTnIHzP38T0Dz0I8/giphy.gif', // Funny slap anime
        'https://media.giphy.com/media/l0HlR6R1w04l8MCZwM/giphy.gif', // Hard slap
        'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // Anime hit
        'https://media.giphy.com/media/l0HlNaQ9hHmGtc4Za/giphy.gif', // Funny hit anime
        'https://media.giphy.com/media/3o7TKU8RnDLjXHGwlG/giphy.gif', // Angry slap
        'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', // Fast slap
        'https://media.giphy.com/media/l0HlTy9x8FZo0XO1i/giphy.gif', // Slap reaction
        'https://media.giphy.com/media/l0HlQd7R8wpf7HTQc/giphy.gif', // Slap moment
        'https://media.giphy.com/media/26uf1EUQrGnwHh3Eg/giphy.gif', // Action slap
        'https://media.giphy.com/media/xT9IgEx8SbQ0teblJi/giphy.gif', // Explosive slap
        'https://media.giphy.com/media/TL2Ylsmw0a8XK/giphy.gif', // Slap sound effect
      ];

      const randomMessage = slapMessages[Math.floor(Math.random() * slapMessages.length)];
      const randomGif = slapGifs[Math.floor(Math.random() * slapGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#FF6347')
        .setTitle('👋 Playful Slap!')
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'That\'s gonna leave a mark! 😂',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('👋');
      await message.react('💥');

      logger.info(`${message.author.tag} slapped ${user.tag}`);
    } catch (error) {
      logger.error('Error in slap command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};