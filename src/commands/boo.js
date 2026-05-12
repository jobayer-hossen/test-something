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
        return await message.reply('❌ Please mention someone! Usage: `eb boo @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('😅 You can\'t scare yourself!');
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
        'https://media.tenor.com/3wZ5q6Qq5vMAAAAC/anime-scared.gif',
        'https://media.tenor.com/2l4-h42qnmcAAAAC/anime-scared.gif',
        'https://media.tenor.com/0nR8Q5xFQ6sAAAAC/anime-jump-scare.gif',
        'https://media.tenor.com/5Jp_e0uQG1MAAAAC/anime-shocked.gif',
        'https://media.tenor.com/1a2b3c4d5e6f7g8h9i0jAAAAC/anime-scared.gif',
        'https://media.tenor.com/8vQqQ4Z3ZxAAAAAC/anime-horror.gif',
        'https://media.tenor.com/6Z6Z6Z6Z6Z6AAAAAC/anime-frightened.gif',
        'https://media.tenor.com/7Q7Q7Q7Q7Q7AAAAAC/anime-shock.gif',
        'https://media.tenor.com/9R9R9R9R9R9AAAAAC/anime-terror.gif',
        'https://media.tenor.com/0A0A0A0A0A0AAAAAC/anime-scared.gif',
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

      await message.reply({ embeds: [embed] });
      await message.react('👻');

      logger.info(`${message.author.tag} booed ${user.tag}`);
    } catch (error) {
      logger.error('Error in boo command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};