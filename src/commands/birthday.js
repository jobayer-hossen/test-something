const { EmbedBuilder } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('BirthdayCommand');

module.exports = {
  name: 'birthday',
  description: 'Celebrate a team member\'s birthday!',

  async execute(message, args, client) {
    try {
      // Get mentioned user
      const user = message.mentions.users.first();

      if (!user) {
        return await message.reply('❌ Please mention someone! Usage: `eb birthday @user`');
      }

      // Birthday messages
      const birthdayMessages = [
        '🎉 Happy Birthday! 🎉',
        '🎂 It\'s your special day! 🎂',
        '🎊 Another year, another adventure! 🎊',
        '🎈 You\'re officially one year more awesome! 🎈',
        '🌟 Hope your day is as amazing as you are! 🌟',
      ];

      // Fun facts
      const funFacts = [
        '✨ Your birthday twin is probably doing something cool right now!',
        '🎮 On your birthday, you gained +1 level in awesomeness!',
        '🚀 You\'ve now completed another orbit around the sun!',
        '👑 All hail the birthday king/queen!',
        '⭐ Your birthday is the only day that\'s officially yours!',
        '🎯 Fun fact: Birthdays are good for you. Studies show people who have more birthdays live longer!',
        '🎪 Fun fact: You share your birthday with approximately 19 million other people!',
        '🌈 Fun fact: Your birthday makes you 1 year closer to free senior discounts!',
      ];

      // Random selection
      const randomMessage = birthdayMessages[Math.floor(Math.random() * birthdayMessages.length)];
      const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];

      const embed = new EmbedBuilder()
        .setColor('#FF1493')
        .setTitle(randomMessage)
        .setDescription(`🎁 Celebrating ${user.username}'s Birthday! 🎁`)
        .addFields(
          {
            name: '🎂 Birthday Treat',
            value: 'A special surprise is coming your way! 🎉',
            inline: false,
          },
          {
            name: '🎯 Fun Fact',
            value: randomFact,
            inline: false,
          },
          {
            name: '🎊 Wishes',
            value: 'May your day be filled with joy, laughter, and epic victories! 🏆',
            inline: false,
          }
        )
        .setThumbnail(user.avatarURL())
        .setImage('https://media.giphy.com/media/g9GUUcZsw5O5q/giphy.gif')
        .setTimestamp()
        .setFooter({
          text: `Make a wish! 🌟 - Epic Bot`,
          iconURL: client.user.avatarURL(),
        });

      await message.reply({ embeds: [embed] });

      // Send confetti reaction
      await message.react('🎉');
      await message.react('🎂');
      await message.react('🎈');
      await message.react('🎊');

      // Birthday message to the user's DM (if they have DMs enabled)
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 HAPPY BIRTHDAY! 🎉')
          .setDescription(`${user.username}, you're awesome!`)
          .addFields(
            {
              name: '🎁 Special Gift',
              value: 'You received a birthday shoutout in the server! Check it out! 🎊',
              inline: false,
            }
          )
          .setImage('https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif');

        await user.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.debug('Could not send DM to user');
      }

      logger.info(`Birthday celebration for ${user.tag}`);
    } catch (error) {
      logger.error('Error in birthday command:', error.message);
      await message.reply('❌ An error occurred!');
    }
  },
};