const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const PersonalChannel = require("../database/schemas/PersonalChannel");

module.exports = {
  name: "room",
  description: "Elite Personal Room Management",
  async execute(message, args, client) {
    const subCommand = args[0]?.toLowerCase();
    const fullCommand = args.join(" ").toLowerCase();
    const manager = client.features.baseManager;

    const ROLES = {
      INITIATE: manager.initiateRoleId,
      OWNER: manager.ownerRoleId,
      STAFF1: manager.staff1Id,
      STAFF2: manager.staff2Id,
      MOD: manager.modId,
      BOTS: manager.botRoleId,
      JAIL: manager.jailRoleId,
    };

    const successEmbed = (text) =>
      new EmbedBuilder().setColor("#2ecc71").setDescription(text);
    const errorEmbed = (text) =>
      new EmbedBuilder().setColor("#e74c3c").setDescription(text);
    const infoEmbed = (text) =>
      new EmbedBuilder().setColor("#5865F2").setDescription(text);

    // ==========================================
    // HELP COMMAND - Works anywhere
    // ==========================================
    if (!subCommand || subCommand === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🏠 Personal Room Control Center")
        .setDescription(
          "Welcome to your personal room management system! Here's everything you can do:",
        )
        .addFields(
          {
            name: "📋 Information Commands",
            value: [
              "`eb room help` - Show this help menu",
              "`eb room info` - View room details, owner, invited friends & status",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🔒 Privacy Commands (Use in YOUR room)",
            value: [
              "`eb room lock` - Stop everyone from sending messages",
              "`eb room unlock` - Allow everyone to send messages again",
              "`eb room hide` - Make room invisible to regular members",
              "`eb room unhide` - Make room visible again",
            ].join("\n"),
            inline: false,
          },
          {
            name: "👥 Friend Management (Use in YOUR room)",
            value: [
              "`eb room add @user` - Invite a friend to your room",
              "`eb room remove @user` - Remove a friend from your room",
              "`eb room rename new-name` - Change your room's name",
            ].join("\n"),
            inline: false,
          },
          {
            name: "💡 Tips",
            value: [
              "• Management commands only work inside **your own room**",
              "• `eb room info` works anywhere to check room status",
              "• Use `eb room info @user` to check another user's room (Staff only)",
            ].join("\n"),
            inline: false,
          },
        )
        .setFooter({ text: "Your room, your rules! 🏠" });

      return message.channel.send({ embeds: [helpEmbed] });
    }

    // ==========================================
    // INFO COMMAND - Works anywhere
    // ==========================================
    if (subCommand === "info") {
      const isStaffForInfo = message.member.permissions.has(
        PermissionFlagsBits.ManageChannels,
      );
      const targetUser =
        (isStaffForInfo && message.mentions.users.first()) || message.author;

      const data = await PersonalChannel.findOne({ userId: targetUser.id });

      if (!data) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ No room data found for **${targetUser.username}**. They don't own a room yet.`,
            ),
          ],
        });
      }

      const targetMember = await message.guild.members
        .fetch(targetUser.id)
        .catch(() => null);
      const isJailed = targetMember?.roles.cache.has(ROLES.JAIL);
      const roomChannel = await client.channels
        .fetch(data.channelId)
        .catch(() => null);

      // Auto-repair/lock permissions based on jail status
      if (roomChannel) {
        if (isJailed) {
          await roomChannel.permissionOverwrites
            .edit(targetUser.id, {
              ViewChannel: false,
              SendMessages: false,
            })
            .catch(() => null);
        } else {
          await roomChannel.permissionOverwrites
            .edit(targetUser.id, {
              ViewChannel: true,
              SendMessages: true,
              ManageMessages: true,
              EmbedLinks: true,
              ReadMessageHistory: true,
              AttachFiles: true,
              PinMessages: true,
            })
            .catch(() => null);
        }
      }

      // Build friends list from channel permission overwrites
      let friendsList = "No friends added yet";
      if (roomChannel && data.friends && data.friends.length > 0) {
        const friendMentions = data.friends.map((id) => `<@${id}>`);
        friendsList = friendMentions.join(", ");
      }

      const embed = new EmbedBuilder()
        .setColor(isJailed ? "#ff0000" : "#5865F2")
        .setAuthor({
          name: `${targetUser.username}'s Personal Room`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: "👑 Room Owner",
            value: `<@${targetUser.id}> (${targetUser.username})`,
            inline: true,
          },
          {
            name: "🏠 Channel",
            value: roomChannel
              ? `<#${data.channelId}>`
              : "⚠️ Channel Deleted/Missing",
            inline: true,
          },
          {
            name: "📅 Room Created",
            value: `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F>`,
            inline: false,
          },
          {
            name: "🕒 Last Activity",
            value: `<t:${Math.floor(data.lastActivity.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: "⚖️ Owner Status",
            value: isJailed
              ? "🚫 **JAILED** - Access Revoked"
              : "✅ **Active** - Full Access",
            inline: true,
          },
          {
            name: `👥 Invited Friends (${data.friends ? data.friends.length : 0})`,
            value: friendsList,
            inline: false,
          },
          {
            name: "🔒 Room Privacy",
            value: roomChannel
              ? roomChannel.permissionOverwrites.cache
                  .get(message.guild.id)
                  ?.deny.has(PermissionFlagsBits.ViewChannel)
                ? "👻 Hidden from members"
                : roomChannel.permissionOverwrites.cache
                      .get(message.guild.id)
                      ?.deny.has(PermissionFlagsBits.SendMessages)
                  ? "🔒 Locked (view only)"
                  : "🔓 Open to members"
              : "Unknown",
            inline: false,
          },
        )
        .setFooter({
          text: isJailed
            ? "⚠️ Permissions auto-adjusted due to jail status"
            : "✅ Permissions verified and restored",
        });

      return message.channel.send({ embeds: [embed] });
    }

    // ==========================================
    // STAFF TOOLS - Assign
    // ==========================================
    if (subCommand === "assign") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ You need **Manage Channels** permission to use this command.",
            ),
          ],
        });
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user to assign this channel to.\n**Usage:** `eb room assign @user`",
            ),
          ],
        });
      }

      const exists = await PersonalChannel.findOne({ userId: target.id });
      if (exists) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ **${target.user.username}** already owns <#${exists.channelId}>.\nRevoke their current room first with \`eb room revoke @user\`.`,
            ),
          ],
        });
      }

      const channelTaken = await PersonalChannel.findOne({
        channelId: message.channel.id,
      });
      if (channelTaken) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ This channel is already assigned to <@${channelTaken.userId}>.\nRevoke their ownership first with \`eb room revoke @user\`.`,
            ),
          ],
        });
      }

      await PersonalChannel.findOneAndUpdate(
        { userId: target.id },
        {
          channelId: message.channel.id,
          lastActivity: new Date(),
          friends: [],
          createdAt: new Date(),
        },
        { upsert: true, returnDocument: "after" },
      );

      await target.roles.add(ROLES.OWNER).catch(() => null);
      const isJailed = target.roles.cache.has(ROLES.JAIL);

      await message.channel.permissionOverwrites.set([
        {
          id: message.guild.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: ROLES.JAIL,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.STAFF1,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.STAFF2,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.MOD,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.BOTS,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: target.id,
          allow: isJailed
            ? []
            : [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.PinMessages,
              ],
          deny: isJailed
            ? [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ]
            : [],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.SendMessages,
          ],
        },
      ]);

      const assignEmbed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle("✅ Room Assigned Successfully")
        .addFields(
          {
            name: "👑 New Owner",
            value: `<@${target.id}> (${target.user.username})`,
            inline: true,
          },
          {
            name: "🏠 Channel",
            value: `<#${message.channel.id}>`,
            inline: true,
          },
          {
            name: "⚖️ Status",
            value: isJailed ? "🚫 Jailed (Access Restricted)" : "✅ Active",
            inline: false,
          },
        )
        .setFooter({ text: `Assigned by ${message.author.username}` });

      return message.channel.send({ embeds: [assignEmbed] });
    }

    // ==========================================
    // STAFF TOOLS - Revoke Ownership
    // ==========================================
    if (subCommand === "revoke") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ You need **Manage Channels** permission to use this command.",
            ),
          ],
        });
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user to revoke ownership from.\n**Usage:** `eb room revoke @user`",
            ),
          ],
        });
      }

      const ownerData = await PersonalChannel.findOne({ userId: target.id });
      if (!ownerData) {
        return message.channel.send({
          embeds: [
            errorEmbed(`❌ **${target.user.username}** doesn't own any room.`),
          ],
        });
      }

      const roomChannel = await client.channels
        .fetch(ownerData.channelId)
        .catch(() => null);

      // Remove ownership from database but keep friends (channel stays)
      await PersonalChannel.deleteOne({ userId: target.id });

      // Remove owner role
      await target.roles.remove(ROLES.OWNER).catch(() => null);

      // Reset channel permissions for the previous owner (allow them to talk as normal member)
      if (roomChannel) {
        await roomChannel.permissionOverwrites
          .delete(target.id)
          .catch(() => null);
      }

      const revokeEmbed = new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("🚫 Room Ownership Revoked")
        .addFields(
          {
            name: "👤 Previous Owner",
            value: `<@${target.id}> (${target.user.username})`,
            inline: true,
          },
          {
            name: "🏠 Channel",
            value: roomChannel
              ? `<#${ownerData.channelId}>`
              : "Channel not found",
            inline: true,
          },
          {
            name: "ℹ️ Note",
            value:
              "The previous owner can still view and send messages as a regular member. The channel permissions have been reset.",
            inline: false,
          },
        )
        .setFooter({ text: `Revoked by ${message.author.username}` });

      return message.channel.send({ embeds: [revokeEmbed] });
    }

    // ==========================================
    // STAFF TOOLS - Fix All Room Permissions
    // ==========================================
    if (subCommand === "fixall" || fullCommand === "fix all permissions") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You need **Manage Channels** permission.")],
        });
      }

      const processingMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#f39c12")
            .setTitle("⚙️ Fixing Permissions...")
            .setDescription("Please wait, updating all rooms and friends..."),
        ],
      });

      const allRooms = await PersonalChannel.find({});
      let fixedRooms = 0;
      let fixedFriends = 0;
      let failedRooms = 0;

      for (const room of allRooms) {
        const channel = await client.channels
          .fetch(room.channelId)
          .catch(() => null);

        if (!channel) {
          failedRooms++;
          continue;
        }

        const ownerMember = await message.guild.members
          .fetch(room.userId)
          .catch(() => null);
        const isJailed = ownerMember?.roles.cache.has(ROLES.JAIL);

        // ✅ Fix owner permissions
        await channel.permissionOverwrites
          .edit(room.userId, {
            ViewChannel: isJailed ? false : true,
            SendMessages: isJailed ? false : true,
            ManageMessages: isJailed ? false : true,
            EmbedLinks: isJailed ? false : true,
            ReadMessageHistory: true,
            AttachFiles: isJailed ? false : true,
            PinMessages: isJailed ? false : true, // ✅ Owner gets pin
          })
          .catch(() => null);

        // ✅ Fix all friends permissions
        if (room.friends && room.friends.length > 0) {
          for (const friendId of room.friends) {
            await channel.permissionOverwrites
              .edit(friendId, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                PinMessages: true, // ✅ Friends get pin too
              })
              .catch(() => null);
            fixedFriends++;
          }
        }

        fixedRooms++;
      }

      return processingMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("✅ Permissions Fixed!")
            .addFields(
              {
                name: "🏠 Rooms Fixed",
                value: `${fixedRooms}`,
                inline: true,
              },
              {
                name: "👥 Friends Updated",
                value: `${fixedFriends}`,
                inline: true,
              },
              {
                name: "❌ Failed (Channel Deleted)",
                value: `${failedRooms}`,
                inline: true,
              },
              {
                name: "📌 What was fixed",
                value:
                  "All room owners and friends now have **Pin Messages** permission.",
                inline: false,
              },
            )
            .setFooter({ text: `Fixed by ${message.author.username}` }),
        ],
      });
    }

    // ==========================================
    // SECURITY & OWNERSHIP VERIFICATION
    // For commands that must be used in owner's room
    // ==========================================
    const channelRecord = await PersonalChannel.findOne({
      channelId: message.channel.id,
    });
    const isStaff = message.member.permissions.has(
      PermissionFlagsBits.ManageChannels,
    );

    if (!isStaff) {
      if (!channelRecord || channelRecord.userId !== message.author.id) {
        const actualRoom = await PersonalChannel.findOne({
          userId: message.author.id,
        });
        const locationText = actualRoom
          ? `📍 Go to <#${actualRoom.channelId}> to run room commands.`
          : "📭 You don't own a personal room yet.";

        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#e74c3c")
              .setTitle("🔐 Security Alert")
              .setDescription(
                `You can only manage commands in **your own room**!\n\n${locationText}`,
              ),
          ],
        });
      }

      if (message.member.roles.cache.has(ROLES.JAIL)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "🚫 **Action Denied:** Jailed users cannot manage their rooms.",
            ),
          ],
        });
      }
    }

    // Update last activity
    if (channelRecord) {
      await PersonalChannel.findOneAndUpdate(
        { channelId: message.channel.id },
        { lastActivity: new Date() },
        { returnDocument: "after" },
      );
    }

    // ==========================================
    // PRIVACY COMMANDS
    // ==========================================
    if (subCommand === "lock") {
      await message.channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: false,
      });
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#e74c3c")
            .setTitle("🔒 Room Locked")
            .setDescription(
              "Nobody can send messages now.\nUse `eb room unlock` to open it again.",
            ),
        ],
      });
    }

    if (subCommand === "unlock") {
      await message.channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: true,
      });
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("🔓 Room Unlocked")
            .setDescription("Everyone can send messages again!"),
        ],
      });
    }

    if (subCommand === "hide") {
      await message.channel.permissionOverwrites.edit(message.guild.id, {
        ViewChannel: false,
      });
      await message.channel.permissionOverwrites.edit(ROLES.INITIATE, {
        ViewChannel: false,
      });
      await message.channel.permissionOverwrites.edit(ROLES.STAFF1, {
        ViewChannel: true,
      });
      await message.channel.permissionOverwrites.edit(ROLES.STAFF2, {
        ViewChannel: true,
      });
      await message.channel.permissionOverwrites.edit(ROLES.MOD, {
        ViewChannel: true,
      });
      await message.channel.permissionOverwrites.edit(ROLES.BOTS, {
        ViewChannel: true,
      });

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle("👻 Room Hidden")
            .setDescription(
              "Your room is now invisible to regular members.\nStaff can still see it.\nUse `eb room unhide` to make it visible again.",
            ),
        ],
      });
    }

    if (subCommand === "unhide") {
      await message.channel.permissionOverwrites.edit(message.guild.id, {
        ViewChannel: true,
      });
      await message.channel.permissionOverwrites.edit(ROLES.INITIATE, {
        ViewChannel: true,
      });

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("👁️ Room Visible")
            .setDescription("Your room is now visible to everyone again!"),
        ],
      });
    }

    // ==========================================
    // RENAME COMMAND
    // ==========================================
    if (subCommand === "rename") {
      const name = args.slice(1).join("-");
      if (!name) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please provide a new name.\n**Usage:** `eb room rename new-room-name`",
            ),
          ],
        });
      }
      const oldName = message.channel.name;
      await message.channel.setName(name);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#f39c12")
            .setTitle("📝 Room Renamed")
            .addFields(
              { name: "Old Name", value: oldName, inline: true },
              { name: "New Name", value: name, inline: true },
            ),
        ],
      });
    }

    // ==========================================
    // ADD FRIEND COMMAND
    // ==========================================
    if (subCommand === "add") {
      const friend = message.mentions.members.first();
      if (!friend) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user to invite.\n**Usage:** `eb room add @user`",
            ),
          ],
        });
      }

      if (friend.id === message.author.id) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You can't add yourself to your own room!")],
        });
      }

      // Check if already added
      const currentData = await PersonalChannel.findOne({
        channelId: message.channel.id,
      });
      if (currentData?.friends?.includes(friend.id)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ **${friend.user.username}** is already in your room!`,
            ),
          ],
        });
      }

      // Add to friends list in DB
      await PersonalChannel.findOneAndUpdate(
        { channelId: message.channel.id },
        { $addToSet: { friends: friend.id } },
         { returnDocument: 'after' }
      );

      // Set channel permissions
      await message.channel.permissionOverwrites.edit(friend.id, {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
        ReadMessageHistory: true,
        PinMessages: true,
      });

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("✅ Friend Invited!")
            .setDescription(
              `**${friend.user.username}** has been added to your room.\nThey can now view and send messages here.`,
            )
            .setThumbnail(friend.user.displayAvatarURL({ dynamic: true })),
        ],
      });
    }

    // ==========================================
    // REMOVE FRIEND COMMAND
    // ==========================================
    if (subCommand === "remove") {
      const friend = message.mentions.members.first();
      if (!friend) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user to remove.\n**Usage:** `eb room remove @user`",
            ),
          ],
        });
      }

      // Check if they were even added
      const currentData = await PersonalChannel.findOne({
        channelId: message.channel.id,
      });
      if (!currentData?.friends?.includes(friend.id)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ **${friend.user.username}** is not in your friends list.`,
            ),
          ],
        });
      }

      // Remove from friends list in DB
      await PersonalChannel.findOneAndUpdate(
        { channelId: message.channel.id },
        { $pull: { friends: friend.id } },
         { returnDocument: 'after' }
      );

      // Remove channel permissions
      await message.channel.permissionOverwrites
        .delete(friend.id)
        .catch(() => null);

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#e74c3c")
            .setTitle("🚪 Friend Removed")
            .setDescription(
              `**${friend.user.username}** has been removed from your room.\nThey can no longer access this channel.`,
            )
            .setThumbnail(friend.user.displayAvatarURL({ dynamic: true })),
        ],
      });
    }

    // Unknown subcommand
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#e74c3c")
          .setTitle("❓ Unknown Command")
          .setDescription(
            `That's not a valid room command.\nUse \`eb room help\` to see all available commands.`,
          ),
      ],
    });
  },
};
