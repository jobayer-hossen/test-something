const Logger = require("../logger");
const logger = new Logger("CoinRain");

class CoinRainFeature {
  constructor(client) {
    this.client = client;
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;

      // ✅ Handle CATCH responses (from any user)
      if (
        !message.author.bot &&
        message.content.trim().toUpperCase() === "CATCH"
      ) {
        // Check if there's an active coin rain in this channel
        if (
          this.activeRains &&
          this.activeRains.has(message.channel.id)
        ) {
          await message.channel.send(
            "# Please convert your coins to gold bars!"
          );
          return;
        }
      }

      if (message.author.id !== "555955826880413696") return;
      if (!message.embeds?.length) return;

      const embed = message.embeds[0];
      if (!embed.fields?.length) return;

      // ✅ Detect from field name (not title!)
      const rainField = embed.fields.find((field) => {
        if (!field.name) return false;

        const normalized = field.name
          .toUpperCase()
          .replace(/[^A-Z ]/g, "")
          .trim();

        return normalized.includes("ITS RAINING COINS");
      });

      if (!rainField) return;

      // ✅ Extract numbers from entire embed
      let text = "";

      if (embed.title) text += embed.title + " ";
      if (embed.description) text += embed.description + " ";

      for (const field of embed.fields) {
        text += field.name + " " + field.value + " ";
      }

      const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (!numbers) return;

      const maxReward = parseInt(
        numbers[numbers.length - 1].replace(/,/g, ""),
        10
      );
      if (!maxReward || maxReward < 1_000_000_000_000) return;

      const roleId = "1470272824500555980";
      const formatted = maxReward.toLocaleString();

      // ✅ Send role mention message (deletes after 60s)
      const sent = await message.channel.send({
        content: `<@&${roleId}> You want those **${formatted}** coins. Type **CATCH** !`,
        allowedMentions: { parse: ["roles"] },
      });

      // ✅ Send permanent convert reminder message
      await message.channel.send(
        "# Please convert your coins to gold bars!"
      );

      // ✅ Track active rain in this channel
      if (!this.activeRains) this.activeRains = new Map();
      this.activeRains.set(message.channel.id, true);

      setTimeout(() => {
        // Delete the role mention message
        sent.delete().catch(() => {});

        // Remove channel from active rains tracking
        if (this.activeRains) {
          this.activeRains.delete(message.channel.id);
        }
      }, 60000);

    } catch (err) {
      logger.error("CoinRain error:", err);
    }
  }
}

module.exports = CoinRainFeature;
