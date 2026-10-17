// BaseManager.js - Vanguard, Trusted role, Summoner role + position history tracking
const PersonalChannel = require("../database/schemas/PersonalChannel");
const Logger = require("../logger");
const config = require("../config");
const { EmbedBuilder } = require("discord.js");
const logger = new Logger("BaseManager");

class BaseManager {
  constructor(client) {
    this.client = client;
    this.initiateRoleId = "1330560814536589433";
    this.ownerRoleId = "1509634371999502435";

    this.staff1Id = "1472621955407548416";
    this.modId = "1348685917338210315";
    this.botRoleId = "970000054012244008";
    this.jailRoleId = "1498459449227083916";

    // Roles that affect personal room category placement
    this.boosterRoleId = "1338629257345241198";
    this.trustedRoleId = "969999863871832177";
    this.summonerRoleId = config.SUMMONER_ROLE_ID;

    // Categories
    this.vanguardCategoryId = "1513214558691659977";
    this.supportersCategoryId = "1513215217578807437";
    this.normalUserCategoryId = "1479929670219858221";

    // Logging
    this.logChannelId = "1503339439777124382";
    this.archiveCategoryId = "1329960246759915632";

    // ALL categories managed (role movement + inactivity)
    // Any channel outside these = admin/staff placed = never touched
    this.managedCategories = [
      this.vanguardCategoryId,
      this.supportersCategoryId,
      this.normalUserCategoryId,
    ];

    this.inactivityManagedCategories = this.managedCategories;

    this.startInactivityChecker();
    this.startRoleWatcher();
  }

  // ==========================================
  // Priority: Trusted/Summoner > Booster > Normal
  // ==========================================
  determineTargetCategory(member) {
    const hasTrusted = member.roles.cache.has(this.trustedRoleId);
    const hasSummoner =
      this.summonerRoleId && member.roles.cache.has(this.summonerRoleId);
    const hasBooster = member.roles.cache.has(this.boosterRoleId);

    if (hasTrusted || hasSummoner) return this.vanguardCategoryId;
    if (hasBooster) return this.supportersCategoryId;
    return this.normalUserCategoryId;
  }

  getCategoryName(categoryId) {
    if (categoryId === this.vanguardCategoryId) return "Vanguard";
    if (categoryId === this.supportersCategoryId) return "Supporters";
    if (categoryId === this.normalUserCategoryId) return "Normal User";
    return "Unknown";
  }

  // ==========================================
  // Helper: returns sorted text channels in a category,
  // using the live guild cache (always fresh, unlike
  // category.children.cache which can lag behind).
  // Optionally excludes a specific channel (the one
  // being moved) so it never pollutes the calculation.
  // ==========================================
  async getCategoryChannelsSorted(categoryId, excludeChannelId = null) {
    const category = await this.client.channels
      .fetch(categoryId)
      .catch(() => null);
    if (!category) return [];

    return category.guild.channels.cache
      .filter(
        (ch) =>
          ch.parentId === categoryId &&
          ch.type === 0 &&
          ch.id !== excludeChannelId,
      )
      .sort((a, b) => a.position - b.position)
      .map((ch) => ch);
  }

  // ==========================================
  // Shared helper: moves channel to target category,
  // restoring previous index in that category if we
  // have history for it — otherwise pushes to bottom.
  // Saves history of the category being left, logs the move.
  // ==========================================
  async moveChannelToCategory(channel, targetCategoryId, member, reasonText) {
    try {
      const previousCategoryId = channel.parentId;

      // 1. Figure out the channel's current index in the category it's leaving
      //    (so we can remember it for next time it needs to go back there)
      const siblingsBefore = await this.getCategoryChannelsSorted(
        previousCategoryId,
        channel.id,
      );
      let previousIndex = siblingsBefore.findIndex(
        (ch) => ch.position > channel.position,
      );
      if (previousIndex === -1) previousIndex = siblingsBefore.length;

      // 2. Check if we have a saved index for the TARGET category
      const roomData = await PersonalChannel.findOne({ userId: member.id });
      const history =
        (roomData && roomData.categoryPositionHistory) || {};
      const savedIndex = history[targetCategoryId];

      // 3. Actually move the channel
      await channel.setParent(targetCategoryId, { lockPermissions: false });

      // 4. Get fresh sibling list in the new category (excluding self)
      const siblingsAfter = await this.getCategoryChannelsSorted(
        targetCategoryId,
        channel.id,
      );

      let newPosition;

      if (
        savedIndex !== undefined &&
        savedIndex !== null &&
        savedIndex < siblingsAfter.length
      ) {
        // Restore to the previously known spot
        newPosition = siblingsAfter[savedIndex].position;
        logger.info(
          `[ROLE WATCHER] Restoring #${channel.name} to previous index ${savedIndex} in ${this.getCategoryName(targetCategoryId)}`,
        );
      } else {
        // No history (or it's now out of range) — push to the bottom
        newPosition =
          siblingsAfter.length > 0
            ? siblingsAfter[siblingsAfter.length - 1].position + 1
            : 0;
      }

      await channel.setPosition(newPosition);

      // 5. Save history: remember index in the category just left,
      //    update current/previous category pointers
      await PersonalChannel.findOneAndUpdate(
        { userId: member.id },
        {
          $set: {
            categoryId: targetCategoryId,
            previousCategoryId,
            [`categoryPositionHistory.${previousCategoryId}`]: previousIndex,
          },
        },
      );

      logger.info(
        `[ROLE WATCHER] #${channel.name} → ${this.getCategoryName(targetCategoryId)} for ${member.user.username} (${reasonText})`,
      );

      const logChannel = await this.client.channels
        .fetch(this.logChannelId)
        .catch(() => null);

      if (logChannel) {
        await logChannel
          .send({
            content: `📦 <@${member.id}> ${reasonText}. Personal room <#${channel.id}> moved to **${this.getCategoryName(targetCategoryId)}** category.`,
          })
          .catch(() => null);
      }
    } catch (err) {
      logger.error(`[MOVE CHANNEL ERROR] ${err.message}`);
    }
  }

  // ==========================================
  // UNIFIED ROLE WATCHER
  // Watches Booster, Trusted, and Summoner roles.
  // ==========================================
  startRoleWatcher() {
    this.client.on("guildMemberUpdate", async (oldMember, newMember) => {
      try {
        const watchedRoles = [
          this.boosterRoleId,
          this.trustedRoleId,
          this.summonerRoleId,
        ].filter(Boolean);

        const changed = watchedRoles.some(
          (roleId) =>
            oldMember.roles.cache.has(roleId) !==
            newMember.roles.cache.has(roleId),
        );

        if (!changed) return;

        const roomData = await PersonalChannel.findOne({
          userId: newMember.id,
        });
        if (!roomData) return;

        const channel = await this.client.channels
          .fetch(roomData.channelId)
          .catch(() => null);
        if (!channel) return;

        const currentCategoryId = channel.parentId;

        if (!this.managedCategories.includes(currentCategoryId)) {
          logger.info(
            `[ROLE WATCHER] Skipping #${channel.name} — not in a managed category (${currentCategoryId}). Never touching.`,
          );
          return;
        }

        const targetCategoryId = this.determineTargetCategory(newMember);

        if (targetCategoryId === currentCategoryId) return;

        let reasonText = "had a role update";

        if (
          newMember.roles.cache.has(this.trustedRoleId) &&
          !oldMember.roles.cache.has(this.trustedRoleId)
        ) {
          reasonText = "gained the Trusted role";
        } else if (
          !newMember.roles.cache.has(this.trustedRoleId) &&
          oldMember.roles.cache.has(this.trustedRoleId)
        ) {
          reasonText = "lost the Trusted role";
        } else if (
          this.summonerRoleId &&
          newMember.roles.cache.has(this.summonerRoleId) &&
          !oldMember.roles.cache.has(this.summonerRoleId)
        ) {
          reasonText = "gained the Summoner role";
        } else if (
          this.summonerRoleId &&
          !newMember.roles.cache.has(this.summonerRoleId) &&
          oldMember.roles.cache.has(this.summonerRoleId)
        ) {
          reasonText = "lost the Summoner role";
        } else if (
          newMember.roles.cache.has(this.boosterRoleId) &&
          !oldMember.roles.cache.has(this.boosterRoleId)
        ) {
          reasonText = "boosted the server";
        } else if (
          !newMember.roles.cache.has(this.boosterRoleId) &&
          oldMember.roles.cache.has(this.boosterRoleId)
        ) {
          reasonText = "lost the Booster role";
        }

        await this.moveChannelToCategory(
          channel,
          targetCategoryId,
          newMember,
          reasonText,
        );
      } catch (err) {
        logger.error(`[ROLE WATCHER ERROR] ${err.message}`);
      }
    });
  }

  // ==========================================
  // INACTIVITY CHECKER - Every hour
  // ==========================================
  startInactivityChecker() {
    setInterval(async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const inactiveRooms = await PersonalChannel.find({
        lastActivity: { $lt: sevenDaysAgo },
      });

      for (const room of inactiveRooms) {
        try {
          const channel = await this.client.channels
            .fetch(room.channelId)
            .catch(() => null);

          if (!channel) {
            await PersonalChannel.deleteOne({ userId: room.userId });
            logger.info(
              `[INACTIVITY] Cleaned DB record for deleted channel. User: ${room.userId}`,
            );
            continue;
          }

          const currentCategoryId = channel.parentId;

          if (!this.inactivityManagedCategories.includes(currentCategoryId)) {
            logger.info(
              `[INACTIVITY] Skipping #${channel.name} — in unmanaged category (${currentCategoryId}). Admin/staff channel, never touching.`,
            );
            continue;
          }

          const user = await this.client.users
            .fetch(room.userId)
            .catch(() => null);

          const guild = channel.guild;
          const member = await guild.members
            .fetch(room.userId)
            .catch(() => null);

          if (user) {
            const dmEmbed = new EmbedBuilder()
              .setColor("#FF4742")
              .setTitle("🏠 Personal Room Update")
              .setAuthor({
                name: "EPIC-BOTS",
                iconURL: channel.guild.iconURL(),
              })
              .setDescription(
                `Hello **${user.username}**, your personal room has been closed and access has been removed due to **inactivity**.`,
              )
              .addFields(
                {
                  name: "📝 Room",
                  value: `\`${channel.name}\``,
                  inline: true,
                },
                {
                  name: "⏳ Status",
                  value: "Inactive (Limit Reached)",
                  inline: true,
                },
              )
              .addFields({
                name: "📩 Want to return?",
                value: `If you become active again and need a room, please visit <#1503339439777124382> to submit a new request.`,
              })
              .setFooter({ text: "Automated Guild Management" })
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] }).catch(() => null);
          }

          if (member) {
            await member.roles.remove(this.ownerRoleId).catch((err) => {
              logger.error(
                `[INACTIVITY] Failed to remove owner role from ${room.userId}: ${err.message}`,
              );
            });
            logger.info(
              `[INACTIVITY] Removed owner role (${this.ownerRoleId}) from user ${room.userId}`,
            );
          }

          const logChannel = await this.client.channels
            .fetch(this.logChannelId)
            .catch(() => null);

          if (logChannel) {
            await logChannel
              .send({
                content: `❌ <@${room.userId}> lost their personal room \`${channel.name}\` after 7 days of inactivity.\n📩 Write in <#1509133186645495868> if you want a new one when you return.`,
              })
              .catch(() => null);
          }

          await channel.setParent(this.archiveCategoryId, {
            lockPermissions: false,
          });

          await channel.permissionOverwrites.set([
            {
              id: channel.guild.id,
              deny: ["ViewChannel", "SendMessages"],
            },
            {
              id: this.initiateRoleId,
              deny: ["ViewChannel", "SendMessages"],
            },
            {
              id: this.botRoleId,
              deny: ["ViewChannel", "SendMessages"],
            },
            {
              id: this.client.user.id,
              allow: ["ViewChannel", "ManageChannels"],
            },
          ]);

          await PersonalChannel.deleteOne({ userId: room.userId });

          logger.info(
            `[INACTIVITY] Removed room #${channel.name} for user ${room.userId}`,
          );
        } catch (err) {
          logger.error(`[INACTIVITY ERROR] ${err.message}`);
        }
      }
    }, 3600000);
  }
}

module.exports = BaseManager;