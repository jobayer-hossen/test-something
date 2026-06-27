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
    // HELPER - Resolve user by mention OR raw ID
    // Works even if user left the server
    // ==========================================
    const resolveUser = async (arg) => {
      if (!arg) return null;

      // Extract ID from mention format <@123456> or <@!123456> or raw 123456
      const id = arg.replace(/^<@!?(\d+)>$/, "$1").trim();

      // Must be a valid snowflake (17-20 digits)
      if (!/^\d{17,20}$/.test(id)) return null;

      // Try to fetch the user from Discord API (works even if left server)
      const user = await client.users.fetch(id).catch(() => null);
      return user || null;
    };

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
              "`eb room remove 123456789` - Remove by ID (if user left server)",
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
              "• You can use a **User ID** instead of @mention if someone left the server",
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

      // Build friends list from DB
      let friendsList = "No friends added yet";
      if (data.friends && data.friends.length > 0) {
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
    // Supports @mention AND raw user ID
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

      // ✅ Support both @mention and raw ID
      const rawArg = args[1];
      if (!rawArg) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user or provide their ID.\n**Usage:** `eb room revoke @user` or `eb room revoke 123456789`",
            ),
          ],
        });
      }

      const targetUser = await resolveUser(rawArg);
      if (!targetUser) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Could not find that user. Please provide a valid @mention or User ID.",
            ),
          ],
        });
      }

      const ownerData = await PersonalChannel.findOne({ userId: targetUser.id });
      if (!ownerData) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ **${targetUser.username}** (ID: \`${targetUser.id}\`) doesn't own any room.`,
            ),
          ],
        });
      }

      const roomChannel = await client.channels
        .fetch(ownerData.channelId)
        .catch(() => null);

      // Remove ownership from database
      await PersonalChannel.deleteOne({ userId: targetUser.id });

      // Try to remove owner role (only works if still in server)
      const targetMember = await message.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

      if (targetMember) {
        await targetMember.roles.remove(ROLES.OWNER).catch(() => null);
      }

      // Reset channel permissions for the previous owner
      if (roomChannel) {
        await roomChannel.permissionOverwrites
          .delete(targetUser.id)
          .catch(() => null);
      }

      const revokeEmbed = new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("🚫 Room Ownership Revoked")
        .addFields(
          {
            name: "👤 Previous Owner",
            // Show username if available, fallback to ID tag
            value: `<@${targetUser.id}> (${targetUser.username ?? "Unknown User"})`,
            inline: true,
          },
          {
            name: "🆔 User ID",
            value: `\`${targetUser.id}\``,
            inline: true,
          },
          {
            name: "🏠 Channel",
            value: roomChannel
              ? `<#${ownerData.channelId}>`
              : "⚠️ Channel not found (already deleted)",
            inline: false,
          },
          {
            name: "ℹ️ Note",
            value: targetMember
              ? "The previous owner can still view and send messages as a regular member. Channel permissions have been reset."
              : "The user has left the server. Their channel permissions and ownership have been cleared.",
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

        await channel.permissionOverwrites
          .edit(room.userId, {
            ViewChannel: isJailed ? false : true,
            SendMessages: isJailed ? false : true,
            ManageMessages: isJailed ? false : true,
            EmbedLinks: isJailed ? false : true,
            ReadMessageHistory: true,
            AttachFiles: isJailed ? false : true,
            PinMessages: isJailed ? false : true,
          })
          .catch(() => null);

        if (room.friends && room.friends.length > 0) {
          for (const friendId of room.friends) {
            await channel.permissionOverwrites
              .edit(friendId, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                PinMessages: true,
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
              { name: "🏠 Rooms Fixed", value: `${fixedRooms}`, inline: true },
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
    // Supports @mention AND raw user ID
    // ==========================================
    if (subCommand === "add") {
      const rawArg = args[1];
      if (!rawArg) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user or provide their ID to invite.\n**Usage:** `eb room add @user` or `eb room add 123456789`",
            ),
          ],
        });
      }

      const friend = await resolveUser(rawArg);
      if (!friend) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Could not find that user. Please provide a valid @mention or User ID.",
            ),
          ],
        });
      }

      if (friend.id === message.author.id) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You can't add yourself to your own room!")],
        });
      }

      // ✅ Check if user is a bot
      if (friend.bot) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You cannot add bots to your room!")],
        });
      }

      const currentData = await PersonalChannel.findOne({
        channelId: message.channel.id,
      });
      if (currentData?.friends?.includes(friend.id)) {
        return message.channel.send({
          embeds: [
            errorEmbed(`❌ **${friend.username}** is already in your room!`),
          ],
        });
      }

      await PersonalChannel.findOneAndUpdate(
        { channelId: message.channel.id },
        { $addToSet: { friends: friend.id } },
        { returnDocument: "after" },
      );

      await message.channel.permissionOverwrites.edit(friend.id, {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
        ReadMessageHistory: true,
        PinMessages: true,
      });

      // Check if user is actually in the server for the display note
      const friendMember = await message.guild.members
        .fetch(friend.id)
        .catch(() => null);

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("✅ Friend Invited!")
            .setDescription(
              `**${friend.username}** has been added to your room.\n${
                friendMember
                  ? "They can now view and send messages here."
                  : "⚠️ Note: This user is not currently in the server, but permissions are saved for when they rejoin."
              }`,
            )
            .addFields({
              name: "🆔 User ID",
              value: `\`${friend.id}\``,
              inline: true,
            })
            .setThumbnail(friend.displayAvatarURL({ dynamic: true })),
        ],
      });
    }

    // ==========================================
    // REMOVE FRIEND COMMAND
    // Supports @mention AND raw user ID
    // ==========================================
    if (subCommand === "remove") {
      const rawArg = args[1];
      if (!rawArg) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Please mention a user or provide their ID to remove.\n**Usage:** `eb room remove @user` or `eb room remove 123456789`",
            ),
          ],
        });
      }

      const friend = await resolveUser(rawArg);
      if (!friend) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              "❌ Could not find that user. Please provide a valid @mention or User ID.",
            ),
          ],
        });
      }

      const currentData = await PersonalChannel.findOne({
        channelId: message.channel.id,
      });
      if (!currentData?.friends?.includes(friend.id)) {
        return message.channel.send({
          embeds: [
            errorEmbed(
              `❌ **${friend.username}** (ID: \`${friend.id}\`) is not in your friends list.`,
            ),
          ],
        });
      }

      // Remove from DB
      await PersonalChannel.findOneAndUpdate(
        { channelId: message.channel.id },
        { $pull: { friends: friend.id } },
        { returnDocument: "after" },
      );

      // Remove channel permissions (works even if user left server)
      await message.channel.permissionOverwrites
        .delete(friend.id)
        .catch(() => null);

      // Check if user is still in server for display note
      const friendMember = await message.guild.members
        .fetch(friend.id)
        .catch(() => null);

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#e74c3c")
            .setTitle("🚪 Friend Removed")
            .setDescription(
              `**${friend.username}** has been removed from your room.\n${
                friendMember
                  ? "They can no longer access this channel."
                  : "ℹ️ This user has already left the server. Their access permissions have been cleared."
              }`,
            )
            .addFields({
              name: "🆔 User ID",
              value: `\`${friend.id}\``,
              inline: true,
            })
            .setThumbnail(friend.displayAvatarURL({ dynamic: true })),
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