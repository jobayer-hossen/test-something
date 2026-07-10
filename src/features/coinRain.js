// const Logger = require("../logger");
// const logger = new Logger("CoinRain");

// class CoinRainFeature {
//   constructor(client) {
//     this.client = client;
//   }

//   async handleMessage(message) {
//     try {
//       if (!message.inGuild()) return;
//       if (message.author.id !== "555955826880413696") return;
//       if (!message.embeds?.length) return;

//       const embed = message.embeds[0];
//       if (!embed.fields?.length) return;

//       // ✅ Detect from field name (not title!)
//       const rainField = embed.fields.find((field) => {
//         if (!field.name) return false;

//         const normalized = field.name
//           .toUpperCase()
//           .replace(/[^A-Z ]/g, "") // remove emojis & symbols
//           .trim();

//         return normalized.includes("ITS RAINING COINS");
//       });

//       if (!rainField) return;

//       // ✅ Extract numbers from entire embed
//       let text = "";

//       if (embed.title) text += embed.title + " ";
//       if (embed.description) text += embed.description + " ";

//       for (const field of embed.fields) {
//         text += field.name + " " + field.value + " ";
//       }

//       const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
//       if (!numbers) return;

//       const maxReward = parseInt(
//         numbers[numbers.length - 1].replace(/,/g, ""),
//         10,
//       );
//       if (!maxReward || maxReward < 1_000_000_000_000_000) return;

//       const roleId = "1470272824500555980";
//       const formatted = maxReward.toLocaleString();

//       const sent = await message.channel.send({
//         content: `<@&${roleId}> You want those **${formatted}** coins. Type **CATCH** NOW!`,
//         allowedMentions: { parse: ["roles"] },
//       });

//       setTimeout(() => {
//         sent.delete().catch(() => {});
//       }, 60000);

//       console.log("✅ Coin Rain triggered");
//     } catch (err) {
//       logger.error("CoinRain error:", err);
//     }
//   }
// }

// module.exports = CoinRainFeature;

const Logger = require("../logger");
const logger = new Logger("CoinRain");

const RPG_BOT_ID = "555955826880413696";
const ROLE_ID = "1470272824500555980";
const COIN_THRESHOLD = 1_000_000_000_000_000;

class CoinRainFeature {
  constructor(client) {
    this.client = client;
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (message.author.id !== RPG_BOT_ID) return;

      // ✅ PART 1: Original embed detection (your working code)
      if (message.embeds?.length) {
        const embed = message.embeds[0];
        if (embed.fields?.length) {
          const rainField = embed.fields.find((field) => {
            if (!field.name) return false;

            const normalized = field.name
              .toUpperCase()
              .replace(/[^A-Z ]/g, "") // remove emojis & symbols
              .trim();

            return normalized.includes("ITS RAINING COINS");
          });

          if (rainField) {
            // ✅ Extract numbers from entire embed
            let text = "";

            if (embed.title) text += embed.title + " ";
            if (embed.description) text += embed.description + " ";

            for (const field of embed.fields) {
              text += field.name + " " + field.value + " ";
            }

            const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
            if (numbers) {
              const maxReward = parseInt(
                numbers[numbers.length - 1].replace(/,/g, ""),
                10,
              );

              if (maxReward && maxReward >= COIN_THRESHOLD) {
                const formatted = maxReward.toLocaleString();

                const sent = await message.channel.send({
                  content: `<@&${ROLE_ID}> You want those **${formatted}** coins. Type **CATCH** NOW!`,
                  allowedMentions: { parse: ["roles"] },
                });

                setTimeout(() => {
                  sent.delete().catch(() => {});
                }, 60000);

                logger.info("✅ Coin Rain triggered");
              }
            }
          }
        }
      }

      // ✅ PART 2: Player mention detection (plain text message)
      if (message.content) {
        const content = message.content;

        // Check if message has "Players:" and "Everyone got"
        if (!content.includes("Players:") || !content.includes("Everyone got")) return;

        // Extract coin amount
        const coinMatch = content.match(/Everyone got ([\d,]+) coins/i);
        if (!coinMatch) return;

        const coins = parseInt(coinMatch[1].replace(/,/g, ""), 10);
        if (!coins || coins < 1_000_000_0 ) return;

        const formatted = coins.toLocaleString();

        // Extract player names
        const playersMatch = content.match(/Players:\s*(.+?)(?:\n|:moneybag:|💰)/is);
        if (!playersMatch) return;

        const playerNames = playersMatch[1]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name.length > 0);

        if (!playerNames.length) return;

        logger.info(`🎉 Found ${playerNames.length} players with ${formatted} coins`);

        // Resolve player names to Discord mentions
        const resolvedMentions = await this.resolvePlayers(
          message.guild,
          playerNames,
        );

        // Send mention message
        await message.channel.send({
          content:
            `🎉 **Coin Rain Winners!**\n` +
            `${resolvedMentions.join(", ")}\n\n` +
            `💰 You all got **${formatted}** coins!\n` +
            `💡 **Convert your coins to gold bars now!**\n` +
            `> \`rpg cf h/t\` or \`rpg slots\``,
          allowedMentions: { parse: ["users"] },
        });

        logger.info(`✅ Mentioned ${playerNames.length} players after coin rain`);
      }
    } catch (err) {
      logger.error("CoinRain error:", err);
    }
  }

  // Try to resolve player names to Discord user mentions
  async resolvePlayers(guild, playerNames) {
    const mentions = [];

    try {
      await guild.members.fetch();

      for (const name of playerNames) {
        const searchName = name.toLowerCase();

        const member = guild.members.cache.find((m) => {
          const username = m.user.username.toLowerCase();
          const displayName = m.displayName.toLowerCase();
          const globalName = m.user.globalName?.toLowerCase() || "";

          return (
            username === searchName ||
            displayName === searchName ||
            globalName === searchName
          );
        });

        if (member) {
          mentions.push(member.toString()); // <@userId>
        } else {
          mentions.push(`**${name}**`); // Fallback: bold name if not found
        }
      }
    } catch (err) {
      logger.error("Error resolving players:", err);
      return playerNames.map((name) => `**${name}**`);
    }

    return mentions;
  }
}

module.exports = CoinRainFeature;
