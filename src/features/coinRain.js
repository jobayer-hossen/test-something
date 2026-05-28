const Logger = require("../logger");
const logger = new Logger("CoinRain");

class CoinRainFeature {
  constructor(client) {
    this.client = client;

    // Direct listener for speed
    this.client.on("messageCreate", (message) => {
      this.handleMessage(message);
    });
  }

  handleMessage(message) {
    try {
      // 🔥 Instant author filter
      if (message.author.id !== "555955826880413696") return;

      const embed = message.embeds?.[0];
      if (!embed) return;

      // 🔥 Only check embed title/description (fast)
      const text = `${embed.title || ""} ${embed.description || ""}`;

      if (!text.includes("IT'S RAINING COINS")) return;

      // 🔥 Extract LAST number only from this text
      const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (!numbers) return;

      const last = numbers[numbers.length - 1].replace(/,/g, "");
      const maxReward = parseInt(last, 10);
      if (!maxReward) return;

      // 🔥 1 Quadrillion check (1Q)
      if (maxReward < 1_000_000_000_000_000) return;

      this.triggerCoinRain(message, maxReward);

    } catch (err) {
      logger.error("Handle error:", err.message);
    }
  }

  triggerCoinRain(message, maxReward) {
    const roleId = "1470272824500555980";

    const formatted = maxReward.toLocaleString();

    // 🚀 Instant send (non-blocking)
    message.channel.send({
      content: `<@&${roleId}> Be honest… you NEED those **${formatted}** coins. Type **CATCH**.`,
      allowedMentions: { parse: ["roles"] },
    }).then((sent) => {

      // ⏳ Delete after 60s
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 60000);

    }).catch(() => {});
  }
}

module.exports = CoinRainFeature;