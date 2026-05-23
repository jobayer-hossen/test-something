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
        return await message.channel.send('❌ Please mention someone! Usage: `eb slap @user`');
      }

      if (user.id === message.author.id) {
        return await message.channel.send('🤕 You slapped yourself! Ouch!');
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
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemNlcmU1YWxkdjNidmkyd2NqbXc3ZWtld3lxdWQxOXRlem9uYzhxZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/A9q5vQor9SWre/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemNlcmU1YWxkdjNidmkyd2NqbXc3ZWtld3lxdWQxOXRlem9uYzhxZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ewHSMEx2TtEo8/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemNlcmU1YWxkdjNidmkyd2NqbXc3ZWtld3lxdWQxOXRlem9uYzhxZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Qumf2QovTD4QxHPjy5/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemNlcmU1YWxkdjNidmkyd2NqbXc3ZWtld3lxdWQxOXRlem9uYzhxZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/schUjA2QKXd3NE59Yo/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3YmlydzU5ZnB1ODdieDdjcmdrb2d4NHNyOXRqMzZoNGszY2RubmRtbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Gf3AUz3eBNbTW/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3c2NheDZubDJibWpoeDV5eDQxZTcyNnI4a200YmM3eXVtbjcxYnAyeCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/60rUVyj8ShyuEhHbaz/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemNlcmU1YWxkdjNidmkyd2NqbXc3ZWtld3lxdWQxOXRlem9uYzhxZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/uqSU9IEYEKAbS/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3YmlydzU5ZnB1ODdieDdjcmdrb2d4NHNyOXRqMzZoNGszY2RubmRtbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oriNXBCGHrzCYIbZK/giphy.gif',
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

      await message.channel.send({ embeds: [embed] });
      await message.react('👋');
      await message.react('💥');

      logger.info(`${message.author.tag} slapped ${user.tag}`);
    } catch (error) {
      logger.error('Error in slap command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};