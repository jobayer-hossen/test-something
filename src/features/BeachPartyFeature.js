const Logger = require("../logger");
const logger = new Logger("BeachPartyFeature");

class BeachPartyFeature {
  constructor(client) {
    this.client = client;
    this.roleId = "1530289241676845157";
    // More specific regex - only match when "is starting a BEACH PARTY"
    this.beachPartyRegex = /is\s+starting\s+a\s+BEACH\s+PARTY/i;
  }

  async handleMessage(message) {
    try {
      // Early returns (fastest checks first)
      if (!message.inGuild()) return;
      if (message.author.id !== "555955826880413696") return;
      if (!message.embeds?.length) return;

      const embed = message.embeds[0];
      let found = false;

      // ⚡ Check title with pre-compiled regex
      if (embed.title && this.beachPartyRegex.test(embed.title)) {
        found = true;
      }

      // ⚡ Check description if not found in title
      if (!found && embed.description && this.beachPartyRegex.test(embed.description)) {
        found = true;
      }

      // ⚡ Check fields if not found in title/description
      if (!found && embed.fields?.length) {
        found = embed.fields.some((field) =>
          (field.name && this.beachPartyRegex.test(field.name)) ||
          (field.value && this.beachPartyRegex.test(field.value))
        );
      }

      if (!found) return;

      // 🚀 Send without awaiting the delete (fire and forget)
      const sent = await message.channel.send({
        content: `<@&${this.roleId}> A BEACH PARTY is starting! Say **join** to enter!`,
        allowedMentions: { parse: ["roles"] },
      });

      // Don't wait for deletion - do it in background
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, 40000);

    } catch (err) {
      logger.error("Beach party error:", err);
    }
  }
}

module.exports = BeachPartyFeature;