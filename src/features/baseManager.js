const PersonalChannel = require("../database/schemas/PersonalChannel");
const Logger = require("../logger");
const { EmbedBuilder } = require("discord.js");
const logger = new Logger("BaseManager");

class BaseManager {
  constructor(client) {
    this.client = client;
    this.initiateRoleId = "1330560814536589433";
    this.ownerRoleId = "1509634371999502435";
    this.botRoleId = "970000054012244008";
    this.logChannelId = "1503339439777124382";
    this.archiveCategoryId = "1329960246759915632"; // We move it here but don't call it "Archive" in text

    this.startInactivityChecker();
  }

  startInactivityChecker() {
    setInterval(async () => {
      // TESTING: Threshold set to 1 minute.
      // Change to (7 * 24 * 60 * 60 * 1000) for 7 days later.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const inactiveRooms = await PersonalChannel.find({
        lastActivity: { $lt: sevenDaysAgo },
      });

      for (const room of inactiveRooms) {
        try {
          const channel = await this.client.channels
            .fetch(room.channelId)
            .catch(() => null);
          const user = await this.client.users
            .fetch(room.userId)
            .catch(() => null);

          if (channel) {
            // 1. Relocate and Lock (Silent processing)
            await channel.setParent(this.archiveCategoryId, {
              lockPermissions: false,
            });
            await channel.permissionOverwrites.set([
              { id: channel.guild.id, deny: ["ViewChannel", "SendMessages"] },
              {
                id: this.initiateRoleId,
                deny: ["ViewChannel", "SendMessages"],
              },
              { id: this.botRoleId, deny: ["ViewChannel", "SendMessages"] },
              {
                id: this.client.user.id,
                allow: ["ViewChannel", "ManageChannels"],
              },
            ]);

            // 2. Beautiful Inactivity DM
            if (user) {
              const dmEmbed = new EmbedBuilder()
                .setColor("#FF4742") // Urgent Red
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
                    value: `Inactive (Limit Reached)`,
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

            // 3. Send Public Log
            const logChannel = await this.client.channels
              .fetch(this.logChannelId)
              .catch(() => null);
            if (logChannel) {
              await logChannel.send({
                content: `❌ <@${room.userId}> lost their private channel after 7 days of inactivity.\n📩 Write in <#1509133186645495868> if you want a new one when you return.\n🛡️ **Spanac guild** members can contact an admin to automatically receive a new channel again.`,
              });
            }

            // 4. Wipe Ownership from Database
            await PersonalChannel.deleteOne({ userId: room.userId });
            logger.info(`Removed inactive room for user ${room.userId}`);
          }
        } catch (err) {
          logger.error(`Error during room removal: ${err.message}`);
        }
      }
    }, 3600000); // Check every hour
  }
}

module.exports = BaseManager;
