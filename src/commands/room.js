const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const PersonalChannel = require("../database/schemas/PersonalChannel");

module.exports = {
  name: "room",
  description: "Advanced Personal Room Management",
  async execute(message, args, client) {
    const subCommand = args[0]?.toLowerCase();
    
    // CONFIGURATION
    const manager = client.features.baseManager;
    const INITIATE_ID = manager.initiateRoleId;
    const BOT_ROLE_ID = manager.botRoleId; // 970000054012244008
    const OWNER_ROLE_ID = manager.ownerRoleId;
    const EMBED_COLOR = "#5865F2";

    // --- 1. HELP MENU (Accessible by everyone) ---
    if (!subCommand || subCommand === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("🏠 Room Control Center")
        .setDescription("Manage your private space. Bots & Staff always have access.")
        .addFields(
          { name: "🔒 Privacy", value: "`lock` · `unlock` · `hide` · `unhide` ", inline: true },
          { name: "⚙️ Settings", value: "`rename` · `add @user` · `info` ", inline: true }
        )
        .setFooter({ text: "Staff can use assign/check commands." });

      return message.channel.send({ embeds: [helpEmbed] });
    }

    // ==========================================
    // 2. STAFF TOOLS (Processed BEFORE Owner Check)
    // ==========================================

    // --- ASSIGN ---
    if (subCommand === "assign") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.channel.send("❌ This command is staff-only.");
      const target = message.mentions.members.first();
      if (!target) return message.channel.send("❌ Mention a user to assign.");

      const exists = await PersonalChannel.findOne({ userId: target.id });
      if (exists) return message.channel.send(`❌ <@${target.id}> already owns <#${exists.channelId}>`);

      await PersonalChannel.findOneAndUpdate(
        { userId: target.id },
        { channelId: message.channel.id, lastActivity: new Date() },
        { upsert: true }
      );

      await target.roles.add(OWNER_ROLE_ID).catch(() => null);

      await message.channel.permissionOverwrites.set([
        { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: INITIATE_ID, deny: [PermissionFlagsBits.ViewChannel] },
        { id: target.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] },
        { id: BOT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
      ]);

      return message.channel.send(`✅ **Success:** Room assigned to <@${target.id}>.`);
    }

    // --- CHECK ---
    if (subCommand === "check") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.channel.send("❌ This command is staff-only.");
      const target = message.mentions.users.first() || message.author;
      const data = await PersonalChannel.findOne({ userId: target.id });
      
      if (!data) return message.channel.send(`❌ No room data found for **${target.username}**.`);
      
      const checkEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`🔍 Room Audit: ${target.username}`)
        .addFields(
            { name: "Location", value: `<#${data.channelId}>`, inline: true },
            { name: "Last Activity", value: `<t:${Math.floor(data.lastActivity.getTime() / 1000)}:R>`, inline: true }
        );
      return message.channel.send({ embeds: [checkEmbed] });
    }

    // --- DELETE (Admin Only) ---
    if (subCommand === "delete") {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.channel.send("❌ This command is admin-only.");
        const target = message.mentions.users.first();
        if (!target) return message.channel.send("❌ Mention a user.");
        
        const data = await PersonalChannel.findOneAndDelete({ userId: target.id });
        if (data) {
          const chan = await client.channels.fetch(data.channelId).catch(() => null);
          if (chan) await chan.delete();
          return message.channel.send(`🗑️ Deleted room for **${target.username}**.`);
        }
        return message.channel.send("❌ No record found.");
    }

    // ==========================================
    // 3. USER COMMANDS (Requires Ownership)
    // ==========================================
    const base = await PersonalChannel.findOne({ userId: message.author.id });
    if (!base) return message.channel.send("❌ You do not own a room.");

    const channel = await client.channels.fetch(base.channelId).catch(() => null);
    if (!channel) return message.channel.send("❌ Your room was not found in the server.");

    const successEmbed = (text) => new EmbedBuilder().setColor("#2ecc71").setDescription(text);

    if (subCommand === "lock") {
      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
      await channel.permissionOverwrites.edit(INITIATE_ID, { SendMessages: false });
      await channel.permissionOverwrites.edit(BOT_ROLE_ID, { SendMessages: true });
      return message.channel.send({ embeds: [successEmbed("🔒 **Room Locked.** Only you can chat.")] });
    }

    if (subCommand === "unlock") {
      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
      await channel.permissionOverwrites.edit(INITIATE_ID, { SendMessages: true });
      return message.channel.send({ embeds: [successEmbed("🔓 **Room Unlocked.** Everyone can chat.")] });
    }

    if (subCommand === "hide") {
      await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
      await channel.permissionOverwrites.edit(INITIATE_ID, { ViewChannel: false });
      await channel.permissionOverwrites.edit(BOT_ROLE_ID, { ViewChannel: true });
      return message.channel.send({ embeds: [successEmbed("👻 **Room Hidden.** Only you can see this.")] });
    }

    if (subCommand === "unhide") {
      await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: true });
      await channel.permissionOverwrites.edit(INITIATE_ID, { ViewChannel: true });
      return message.channel.send({ embeds: [successEmbed("👁️ **Room Visible.** Everyone can see the room.")] });
    }

    if (subCommand === "rename") {
      const name = args.slice(1).join("-");
      if (!name) return message.channel.send("❌ Usage: `eb room rename 🥰-logical` ");
      await channel.setName(name);
      return message.channel.send({ embeds: [successEmbed(`📝 Name updated to: **${name}**`)] });
    }

    if (subCommand === "add") {
      const friend = message.mentions.users.first();
      if (!friend) return message.channel.send("❌ Mention a friend.");
      await channel.permissionOverwrites.edit(friend.id, { ViewChannel: true, SendMessages: true });
      return message.channel.send({ embeds: [successEmbed(`✅ **${friend.username}** invited.`)] });
    }

    if (subCommand === "info") {
        const infoEmbed = new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle("📊 Room Information")
          .addFields(
            { name: "Owner", value: `<@${base.userId}>`, inline: true },
            { name: "Activity", value: `<t:${Math.floor(base.lastActivity.getTime() / 1000)}:R>`, inline: true }
          );
        return message.channel.send({ embeds: [infoEmbed] });
    }
  },
};