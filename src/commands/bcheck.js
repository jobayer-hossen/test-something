const PersonalChannel = require('../database/schemas/PersonalChannel');

module.exports = {
  name: 'bcheck',
  description: 'Check if a specific user owns a base',
  async execute(message, args, client) {
    const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : message.author);

    if (!target) return message.channel.send("❌ Could not find that user.");

    const base = await PersonalChannel.findOne({ userId: target.id });

    if (!base) {
      return message.channel.send(`❌ **${target.username}** does not own a personal base.`);
    }

    message.channel.send(`🏠 **${target.username}** owns a base: <#${base.channelId}>`);
  }
};