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
        return await message.channel.send('❌ Please mention someone! Usage: `eb hug @user`');
      }

      if (user.id === message.author.id) {
        return await message.channel.send('🤗 You gave yourself a hug! That\'s wholesome!');
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
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWM1bDc0N3lvdzZsYTlsbnU5NHYxZmh3YTB6NjgyYmI2dTZua3BvNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/uakdGGShmMS0KYfTgp/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWM1bDc0N3lvdzZsYTlsbnU5NHYxZmh3YTB6NjgyYmI2dTZua3BvNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/llmZp6fCVb4ju/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3YzQwaWVuNWttbXVjM2U2a2kzbjVod3h0YWlzejMwM3AwZW5mODR5YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/7DcWULPrivdaZr6wwF/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MGxhenNyeHV1ZWlid2NzZmljNTNpbmE5eGprMnhvbG9hbzI3bG5jYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1UGLHdH4aXaCs/giphy.gif',
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

      await message.channel.send({ embeds: [embed] });
      await message.react('🤗');
      await message.react('💙');

      logger.info(`${message.author.tag} hugged ${user.tag}`);
    } catch (error) {
      logger.error('Error in hug command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};