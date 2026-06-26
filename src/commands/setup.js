const shopService = require('../database/services/shopService');
const { EmbedBuilder } = require('discord.js');

const ADMIN_ID = '782630678389981244';

module.exports = {
  name: 'setup',
  description: 'Admin setup commands',

  async execute(message, args, client) {
    if (message.author.id !== ADMIN_ID && !message.member?.permissions.has('Administrator')) {
      return message.channel.send('❌ Admin only!');
    }

    const sub = args[0]?.toLowerCase();

    if (sub === 'additem') {
      // eb setup additem <itemId> <type: color|role> <price> <name>
      const [, itemId, type, priceStr, ...nameParts] = args;
      const price = parseInt(priceStr);
      const name = nameParts.join(' ');

      if (!itemId || !type || !price || !name) {
        return message.channel.send(
          '❌ Usage: `eb setup additem <itemId> <color|role> <price> <name>`'
        );
      }

      const roleId = message.mentions.roles.first()?.id || null;

      const result = await shopService.addShopItem({
        itemId,
        name,
        type,
        price,
        roleId,
        guildId: message.guild.id,
        description: `A ${type} item`,
      });

      if (!result.success) return message.channel.send('❌ Failed to add item!');

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Shop Item Added')
        .addFields(
          { name: 'ID', value: itemId, inline: true },
          { name: 'Type', value: type, inline: true },
          { name: 'Price', value: `${price} 💰`, inline: true },
          { name: 'Name', value: name, inline: true }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    if (sub === 'settournament') {
      const channelId = message.mentions.channels.first()?.id || message.channel.id;
      if (client.features?.tournamentManager) {
        client.features.tournamentManager.start(message.guild.id, channelId);
        return message.channel.send(`✅ Tournament channel set to <#${channelId}>!`);
      }
      return message.channel.send('❌ Tournament manager not loaded!');
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('⚙️ Setup Commands')
      .addFields(
        { name: '`eb setup additem <id> <color|role> <price> <name>`', value: 'Add shop item' },
        { name: '`eb setup settournament [#channel]`', value: 'Set tournament channel' }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};