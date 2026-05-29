const Logger = require("../logger");
const logger = new Logger("LootboxSummoning");

class LootboxSummoningFeature {
  constructor(client) {
    this.client = client;
  }

  async handleMessage(message) {
    try {
      if (!message.inGuild()) return;
      if (message.author.id !== "555955826880413696") return;
      if (!message.embeds?.length) return;

      const embed = message.embeds[0];

      let found = false;

      // ✅ Check title first
      if (embed.title) {
        const normalizedTitle = embed.title
          .toUpperCase()
          .replace(/[^A-Z ]/g, "")
          .trim();

        if (normalizedTitle.includes("LOOTBOX SUMMONING HAS STARTED")) {
          found = true;
        }
      }

      // ✅ If not found in title, check fields
      if (!found && embed.fields?.length) {
        found = embed.fields.some((field) => {
          if (!field.name) return false;

          const normalizedField = field.name
            .toUpperCase()
            .replace(/[^A-Z ]/g, "")
            .trim();

          return normalizedField.includes("LOOTBOX SUMMONING HAS STARTED");
        });
      }

      if (!found) return;

      const roleId = "1470272874161111061";

      const sent = await message.channel.send({
        content: `<@&${roleId}> If you want EDGY! then type **SUMMON**!`,
        allowedMentions: { parse: ["roles"] },
      });

      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 60000);

      console.log("✅ Lootbox triggered");
    } catch (err) {
      logger.error("Lootbox error:", err);
    }
  }
}

module.exports = LootboxSummoningFeature;
