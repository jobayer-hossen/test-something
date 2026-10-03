const Logger = require("../logger");
const logger = new Logger("FishGodCookingFeature");

class FishGodCookingFeature {
  constructor(client) {
    this.client = client;
    this.roleId = "1555608837212471436";
    this.botId = "555955826880413696";
    this.pingMessage = `<@&${this.roleId}> CAUGHT THE FISH GOD! 🐟 Type **COOK**!`;
    this.allowedMentions = { parse: ["roles"] };

    // Pre-compile regex - matches the event trigger
    this.fishGodRegex = /CAUGHT\s+THE\s+FISH\s+GOD/i;

    // Pre-cache channel send options object
    this._sendOptions = {
      content: this.pingMessage,
      allowedMentions: this.allowedMentions,
    };
  }

  // ⚡ Inline fast embed check
  _isFishGodEmbed(embed) {
    // Check title first (most common case)
    if (embed.title && this.fishGodRegex.test(embed.title)) return true;

    // Check description as fallback
    if (embed.description && this.fishGodRegex.test(embed.description))
      return true;

    // Check fields last (least common)
    if (embed.fields?.length) {
      for (let i = 0; i < embed.fields.length; i++) {
        if (this.fishGodRegex.test(embed.fields[i].name)) return true;
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
    if (!this._isFishGodEmbed(message.embeds[0])) return;

    // 🚀 Fire ping immediately - no extra processing
    message.channel
      .send(this._sendOptions)
      .then((sent) => {
        setTimeout(() => sent.delete().catch(() => {}), 40000);
      })
      .catch((err) => logger.error("Fish God send error:", err));
  }
}

module.exports = FishGodCookingFeature;