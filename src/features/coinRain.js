const Logger = require("../logger");
const logger = new Logger("CoinRain");

class CoinRainFeature {
  constructor(client) {
    this.client = client;
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (!message.author || message.author.id !== "555955826880413696") return;
      if (!message.embeds || message.embeds.length === 0) return;

      const embed = message.embeds[0];

      // ✅ Build searchable text (title + description + fields)
      let text = "";

      if (embed.title) text += embed.title + " ";
      if (embed.description) text += embed.description + " ";

      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          if (field.name) text += field.name + " ";
          if (field.value) text += field.value + " ";
        }
      }

      const upperText = text.toUpperCase();

      // ✅ Flexible detection
      if (!upperText.includes("RAIN") || !upperText.includes("COIN")) return;

      // ✅ Extract numbers
      const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (!numbers || numbers.length === 0) return;

      const lastNumber = numbers[numbers.length - 1].replace(/,/g, "");
      const maxReward = parseInt(lastNumber, 10);
      if (!maxReward) return;

      // ✅ 1 Quadrillion minimum check
      if (maxReward < 1_000_000_000_000_000) {
        logger.debug(`Coin rain ignored: ${maxReward}`);
        return;
      }

      const roleId = "1470272824500555980";
      const formatted = maxReward.toLocaleString();

      const sent = await message.channel.send({
         content: `<@&${roleId}> Be honest… you NEED those **${formatted}** coins. Type **CATCH**.`,
        allowedMentions: { parse: ["roles"] },
      });

      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 30000);

      logger.info(`✅ Coin Rain triggered: ${formatted}`);

    } catch (err) {
      logger.error("CoinRain error:", err);
    }
  }
}

module.exports = CoinRainFeature;