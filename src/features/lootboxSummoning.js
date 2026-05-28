const Logger = require("../logger");
const logger = new Logger("LootboxSummoning");

class LootboxSummoningFeature {
  constructor(client) {
    this.client = client;

    // Bind listener directly for maximum speed
    this.client.on("messageCreate", (message) => {
      this.handleMessage(message);
    });
  }

  async handleMessage(message) {
    try {
      // 🔥 Instant filter (fastest possible exit)
      if (message.author.id !== "555955826880413696") return;

      // 🔥 Must have embed
      const embed = message.embeds?.[0];
      if (!embed) return;

      // 🔥 Direct string check (NO LOOPS)
      if (
        embed.title?.includes("LOOTBOX SUMMONING HAS STARTED") ||
        embed.description?.includes("LOOTBOX SUMMONING HAS STARTED")
      ) {
        this.triggerSummoning(message);
      }

    } catch (err) {
      logger.error("Handle error:", err.message);
    }
  }

  triggerSummoning(message) {
    try {
      const roleId = "1470272874161111061";

      // 🚀 Instant send (no await = non-blocking)
      message.channel.send({
        content: `<@&${roleId}> If you want EDGY! then type **SUMMON**!`,
        allowedMentions: { parse: ["roles"] },
      }).then((sentMessage) => {

        // ⏳ Auto delete after 60 sec
        setTimeout(() => {
          sentMessage.delete().catch(() => {});
        }, 60000);

      }).catch(() => {});

    } catch (err) {
      logger.error("Trigger error:", err.message);
    }
  }
}

module.exports = LootboxSummoningFeature;