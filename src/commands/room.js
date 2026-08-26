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
              "`eb room rename 😎-new-name` - Change your room's name",
            ].join("\n"),
            inline: false,
          },
          {
            name: "💡 Tips",
            value: [
              "• If you are inactive for 7 days, your room may be auto-deleted to save space.",
              "• Management commands only work inside **your own room**",
              "• `eb room info` works anywhere to check room status",
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

      const ownerData = await PersonalChannel.findOne({
        userId: targetUser.id,
      });
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

    // Add this inside room.js execute() — before the unknown subcommand handler

    // ==========================================
    // STAFF ONLY - Scan & Store All Room Categories
    // eb room scan
    // ==========================================
    if (subCommand === "scan") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You need **Manage Channels** permission.")],
        });
      }

      const processingMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#f39c12")
            .setTitle("🔍 Scanning All Personal Rooms...")
            .setDescription(
              "Reading current category for every room in the database...\nThis may take a moment.",
            ),
        ],
      });

      const allRooms = await PersonalChannel.find({});

      // Category name map for display
      const categoryNames = {
        [manager.supportersCategoryId]: "⭐ Supporters",
        [manager.normalUserCategoryId]: "👥 Normal User",
        [manager.archiveCategoryId]: "📦 Archive",
      };

      // Result buckets
      const results = {
        supporters: [], // Channels in supporters category
        normalUser: [], // Channels in normal user category
        archive: [], // Channels in archive category
        outside: [], // Admin-placed channels outside managed categories
        missing: [], // Channels deleted / not found
      };

      let processed = 0;

      for (const room of allRooms) {
        processed++;

        const channel = await client.channels
          .fetch(room.channelId)
          .catch(() => null);

        const user = await client.users.fetch(room.userId).catch(() => null);
        const username = user ? user.username : `Unknown (${room.userId})`;

        if (!channel) {
          results.missing.push({
            userId: room.userId,
            username,
            channelId: room.channelId,
          });
          continue;
        }

        const categoryId = channel.parentId;
        const entry = {
          userId: room.userId,
          username,
          channelId: room.channelId,
          channelName: channel.name,
          categoryId,
          categoryName: categoryNames[categoryId] || `Unknown (${categoryId})`,
        };

        // Update DB with current real category
        await PersonalChannel.findOneAndUpdate(
          { userId: room.userId },
          { categoryId: channel.parentId },
        ).catch(() => null);

        if (categoryId === manager.supportersCategoryId) {
          results.supporters.push(entry);
        } else if (categoryId === manager.normalUserCategoryId) {
          results.normalUser.push(entry);
        } else if (categoryId === manager.archiveCategoryId) {
          results.archive.push(entry);
        } else {
          // Outside managed = admin placed
          results.outside.push(entry);
        }
      }

      // ==========================================
      // BUILD RESULT EMBEDS
      // Split into multiple embeds if needed
      // ==========================================
      const embeds = [];

      // Summary embed
      const summaryEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📊 Room Scan Complete")
        .setDescription(
          `Scanned **${processed}** rooms from database.\nAll category data has been saved to database.`,
        )
        .addFields(
          {
            name: "⭐ Supporters Category",
            value: `${results.supporters.length} rooms`,
            inline: true,
          },
          {
            name: "👥 Normal User Category",
            value: `${results.normalUser.length} rooms`,
            inline: true,
          },
          {
            name: "📦 Archive Category",
            value: `${results.archive.length} rooms`,
            inline: true,
          },
          {
            name: "🔒 Admin-Placed (Outside Managed)",
            value: `${results.outside.length} rooms`,
            inline: true,
          },
          {
            name: "❌ Missing/Deleted Channels",
            value: `${results.missing.length} rooms`,
            inline: true,
          },
        )
        .setFooter({
          text: `Scanned by ${message.author.username} • Category data saved to DB`,
        })
        .setTimestamp();

      embeds.push(summaryEmbed);

      // Helper to chunk array into groups of 10 for fields
      const chunk = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      // Supporters rooms embed
      if (results.supporters.length > 0) {
        const chunks = chunk(results.supporters, 10);
        for (const [i, group] of chunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor("#f1c40f")
            .setTitle(`⭐ Supporters Category — Part ${i + 1}/${chunks.length}`)
            .setDescription(
              group
                .map(
                  (r) =>
                    `• **${r.username}** → <#${r.channelId}> (\`#${r.channelName}\`)`,
                )
                .join("\n"),
            );
          embeds.push(embed);
        }
      }

      // Normal user rooms embed
      if (results.normalUser.length > 0) {
        const chunks = chunk(results.normalUser, 10);
        for (const [i, group] of chunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle(
              `👥 Normal User Category — Part ${i + 1}/${chunks.length}`,
            )
            .setDescription(
              group
                .map(
                  (r) =>
                    `• **${r.username}** → <#${r.channelId}> (\`#${r.channelName}\`)`,
                )
                .join("\n"),
            );
          embeds.push(embed);
        }
      }

      // Archive rooms embed
      if (results.archive.length > 0) {
        const chunks = chunk(results.archive, 10);
        for (const [i, group] of chunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor("#e67e22")
            .setTitle(`📦 Archive Category — Part ${i + 1}/${chunks.length}`)
            .setDescription(
              group
                .map(
                  (r) =>
                    `• **${r.username}** → <#${r.channelId}> (\`#${r.channelName}\`)`,
                )
                .join("\n"),
            );
          embeds.push(embed);
        }
      }

      // Admin-placed rooms embed
      if (results.outside.length > 0) {
        const chunks = chunk(results.outside, 10);
        for (const [i, group] of chunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle(
              `🔒 Admin-Placed Rooms (Outside Managed) — Part ${i + 1}/${chunks.length}`,
            )
            .setDescription(
              group
                .map(
                  (r) =>
                    `• **${r.username}** → <#${r.channelId}> (\`#${r.channelName}\`) — Category: \`${r.categoryName}\``,
                )
                .join("\n"),
            )
            .setFooter({ text: "⚠️ These channels will NEVER be auto-moved" });
          embeds.push(embed);
        }
      }

      // Missing channels embed
      if (results.missing.length > 0) {
        const chunks = chunk(results.missing, 10);
        for (const [i, group] of chunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor("#e74c3c")
            .setTitle(
              `❌ Missing/Deleted Channels — Part ${i + 1}/${chunks.length}`,
            )
            .setDescription(
              group
                .map(
                  (r) =>
                    `• **${r.username}** → Channel ID: \`${r.channelId}\` (deleted or inaccessible)`,
                )
                .join("\n"),
            )
            .setFooter({
              text: "These users still have DB records but no channel",
            });
          embeds.push(embed);
        }
      }

      // Discord max 10 embeds per message - send in batches
      await processingMsg.delete().catch(() => null);

      const embedChunks = chunk(embeds, 10);
      for (const embedBatch of embedChunks) {
        await message.channel.send({ embeds: embedBatch });
      }
    }

    // ==========================================
    // STAFF ONLY - Migrate All Rooms to Correct Categories
    // eb room migrate
    // ==========================================
    if (subCommand === "migrate") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.channel.send({
          embeds: [errorEmbed("❌ You need **Manage Channels** permission.")],
        });
      }

      const processingMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#f39c12")
            .setTitle("🔄 Migrating All Rooms...")
            .setDescription(
              [
                "Checking every room owner's booster status...",
                "• Has booster role → **Supporters Category**",
                "• No booster role → **Normal User Category**",
                "",
                "⚠️ Channels outside supporters or normal user category will be **skipped** (admin/staff placed).",
                "",
                "⏳ Please wait, this may take a while...",
              ].join("\n"),
            ),
        ],
      });

      const allRooms = await PersonalChannel.find({});

      const results = {
        movedToSupporters: [],
        movedToNormal: [],
        alreadyCorrect: [],
        skipped: [],
        missing: [],
      };

      // Fetch log channel once
      const logChannel = await client.channels
        .fetch(manager.logChannelId)
        .catch(() => null);

      for (const room of allRooms) {
        const channel = await client.channels
          .fetch(room.channelId)
          .catch(() => null);

        const user = await client.users.fetch(room.userId).catch(() => null);
        const username = user?.username ?? `Unknown (${room.userId})`;

        // Channel deleted
        if (!channel) {
          results.missing.push({
            userId: room.userId,
            username,
            channelId: room.channelId,
          });
          continue;
        }

        const currentCategoryId = channel.parentId;

        // ==========================================
        // ONLY work with supporters or normal user
        // Everything else = admin/staff placed = skip
        // ==========================================
        const isSupporters = currentCategoryId === manager.supportersCategoryId;
        const isNormalUser = currentCategoryId === manager.normalUserCategoryId;

        if (!isSupporters && !isNormalUser) {
          results.skipped.push({
            username,
            channelName: channel.name,
            channelId: room.channelId,
            categoryId: currentCategoryId,
          });
          continue;
        }

        // Check booster role
        const member = await message.guild.members
          .fetch(room.userId)
          .catch(() => null);

        const hasBooster =
          member?.roles.cache.has(manager.boosterRoleId) ?? false;

        // Correct category based on booster role
        const correctCategory = hasBooster
          ? manager.supportersCategoryId
          : manager.normalUserCategoryId;

        const entry = {
          username,
          channelName: channel.name,
          channelId: room.channelId,
          userId: room.userId,
          hasBooster,
        };

        // Already in correct category - just update DB
        if (currentCategoryId === correctCategory) {
          results.alreadyCorrect.push(entry);

          await PersonalChannel.findOneAndUpdate(
            { userId: room.userId },
            { categoryId: correctCategory },
          ).catch(() => null);

          continue;
        }

        // Move to correct category
        await channel
          .setParent(correctCategory, { lockPermissions: false })
          .catch(() => null);

        // Update DB
        await PersonalChannel.findOneAndUpdate(
          { userId: room.userId },
          { categoryId: correctCategory },
        ).catch(() => null);

        if (hasBooster) {
          results.movedToSupporters.push(entry);

          // ✅ Log channel message for moved to supporters
          if (logChannel) {
            await logChannel.send({
              content: `⭐ **[MIGRATE]** <@${room.userId}> has booster role. Personal room **#${channel.channelId}** moved to supporters category.`,
            });
          }
        } else {
          results.movedToNormal.push(entry);

          // ✅ Log channel message for moved to normal user
          if (logChannel) {
            await logChannel.send({
              content: `📦 **[MIGRATE]** <@${room.userId}> has no booster role. Personal room **#${channel.channelId}** moved to normal user category.`,
            });
          }
        }
      }

      // ==========================================
      // BUILD RESULT EMBEDS
      // ==========================================
      const chunk = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const embeds = [];

      // Summary embed
      const summaryEmbed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle("✅ Migration Complete!")
        .addFields(
          {
            name: "⭐ Moved → Supporters",
            value: `${results.movedToSupporters.length} rooms`,
            inline: true,
          },
          {
            name: "👥 Moved → Normal User",
            value: `${results.movedToNormal.length} rooms`,
            inline: true,
          },
          {
            name: "✅ Already Correct",
            value: `${results.alreadyCorrect.length} rooms`,
            inline: true,
          },
          {
            name: "🔒 Skipped (Admin/Staff Placed)",
            value: `${results.skipped.length} rooms`,
            inline: true,
          },
          {
            name: "❌ Missing Channels",
            value: `${results.missing.length} rooms`,
            inline: true,
          },
        )
        .setFooter({
          text: `Migrated by ${message.author.username} • DB records updated`,
        })
        .setTimestamp();

      embeds.push(summaryEmbed);

      // Moved to supporters
      if (results.movedToSupporters.length > 0) {
        const chunks = chunk(results.movedToSupporters, 10);
        for (const [i, group] of chunks.entries()) {
          embeds.push(
            new EmbedBuilder()
              .setColor("#f1c40f")
              .setTitle(
                `⭐ Moved → Supporters — Part ${i + 1}/${chunks.length}`,
              )
              .setDescription(
                group
                  .map((r) => `• **${r.username}** → \`#${r.channelName}\``)
                  .join("\n"),
              ),
          );
        }
      }

      // Moved to normal user
      if (results.movedToNormal.length > 0) {
        const chunks = chunk(results.movedToNormal, 10);
        for (const [i, group] of chunks.entries()) {
          embeds.push(
            new EmbedBuilder()
              .setColor("#2ecc71")
              .setTitle(
                `👥 Moved → Normal User — Part ${i + 1}/${chunks.length}`,
              )
              .setDescription(
                group
                  .map((r) => `• **${r.username}** → \`#${r.channelName}\``)
                  .join("\n"),
              ),
          );
        }
      }

      // Skipped
      if (results.skipped.length > 0) {
        const chunks = chunk(results.skipped, 10);
        for (const [i, group] of chunks.entries()) {
          embeds.push(
            new EmbedBuilder()
              .setColor("#9b59b6")
              .setTitle(
                `🔒 Skipped (Admin/Staff Placed) — Part ${i + 1}/${chunks.length}`,
              )
              .setDescription(
                group
                  .map(
                    (r) =>
                      `• **${r.username}** → \`#${r.channelName}\` — Category: \`${r.categoryId}\``,
                  )
                  .join("\n"),
              )
              .setFooter({ text: "⚠️ These will NEVER be auto-moved" }),
          );
        }
      }

      // Missing
      if (results.missing.length > 0) {
        const chunks = chunk(results.missing, 10);
        for (const [i, group] of chunks.entries()) {
          embeds.push(
            new EmbedBuilder()
              .setColor("#e74c3c")
              .setTitle(`❌ Missing Channels — Part ${i + 1}/${chunks.length}`)
              .setDescription(
                group
                  .map(
                    (r) =>
                      `• **${r.username}** → Channel ID: \`${r.channelId}\` (deleted)`,
                  )
                  .join("\n"),
              )
              .setFooter({
                text: "These users still have DB records but no channel",
              }),
          );
        }
      }

      await processingMsg.delete().catch(() => null);

      // Send in batches of 10
      const embedBatches = chunk(embeds, 10);
      for (const batch of embedBatches) {
        await message.channel.send({ embeds: batch });
      }
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
