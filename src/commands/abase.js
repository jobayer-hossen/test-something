const PersonalChannel = require('../database/schemas/PersonalChannel');

module.exports = {
  name: 'abase',
  description: 'Admin Base Controls',
  async execute(message, args, client) {
    // SECURITY: Only administrators can run this
    if (!message.member.permissions.has('Administrator')) {
        return message.channel.send("🚫 Access Denied: Administrator Only.");
    }

    const action = args[0]?.toLowerCase();

    // eb abase setup @user <name>
    if (action === 'setup') {
      const targetMember = message.mentions.members.first();
      const customName = args.slice(2).join('-') || `🏠┃Admin-Setup`;
      const result = await client.features.baseManager.createBase(targetMember, customName);
      message.channel.send(result.success ? `✅ Created for ${targetMember}` : `❌ ${result.message}`);
    }

    // eb abase delete @user
    if (action === 'delete') {
      const target = message.mentions.users.first();
      const base = await PersonalChannel.findOneAndDelete({ userId: target.id });
      if (base) {
        const channel = await client.channels.fetch(base.channelId).catch(() => null);
        if (channel) await channel.delete();
        message.channel.send(`🗑️ Base for ${target.username} deleted.`);
      }
    }
  }
};