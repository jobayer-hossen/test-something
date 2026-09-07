// BaseManager.js - Updated version with category history tracking
const PersonalChannel = require("../database/schemas/PersonalChannel");
const Logger = require("../logger");
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

    this.boosterRoleId = "1338629257345241198";
    this.supportersCategoryId = "1513215217578807437";
    this.normalUserCategoryId = "1479929670219858221";

    this.logChannelId = "1503339439777124382";
    this.archiveCategoryId = "1329960246759915632";

    // ONLY these 2 categories are managed for inactivity
    // Supporters and Normal User users can lose room for inactivity
    // Any channel outside these 2 = admin/staff placed = never touch for inactivity
    this.inactivityManagedCategories = [
      this.supportersCategoryId,
      this.normalUserCategoryId,
    ];

    this.startInactivityChecker();
    this.startBoosterRoleWatcher();
  }

  // ==========================================
  // BOOSTER ROLE WATCHER
  // ONLY moves between supportersCategory
  // and normalUserCategory - nothing else ever
  // ==========================================
  startBoosterRoleWatcher() {
    this.client.on("guildMemberUpdate", async (oldMember, newMember) => {
      try {
        const hadBooster = oldMember.roles.cache.has(this.boosterRoleId);
        const hasBooster = newMember.roles.cache.has(this.boosterRoleId);

        // No booster change - ignore completely
        if (hadBooster === hasBooster) return;

        // Find personal room in DB
        const roomData = await PersonalChannel.findOne({
          userId: newMember.id,
        });

        // No room = nothing to do
        if (!roomData) return;

        // Fetch the actual Discord channel
        const channel = await this.client.channels
          .fetch(roomData.channelId)
          .catch(() => null);

        if (!channel) return;

        const currentCategoryId = channel.parentId;

        const logChannel = await this.client.channels
          .fetch(this.logChannelId)
          .catch(() => null);

        // ==========================================
        // BOOSTER LOST
        // ONLY act if channel is in supportersCategoryId
        // Move to normal category and save history
        // ==========================================
        if (hadBooster && !hasBooster) {
          if (currentCategoryId !== this.supportersCategoryId) {
            logger.info(
              `[BOOSTER LOST] Skipping #${channel.name} — not in supporters category. Never touching.`
            );
            return;
          }

          // Save previous category in history before moving
          await PersonalChannel.findOneAndUpdate(
            { userId: newMember.id },
            {
              categoryId: this.normalUserCategoryId,
              previousCategoryId: this.supportersCategoryId,
            }
          );

          await channel.setParent(this.normalUserCategoryId, {
            lockPermissions: false,
          });

          logger.info(
            `[BOOSTER LOST] #${channel.name} → Normal User Category for ${newMember.user.username}`
          );

          if (logChannel) {
            await logChannel.send({
              content: `📦 <@${newMember.id}> lost their **Server Booster** role. Personal room <#${channel.id}> has been moved to the normal user category.`,
            });
          }
        }

        // ==========================================
        // BOOSTER GAINED
        // ONLY act if channel is in normalUserCategoryId
        // Move to supporters category and save history
        // ==========================================
        if (!hadBooster && hasBooster) {
          if (currentCategoryId !== this.normalUserCategoryId) {
            logger.info(
              `[BOOSTER GAINED] Skipping #${channel.name} — not in normal user category. Never touching.`
            );
            return;
          }

          // Save previous category in history before moving
          await PersonalChannel.findOneAndUpdate(
            { userId: newMember.id },
            {
              categoryId: this.supportersCategoryId,
              previousCategoryId: this.normalUserCategoryId,
            }
          );

          await channel.setParent(this.supportersCategoryId, {
            lockPermissions: false,
          });

          logger.info(
            `[BOOSTER GAINED] #${channel.name} → Supporters Category for ${newMember.user.username}`
          );

          if (logChannel) {
            await logChannel.send({
              content: `⭐ <@${newMember.id}> boosted the server! Personal room <#${channel.id}> has been moved back to the supporters category.`,
            });
          }
        }
      } catch (err) {
        logger.error(`[BOOSTER WATCHER ERROR] ${err.message}`);
      }
    });
  }

  // ==========================================
  // INACTIVITY CHECKER - Every hour
  // ONLY checks channels in supporters OR
  // normal user category
  // Staff/admin channels = never touched
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

          // Channel deleted from Discord but still in DB - clean up DB
          if (!channel) {
            await PersonalChannel.deleteOne({ userId: room.userId });
            logger.info(
              `[INACTIVITY] Cleaned DB record for deleted channel. User: ${room.userId}`
            );
            continue;
          }

          const currentCategoryId = channel.parentId;

          // ==========================================
          // CRITICAL SAFETY CHECK
          // Only remove rooms in supporters or normal user category
          // Admin/staff channels = NEVER touched for inactivity
          // ==========================================
          if (!this.inactivityManagedCategories.includes(currentCategoryId)) {
            logger.info(
              `[INACTIVITY] Skipping #${channel.name} — in unmanaged category (${currentCategoryId}). Admin/staff channel, never touching.`
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

          // 1. DM the user FIRST (before archiving)
          if (user) {
            const dmEmbed = new EmbedBuilder()
              .setColor("#FF4742")
              .setTitle("🏠 Personal Room Update")
              .setAuthor({
                name: "EPIC-BOTS",
                iconURL: channel.guild.iconURL(),
              })
              .setDescription(
                `Hello **${user.username}**, your personal room has been closed and access has been removed due to **inactivity**.`
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
                }
              )
              .addFields({
                name: "📩 Want to return?",
                value: `If you become active again and need a room, please visit <#1503339439777124382> to submit a new request.`,
              })
              .setFooter({ text: "Automated Guild Management" })
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] }).catch(() => null);
          }

          // 2. Remove owner role from user
          if (member) {
            await member.roles
              .remove(this.ownerRoleId)
              .catch((err) => {
                logger.error(
                  `[INACTIVITY] Failed to remove owner role from ${room.userId}: ${err.message}`
                );
              });
            logger.info(
              `[INACTIVITY] Removed owner role (${this.ownerRoleId}) from user ${room.userId}`
            );
          }

          // 3. Log to channel BEFORE archiving (non-clickable channel name)
          const logChannel = await this.client.channels
            .fetch(this.logChannelId)
            .catch(() => null);

          if (logChannel) {
            await logChannel.send({
              content: `❌ <@${room.userId}> lost their personal room \`${channel.name}\` after 7 days of inactivity.\n📩 Write in <#1509133186645495868> if you want a new one when you return.\n🛡️ **Spanac guild** members can contact an admin to automatically receive a new channel again.`,
            });
          }

          // 4. NOW move to archive and lock
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

          // 5. Remove from database
          await PersonalChannel.deleteOne({ userId: room.userId });

          logger.info(
            `[INACTIVITY] Removed room #${channel.name} for user ${room.userId}`
          );
        } catch (err) {
          logger.error(`[INACTIVITY ERROR] ${err.message}`);
        }
      }
    }, 3600000); // Every hour
  }
}

module.exports = BaseManager;