const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('KillCommand');

module.exports = {
  name: 'kill',
  description: 'Kill someone (just for fun)!',

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb kill @user`');
      }

      if (user.id === message.author.id) {
        return await message.reply('😵 You tried to kill yourself! That\'s illegal!');
      }

      const killMessages = [
        `⚔️ ${message.author.username} eliminated ${user.username}!`,
        `💀 ${user.username} was taken out by ${message.author.username}!`,
        `🗡️ ${message.author.username} stabbed ${user.username} with a sword!`,
        `🔫 ${user.username} got eliminated! Game over!`,
        `💀 RIP ${user.username}... you fought well!`,
        `⚔️ ${message.author.username} used a critical hit on ${user.username}!`,
        `🗡️ ${user.username} has been slain by ${message.author.username}!`,
        `💀 ${user.username} was defeated in combat!`,
        `🔥 ${message.author.username} used a finisher on ${user.username}!`,
        `☠️ ${user.username} has been sent to the afterlife!`,
      ];

      const killGifs = [
        'https://media.tenor.com/k7JfKq2V3sAAAAC/kill-anime.gif',
        'https://media.tenor.com/gT7Xk8Kw5y0AAAAC/anime-kill.gif',
        'https://media.tenor.com/Rl0KxYK0Z8sAAAAC/anime-fight.gif',
        'https://media.tenor.com/0s6Dk0w1Kc0AAAAC/sword-slash.gif',
        'https://media.tenor.com/Tqf9Zp3J9XoAAAAC/anime-attack.gif',
        'https://media.tenor.com/3L2Vf0Kq1VgAAAAC/defeated.gif',
        'https://media.tenor.com/V0pK8k7Gn1UAAAAC/game-over.gif',
        'https://media.tenor.com/kZf2V7bGn7IAAAAC/anime-death.gif',
        'https://media.tenor.com/qk1W5x0QJ7cAAAAC/anime-sword.gif',
        'https://media.tenor.com/Lm9vKp6Xw5kAAAAC/slash-hit.gif',
        'https://media.tenor.com/0YzQYKp2X2kAAAAC/eliminated.gif',
        'https://media.tenor.com/R6j2Kb2Fk3MAAAAC/anime-kill-funny.gif',
      ];

      const randomMessage = killMessages[Math.floor(Math.random() * killMessages.length)];
      const randomGif = killGifs[Math.floor(Math.random() * killGifs.length)];

      const embed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('💀 KILL!')
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: 'RIP 💀',
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });
      await message.react('💀');
      await message.react('⚔️');

      logger.info(`${message.author.tag} killed ${user.tag}`);
    } catch (error) {
      logger.error('Error in kill command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};