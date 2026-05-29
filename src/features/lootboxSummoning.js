const Logger = require("../logger");
const logger = new Logger("LootboxSummoning");

class LootboxSummoningFeature {
  constructor(client) {
    this.client = client;
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (!message.author || message.author.id !== "555955826880413696") return;

      if (!message.embeds || message.embeds.length === 0) return;

      const embed = message.embeds[0];

      // ✅ Build searchable text safely
      let text = "";

      if (embed.title) text += embed.title + " ";
      if (embed.description) text += embed.description + " ";

      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          if (field.name) text += field.name + " ";
          if (field.value) text += field.value + " ";
        }
      }

      text = text.toUpperCase();

      // ✅ Flexible detection (future proof)
      if (!text.includes("LOOTBOX") || !text.includes("SUMMON")) return;

      const roleId = "1470272874161111061";

      const sent = await message.channel.send({
       content: `<@&${roleId}> If you want EDGY! then spam **SUMMON**!`,
        allowedMentions: { parse: ["roles"] },
      });

      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 60000);

      logger.info("✅ Lootbox triggered successfully");

    } catch (err) {
      logger.error("Lootbox error:", err);
    }
  }
}

module.exports = LootboxSummoningFeature;