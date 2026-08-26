const Logger = require("../logger");
const logger = new Logger("LootBoxSummoningFeature");

class LootBoxSummoningFeature {
  constructor(client) {
    this.client = client;
    this.roleId = "1470272874161111061";
    this.botId = "555955826880413696";
    this.pingMessage = `<@&${this.roleId}> If you want EDGY! then type **SUMMON**!`;
    this.allowedMentions = { parse: ["roles"] };

    // Pre-compile regex
    this.lootboxRegex = /LOOTBOX\s+SUMMONING\s+HAS\s+STARTED/i;

    // Pre-cache channel send options object (avoid recreating every time)
    this._sendOptions = {
      content: this.pingMessage,
      allowedMentions: this.allowedMentions,
    };
  }

  // ⚡ Inline fast embed check (no function call overhead)
  _isLootboxEmbed(embed) {
    // Check title first (most common case)
    if (embed.title && this.lootboxRegex.test(embed.title)) return true;

    // Check description as fallback
    if (embed.description && this.lootboxRegex.test(embed.description)) return true;

    // Check fields last (least common)
    if (embed.fields?.length) {
      for (let i = 0; i < embed.fields.length; i++) {
        if (this.lootboxRegex.test(embed.fields[i].name)) return true;
      }
    }

    return false;
  }

  async handleMessage(message) {
    // ⚡ FASTEST checks first - primitive comparisons before anything else
    if (message.author.id !== this.botId) return;
    if (!message.embeds?.length) return;
    if (!message.inGuild()) return;

    // ⚡ Check embed match
    if (!this._isLootboxEmbed(message.embeds[0])) return;

    // 🚀 Fire ping immediately - no extra processing
    message.channel
      .send(this._sendOptions)
      .then((sent) => {
        setTimeout(() => sent.delete().catch(() => {}), 40000);
      })
      .catch((err) => logger.error("Lootbox send error:", err));
  }
}

module.exports = LootBoxSummoningFeature;