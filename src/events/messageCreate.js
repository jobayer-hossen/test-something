const Logger = require("../logger");
const userService = require("../database/services/userService");
const PersonalChannel = require("../database/schemas/PersonalChannel");
const moderationCommand = require("../commands/moderation");
const config = require("../config");

const logger = new Logger("MessageCreate");

const CHANNEL_COMMANDS = ["lock", "unlock", "hide", "unhide", "slow"];

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      if (!message.guild) return;
      if (message.author.id === client.user.id) return;

      // ════════════════════════════════════════
      //         TRACK USER ACTIVITY (NOT BOTS)
      // ════════════════════════════════════════
      if (!message.author.bot && !message.webhookId) {
        try {
          // Existing user service tracking
          await userService.getOrCreateUser(
            message.author.id,
            message.author.username,
            message.author.bot,
          );
          await userService.addXP(message.author.id, 1);

          // Personal channel tracking
          await PersonalChannel.findOneAndUpdate(
            { channelId: message.channel.id },
            { lastActivity: new Date() },
          ).catch(() => null);

          // NEW: Activity tracker for inactivity system
          if (client.features?.activityTracker) {
            await client.features.activityTracker.trackActivity(message);
          }

        } catch (error) {
          logger.debug("Error tracking user:", error.message);
        }
      }

      // ════════════════════════════════════════
      //   SUMMONER TOOTHBRUSH TRACKING (BOT ONLY)
      // ════════════════════════════════════════
      if (message.author.id === config.EPIC_RPG_BOT_ID && client.features?.summonerManager) {
        try {
          const content = message.content.trim();
          
          if (content.includes('casts a magic spell') && 
              content.includes('legendary toothbrush')) {
            
            const nameMatch = content.match(/^\*?\*?(.+?)\*?\*?\s+casts/i);
            if (nameMatch) {
              const epicRPGName = nameMatch[1].replace(/\*/g, '').trim();
              
              const CommandTracker = require("../database/schemas/CommandTracker");
              const userRecord = await CommandTracker.findOne({ 
                username: epicRPGName 
              }).lean();
              
              if (userRecord) {
                await client.features.summonerManager.trackToothbrush(userRecord.userId);
              }
            }
          }
        } catch (error) {
          logger.debug("Error tracking toothbrush:", error.message);
        }
      }

      const prefix = "eb";
      const lowerContent = message.content.toLowerCase();

      // ════════════════════════════════════════
      //   NO-PREFIX CHANNEL CONTROL COMMANDS
      // ════════════════════════════════════════
      if (!message.author.bot) {
        const trimmed = message.content.trim();
        const words = trimmed.split(/\s+/);
        const firstWord = words[0].toLowerCase();

        if (CHANNEL_COMMANDS.includes(firstWord)) {
          let isValid = false;

          if (words.length === 1) {
            isValid = true;
          } else if (words.length === 2 && words[1].match(/^<#\d+>$/)) {
            isValid = true;
          } else if (firstWord === "slow" && words.length === 2) {
            isValid = true;
          }

          if (isValid) {
            const channelCommand = client.commands.get("lock");
            if (channelCommand) {
              try {
                const args = words.slice(1);
                await channelCommand.execute(message, args, client, firstWord);
              } catch (error) {
                logger.error(
                  `Error executing channel command ${firstWord}:`,
                  error.message,
                );
              }
            }
            return;
          }
        }
      }

      // ════════════════════════════════════════
      //         PREFIX COMMANDS (eb ...)
      // ════════════════════════════════════════
      if (lowerContent.startsWith(prefix + " ")) {
        const args = message.content
          .slice(prefix.length + 1)
          .trim()
          .split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (moderationCommand.commands.includes(commandName)) {
          try {
            await moderationCommand.execute(message, args, client, commandName);
          } catch (error) {
            logger.error(
              `Error executing moderation command [${commandName}]:`,
              error.message,
            );
            await message.channel
              .send("❌ An error occurred while executing this command!")
              .catch(() => {});
          }
          return;
        }

        const resolvedName = CHANNEL_COMMANDS.includes(commandName)
          ? "lock"
          : commandName;

        const command = client.commands.get(resolvedName);

        if (command) {
          try {
            await command.execute(message, args, client, commandName);
          } catch (error) {
            logger.error(
              `Error executing command ${commandName}:`,
              error.message,
            );
            await message.channel.send(
              "❌ An error occurred while executing this command!",
            );
          }
        }
      }

      // ════════════════════════════════════════
      //         MESSAGE TRIGGERS
      // ════════════════════════════════════════
      try {
        const ownerID = "782630678389981244";
        const isDirectMention =
          message.mentions.users.has(ownerID) &&
          message.reference === null &&
          !message.author.bot;

        const containsIdLiteral =
          message.content.includes(`<@${ownerID}>`) ||
          message.content.includes(`<@!${ownerID}>`);

        if (isDirectMention && containsIdLiteral) {
          const stickers = [
            "https://cdn.discordapp.com/emojis/1472947968821694466.webp?size=96",
            "https://cdn.discordapp.com/emojis/1472948142591971462.webp?size=96",
            "https://cdn.discordapp.com/emojis/1472947830669967392.webp?size=96",
            "https://cdn.discordapp.com/emojis/1466641318913507451.webp?size=48",
            "https://cdn.discordapp.com/emojis/1500347936691851274.webp?size=48",
            "https://cdn.discordapp.com/emojis/1357479670584574093.webp?size=96",
            "https://cdn.discordapp.com/emojis/1472946773608759457.webp?size=96",
            "https://cdn.discordapp.com/emojis/1473035254435680450.webp?size=96",
            "https://cdn.discordapp.com/emojis/1484112777558622210.webp?size=48",
            "https://cdn.discordapp.com/emojis/1472946717220540600.webp?size=96",
            "https://cdn.discordapp.com/emojis/1469534191136936107.webp?size=96",
            "https://media.discordapp.net/stickers/1476422766755315855.webp?size=160&quality=lossless",
          ];
          const randomSticker =
            stickers[Math.floor(Math.random() * stickers.length)];
          await message.channel.send({
            content: randomSticker,
            allowedMentions: { repliedUser: false },
          });
        }

        if (client.features?.amanTrumpetReminder) {
          await client.features.amanTrumpetReminder.trackUsage(
            message.author.id,
            message,
          );
        }

        if (client.features?.coinRain) {
          client.features.coinRain.handleMessage(message);
        }

        if (client.features?.LootBoxSummoningFeature) {
          client.features.LootBoxSummoningFeature.handleMessage(message);
        }

        if (client.features?.commandTracker) {
          await client.features.commandTracker.handleMessage(message);
        }

        if (client.features?.beachPartyFeature) {
          await client.features.beachPartyFeature.handleMessage(message);
        }
      } catch (error) {
        logger.error("Error processing message triggers:", error.message);
      }
    } catch (error) {
      logger.error("Critical error in messageCreate:", error.message);
    }
  },
};