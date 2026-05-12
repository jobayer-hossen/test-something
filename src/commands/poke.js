const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('PokeCommand');

module.exports = {
  name: 'poke',
  description: 'Poke someone!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb poke @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('👉 You poked yourself! That\'s annoying!');
      }

      const pokeMessages = [
        `👉 *poke poke* ${message.author.username} pokes ${user.username}!`,
        `💢 ${user.username} got poked by ${message.author.username}!`,
        `👉 Stop it! ${user.username} keeps getting poked!`,
        `😤 ${message.author.username} keeps poking ${user.username}!`,
        `👉 Poke poke! ${user.username} is annoyed!`,
        `😠 Why do you keep poking ${user.username}?!`,
        `💢 POKE! ${user.username} is mad now!`,
        `👉 Another poke for ${user.username}! Stop it!`,
      ];

      // UNIQUE POKE GIFS ONLY
      const pokeGifs = [
        'https://media.giphy.com/media/Cm4MwSnKqkOKQ/giphy.gif', // Poke anime
        'https://media.giphy.com/media/l0HlNaQ9hHmGtc4Za/giphy.gif', // Annoyed anime
        'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // Angry reaction
        'https://media.giphy.com/media/3o85xIO33l7RlmLR4I/giphy.gif', // Annoyed poke
        'https://media.giphy.com/media/xTiTnIHzP38T0Dz0I8/giphy.gif', // Funny poke anime
        'https://media.giphy.com/media/l0HlR6R1w04l8MCZwM/giphy.gif', // Mad anime
        'https://media.giphy.com/media/3o7TKU8RnDLjXHGwlG/giphy.gif', // Irritated anime
        'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', // Angry poke
        'https://media.giphy.com/media/l0HlTy9x8FZo0XO1i/giphy.gif', // Fed up anime
        'https://media.giphy.com/media/26uf1EUQrGnwHh3Eg/giphy.gif', // Action poke
        'https://media.giphy.com/media/l0HlQd7R8wpf7HTQc/giphy.gif', // Annoyed poke moment
        'https://media.giphy.com/media/xT9IgEx8SbQ0teblJi/giphy.gif', // Poke reaction
      ];

      const randomMessage = pokeMessages[Math.floor(Math.random() * pokeMessages.length)];
      const randomGif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('👉 Poke!')
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'Stop poking me! 😒',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('👉');
      await message.react('💢');

      logger.info(`${message.author.tag} poked ${user.tag}`);
    } catch (error) {
      logger.error('Error in poke command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};