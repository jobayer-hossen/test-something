const { EmbedBuilder } = require('discord.js');
const PersonalChannel = require('../database/schemas/PersonalChannel');

module.exports = {
  name: 'binfo',
  description: 'Check ownership details of the current base',
  async execute(message, args, client) {
    const base = await PersonalChannel.findOne({ channelId: message.channel.id });

    if (!base) {
      return message.channel.send("❌ This channel is not registered as a Personal Base.");
    }

    const owner = await client.users.fetch(base.userId).catch(() => null);
    
    const embed = new EmbedBuilder()
      .setColor('#9D4EDD')
      .setTitle("🏠 Base Information")
      .addFields(
        { name: '👤 Owner', value: owner ? `${owner.tag}` : 'Unknown User', inline: true },
        { name: '🆔 Owner ID', value: `\`${base.userId}\``, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(base.createdAt.getTime() / 1000)}:D>`, inline: false },
        { name: '🔒 Status', value: base.isPrivate ? "Private" : "Public", inline: true }
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }
};