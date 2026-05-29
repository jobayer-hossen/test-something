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
    if (!embed.title) return;

    const title = embed.title.toUpperCase().trim();

    // ✅ STRICT MATCH ONLY TITLE
    if (!title.includes("IT'S RAINING COINS")) return;

    // ✅ Extract numbers from FULL embed (reward might be in fields)
    let text = embed.title + " ";
    if (embed.description) text += embed.description + " ";

    if (embed.fields?.length) {
      for (const field of embed.fields) {
        text += field.name + " " + field.value + " ";
      }
    }

    const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
    if (!numbers || numbers.length === 0) return;

    const maxReward = parseInt(numbers[numbers.length - 1].replace(/,/g, ""), 10);
    if (!maxReward) return;

    if (maxReward < 1_000_000_000_000_000) return;

    const roleId = "1470272824500555980";
    const formatted = maxReward.toLocaleString();

    const sent = await message.channel.send({
      content: `<@&${roleId}> Be honest… you NEED those **${formatted}** coins. Type **CATCH** NOW!`,
      allowedMentions: { parse: ["roles"] },
    });

    setTimeout(() => {
      sent.delete().catch(() => {});
    }, 30000);

  } catch (err) {
    logger.error("CoinRain error:", err);
  }
}
}

module.exports = CoinRainFeature;