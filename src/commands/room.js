const userService = require('../database/services/userService');
const PersonalChannel = require('../database/schemas/PersonalChannel');

module.exports = {
  name: 'room',
  description: 'Manage your personal room',
  async execute(message, args, client) {
    const subCommand = args[0]?.toLowerCase();
    const initiateId = client.features.baseManager.initiateRoleId;

    if (!subCommand || subCommand === 'help') {
        return message.channel.send("🏠 **Room Commands:**\n`eb room create <name>` - Create your room (Level 10)\n`eb room lock` - Stop others from talking\n`eb room unlock` - Let others talk\n`eb room hide` - Make room private\n`eb room unhide` - Make room public\n`eb room add @user` - Invite a friend\n`eb room rename <name>` - Change room name");
    }

    // --- CREATE ---
    if (subCommand === 'create') {
      const user = await userService.getOrCreateUser(message.author.id, message.author.username);
      if (user.level < 10) return message.channel.send(`❌ You need **Level 10** to unlock a room!`);

      const customName = args.slice(1).join('-') || `🏠-${message.author.username}`;
      const result = await client.features.baseManager.createBase(message.member, customName);
      if (result.success) {
        return message.channel.send(`✅ Room created! Go here: ${result.channel}`);
      } else {
        return message.channel.send(`❌ ${result.message}`);
      }
    }

    // OWNER CHECK - For all other commands
    const base = await PersonalChannel.findOne({ userId: message.author.id });
    if (!base) return message.channel.send("❌ You don't own a room.");
    const channel = await client.channels.fetch(base.channelId).catch(() => null);
    if (!channel) return message.channel.send("❌ Your room channel was not found.");

    // --- LOCK ---
    if (subCommand === 'lock') {
      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
      await channel.permissionOverwrites.edit(initiateId, { SendMessages: false });
      return message.channel.send("🔒 Room is now **Locked**. Only the owner can chat.");
    }

    // --- UNLOCK ---
    if (subCommand === 'unlock') {
      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
      await channel.permissionOverwrites.edit(initiateId, { SendMessages: true });
      return message.channel.send("🔓 Room is now **Unlocked**. Everyone can chat.");
    }

    // --- HIDE ---
    if (subCommand === 'hide') {
      await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
      await channel.permissionOverwrites.edit(initiateId, { ViewChannel: false });
      return message.channel.send("👻 Room is now **Private** (Hidden).");
    }

    // --- UNHIDE (THE FIX) ---
    if (subCommand === 'unhide') {
      // Explicitly ALLOW the Initiate Role and Everyone
      await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: true });
      await channel.permissionOverwrites.edit(initiateId, { ViewChannel: true });
      return message.channel.send("👁️ Room is now **Public** (Visible to everyone).");
    }

    // --- RENAME ---
    if (subCommand === 'rename') {
      const newName = args.slice(1).join('-');
      if (!newName) return message.channel.send("❌ Please provide a name. `eb room rename 🥰-logical` ");
      await channel.setName(newName);
      return message.channel.send(`📝 Room renamed to: **${newName}**`);
    }

    // --- ADD USER ---
    if (subCommand === 'add') {
        const target = message.mentions.users.first();
        if (!target) return message.channel.send("❌ Mention a user to invite.");
        await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        return message.channel.send(`✅ **${target.username}** has been invited to the room!`);
    }
  }
};