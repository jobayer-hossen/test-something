const Logger = require("../logger");
const userService = require("../database/services/userService");

const logger = new Logger("MessageCreate");

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      if (!message.guild) return;
      if (message.author.id === client.user.id) return;

      // Track user activity (ONLY FOR REAL USERS, NOT BOTS)
      if (!message.author.bot) {
        try {
          await userService.getOrCreateUser(
            message.author.id,
            message.author.username,
            message.author.bot, // Pass bot status
          );
          await userService.addXP(message.author.id, 1);
        } catch (error) {
          logger.debug("Error tracking user:", error.message);
        }
      }

      const prefix = "eb";
      const lowerContent = message.content.toLowerCase();

      // Handle prefix commands
      if (lowerContent.startsWith(prefix + " ")) {
        const args = message.content
          .slice(prefix.length + 1)
          .trim()
          .split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (command) {
          try {
            await command.execute(message, args, client);
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

      try {
        // Handle mentions - ONLY for direct mentions, NOT replies
        const ownerID = "782630678389981244";

        // Check if the owner is mentioned BUT NOT as a reply
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

        // Track Aman Trumpet usage
        if (client.features.amanTrumpetReminder) {
          await client.features.amanTrumpetReminder.trackUsage(
            message.author.id,
            message,
          );
        }

        // Handle coin rain
        if (client.features.coinRain) {
          await client.features.coinRain.handleMessage(message);
        }

        // Handle lootbox summoning
        if (client.features.lootboxSummoning) {
          await client.features.lootboxSummoning.handleMessage(message);
        }

        // Handle RPG Tracker
        if (client.features.rpgTracker) {
          await client.features.rpgTracker.handleMessage(message);
        }
      } catch (error) {
        logger.error("Error processing message:", error.message);
      }
    } catch (error) {
      logger.error("Critical error in messageCreate:", error.message);
    }
  },
};
