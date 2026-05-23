const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('BooCommand');

module.exports = {
  name: 'boo',
  description: 'Scare someone!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.channel.send('❌ Please mention someone! Usage: `eb boo @user`');
      }

      if (user.id === message.author.id) {
        return await message.channel.send('😅 You can\'t scare yourself!');
      }

      const booMessages = [
        `👻 BOOOO! ${user.username} got scared!`,
        `😱 ${user.username} just got jump-scared!`,
        `👻 BOO! Did ${user.username} scream? 😂`,
        `🎃 SPOOKY! ${user.username} is terrified!`,
        `👻 I'll be back... to scare ${user.username} again!`,
        `😨 ${user.username} is shaking with fear!`,
        `👻 GOTCHA! ${user.username} screamed!`,
        `🔥 ${user.username} was SPOOKED!`,
      ];

      // Discord-embeddable Tenor GIFs (Anime Scare)
      const booGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG01OWs4anhtcDhodGU0a2Y0MGg3czBxd2wzemdjNjA1ODdiMndhNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/zFq6QnA8g7iuI/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG01OWs4anhtcDhodGU0a2Y0MGg3czBxd2wzemdjNjA1ODdiMndhNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1QhmDy91F9veMRLpvK/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG01OWs4anhtcDhodGU0a2Y0MGg3czBxd2wzemdjNjA1ODdiMndhNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Dh8op07q1r2DHB6bSk/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3eTloZDBvZnYydHV1dmF3ZGF5OHptZG9zZzN2OW1tN2N3aG5sY3d5MiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Sjwyqly7Ez1zJP2n0L/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3OGk3NDYyeW1rMTJrbGRzaDduaTA0dXhuOTRnbnpxYzYxd3F3dG5nMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5nSBeY3bTm1WyECZDu/giphy.gif',
        
      ];

      const randomMessage = booMessages[Math.floor(Math.random() * booMessages.length)];
      const randomGif = booGifs[Math.floor(Math.random() * booGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#000000')
        .setTitle(randomMessage)
        .setDescription(`${message.author.username} scared ${user.username}! 👻`)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'Boo! 👻',
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });
      await message.react('👻');

      logger.info(`${message.author.tag} booed ${user.tag}`);
    } catch (error) {
      logger.error('Error in boo command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};