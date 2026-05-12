const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('HugCommand');

module.exports = {
  name: 'hug',
  description: 'Give someone a warm hug!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb hug @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('🤗 You gave yourself a hug! That\'s wholesome!');
      }

      const hugMessages = [
        `🤗 ${user.username} received a warm hug from ${message.author.username}!`,
        `💙 ${user.username} is getting hugged! Feels good!`,
        `🥰 ${message.author.username} hugs ${user.username} tightly!`,
        `🤗 Aww, ${user.username} got the best hug ever!`,
        `💕 ${user.username} needed this hug! 🤗`,
        `❤️ ${message.author.username} gives ${user.username} a loving hug!`,
        `🧡 ${user.username} is wrapped in a warm embrace!`,
        `💛 So wholesome! ${user.username} got hugged!`,
      ];

      // UNIQUE HUG GIFS ONLY
      const hugGifs = [
        'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // Anime hug embrace
        'https://media.giphy.com/media/3ohzdKdb7d6cpjw3DG/giphy.gif', // Cute hug animation
        'https://media.giphy.com/media/l0HlNaQ9hHmGtc4Za/giphy.gif', // Happy hug anime
        'https://media.giphy.com/media/26uf1EUQrGnwHh3Eg/giphy.gif', // Couple hug
        'https://media.giphy.com/media/G3va3QG0bZB6CJr5tR/giphy.gif', // Sweet hug moment
        'https://media.giphy.com/media/3o6ZsYq8d8feXNcJDi/giphy.gif', // Loving embrace
        'https://media.giphy.com/media/fsEaEe2df680Oo7Acp/giphy.gif', // Warm hug anime
        'https://media.giphy.com/media/l0HlR6R1w04l8MCZwM/giphy.gif', // Emotional hug
        'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', // Happy hug moment
        'https://media.giphy.com/media/l0HlTy9x8FZo0XO1i/giphy.gif', // Joyful hug
        'https://media.giphy.com/media/xTiTnIHzP38T0Dz0I8/giphy.gif', // Comforting hug
        'https://media.giphy.com/media/l0HlQd7R8wpf7HTQc/giphy.gif', // Intimate hug
      ];

      const randomMessage = hugMessages[Math.floor(Math.random() * hugMessages.length)];
      const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🤗 A Warm Hug!')
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'Hugs are the best! 💕',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('🤗');
      await message.react('💙');

      logger.info(`${message.author.tag} hugged ${user.tag}`);
    } catch (error) {
      logger.error('Error in hug command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};