const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'bcapacity',
  description: 'Check category capacity for new bases',
  async execute(message, args, client) {
    if (!message.member.permissions.has('Administrator')) return;

    const categoryIds = client.features.baseManager.categoryIds;
    let report = "";

    for (const id of categoryIds) {
      const cat = await client.channels.fetch(id).catch(() => null);
      if (cat) {
        const count = cat.children.cache.size;
        const status = count >= 50 ? "🔴 FULL" : `🟢 ${50 - count} slots left`;
        report += `**${cat.name}**: ${count}/50 channels (${status})\n`;
      } else {
        report += `⚠️ Category ID \`${id}\` not found!\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Base Sector Capacity")
      .setDescription(report)
      .setColor('#3498db');

    await message.channel.send({ embeds: [embed] });
  }
};