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
        'https://media.discordapp.net/attachments/1503824531909906462/1532790904237330442/WLJq4HSIP.gif?ex=6a6f73c5&is=6a6e2245&hm=47416c7630b419fb3e19138d4061491c55d534fdfa8d9b4dc34595dc423ae006&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532790234402521280/qEJ3sTVy.gif?ex=6a6f7325&is=6a6e21a5&hm=2c4f2ef459c69cadd8099a19f23242358d96fc5f1d0cba399f80ed4758844a53&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532790234021101648/B76vk4Wy.gif?ex=6a6f7325&is=6a6e21a5&hm=7e43bea806885c17f2968e11dd14591080d3eddfd2e9ce81f647eac82842ab85&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789859687600148/mHu1RcKC.gif?ex=6a6f72cc&is=6a6e214c&hm=ae99a27e1faa294e2cf37977ecbe4b25b2a1abd1d025c6d2e98086d8f35bdce7&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789860715204668/UbOZT9VU.gif?ex=6a6f72cc&is=6a6e214c&hm=e141e376d407c21e0840fcd39cd3b4c54501cf396efda6c886ae4d6bf6e17412&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789860245704925/HfCgLr34.gif?ex=6a6f72cc&is=6a6e214c&hm=c2c6c4fa324870cdc0b42a4cd8a3d2a81c8780ac2157e3d2fc369a76d9400444&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789287278608516/cUq4t8L5.gif?ex=6a6f7243&is=6a6e20c3&hm=ca9091925d9fba190a571c2b57d736df3992d19f9be1ab581b78589b03eebe44&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789463334522950/w1dqplIo.gif?ex=6a6f726d&is=6a6e20ed&hm=f5c9c5d6e92c72899dce8750d4319ab6923baab14872d0cb7ba58c5b2f379dea&=',
        'https://media.discordapp.net/attachments/1503824531909906462/1532789286603329668/ro5QZwNi.gif?ex=6a6f7243&is=6a6e20c3&hm=8045bbc6e02bcab4b89214f9a0ff68a6aacc878f70c2cfa223900d90945cc8c7&= ',
        
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