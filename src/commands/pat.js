const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('PatCommand');

module.exports = {
  name: 'pat',
  description: 'Give someone a pat on the head!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb pat @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('😊 You patted yourself! Good job!');
      }

      const patMessages = [
        `*pat pat* ${user.username} got a head pat! 😊`,
        `✨ ${message.author.username} pats ${user.username} on the head!`,
        `🐾 Good ${user.username}! *pat pat*`,
        `✨ ${user.username} enjoys the gentle pat!`,
        `💫 ${message.author.username} gives ${user.username} a comforting pat!`,
        `😌 ${user.username} feels relaxed from the pat!`,
        `🌟 Such a good pat for ${user.username}!`,
        `💖 ${message.author.username} gives ${user.username} head pats!`,
      ];

      // UNIQUE PAT GIFS ONLY
      const patGifs = [
        'https://media.giphy.com/media/lCsS6s2g1BduxtxQKN/giphy.gif', // Headpat anime
        'https://media.giphy.com/media/hQU6qjeK2SZsQ/giphy.gif', // Cute pat
        'https://media.giphy.com/media/FQyQEFjxyLk1i/giphy.gif', // Happy headpat
        'https://media.giphy.com/media/3o6ZsYq8d8feXNcJDi/giphy.gif', // Gentle pat
        'https://media.giphy.com/media/fsEaEe2df680Oo7Acp/giphy.gif', // Sweet pat anime
        'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // Comforting pat
        'https://media.giphy.com/media/l0HlNaQ9hHmGtc4Za/giphy.gif', // Loving pat
        'https://media.giphy.com/media/3o7TKU8RnDLjXHGwlG/giphy.gif', // Soft pat anime
        'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', // Happy pat moment
        'https://media.giphy.com/media/l0HlR6R1w04l8MCZwM/giphy.gif', // Kind pat
        'https://media.giphy.com/media/xTiTnIHzP38T0Dz0I8/giphy.gif', // Wholesome pat
        'https://media.giphy.com/media/26uf1EUQrGnwHh3Eg/giphy.gif', // Good pat anime
      ];

      const randomMessage = patMessages[Math.floor(Math.random() * patMessages.length)];
      const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#87CEEB')
        .setTitle('✨ Head Pat!')
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'Pat pat! ✨',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('✨');
      await message.react('😊');

      logger.info(`${message.author.tag} patted ${user.tag}`);
    } catch (error) {
      logger.error('Error in pat command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};