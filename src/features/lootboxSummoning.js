const Logger = require("../logger");
const logger = new Logger("LootboxSummoning");

class LootboxSummoningFeature {
  constructor(client) {
    this.client = client;
    this.roleId = "1470272874161111061";
    // Pre-compile regex for faster matching
    this.lootboxRegex = /LOOTBOX\s+SUMMONING\s+HAS\s+STARTED/i;
  }

  async handleMessage(message) {
    try {
      // Early returns (fastest checks first)
      if (!message.inGuild()) return;
      if (message.author.id !== "555955826880413696") return;
      if (!message.embeds?.length) return;

      const embed = message.embeds[0];
      let found = false;

      // ⚡ Check title with pre-compiled regex (faster)
      if (embed.title && this.lootboxRegex.test(embed.title)) {
        found = true;
      }

      // ⚡ Check fields if not found in title
      if (!found && embed.fields?.length) {
        found = embed.fields.some((field) =>
          field.name && this.lootboxRegex.test(field.name)
        );
      }

      if (!found) return;

      // 🚀 Send without awaiting the delete (fire and forget)
      const sent = await message.channel.send({
        content: `<@&${this.roleId}> If you want EDGY! then type **SUMMON**!`,
        allowedMentions: { parse: ["roles"] },
      });

      // Don't wait for deletion - do it in background
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 60000);

      // console.log("✅ Lootbox triggered");
    } catch (err) {
      logger.error("Lootbox error:", err);
    }
  }
}

module.exports = LootboxSummoningFeature;