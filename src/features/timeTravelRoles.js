// features/timeTravelRoles.js

const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("TimeTravelRoles");

// ════════════════════════════════════════════
//           ROLE CONFIGURATION
// ════════════════════════════════════════════
const TT_ROLES = [
  {
    min: 1,
    max: 24,
    roleId: "1470272987973550082",
    label: "TT 1–24",
    emoji: "🌱",
  },
  {
    min: 25,
    max: 99,
    roleId: "1470273032177188904",
    label: "TT 25–99",
    emoji: "⚡",
  },
  {
    min: 100,
    max: Infinity,
    roleId: "1532055888242671736",
    label: "TT 100+",
    emoji: "👑",
  },
];

const EPIC_RPG_BOT_ID = "555955826880413696";
const PROFILE_CHANNEL_ID = "1532062090490019990";
const EMBED_COLOR = 0x2b2d31;

// ════════════════════════════════════════════
//        MULTILINGUAL SUPPORT
// ════════════════════════════════════════════
const LANGUAGES = {
  // English
  EN: ["time travels", "time travel"],
  // Spanish
  ES: ["viajes en el tiempo", "viaje en el tiempo"],
  // Portuguese (Brazil)
  PT: ["viagens no tempo", "viagem no tempo"],
};

class TimeTravelRolesFeature {
  constructor(client) {
    this.client = client;
    this.initialize();
  }

  initialize() {
    this.client.on("messageCreate", (message) => {
      this.handleMessage(message).catch((err) => {
        logger.error("handleMessage error:", err);
      });
    });

    logger.info("✅ Time Travel Roles feature initialized");
  }

  // ════════════════════════════════════════════
  //              HANDLE MESSAGE
  // ════════════════════════════════════════════
  async handleMessage(message) {
    try {
      // Only process EPIC RPG bot messages in the profile channel
      if (message.channelId !== PROFILE_CHANNEL_ID) return;
      if (message.author.id !== EPIC_RPG_BOT_ID) return;

      // Check if message has EMBED
      if (message.embeds?.length) {
        await this.handleEmbedProfile(message);
        return;
      }

      // Check if message has IMAGE (custom background)
      if (message.attachments.size > 0) {
        const hasImage = message.attachments.some((a) =>
          /\.(png|jpe?g|webp|gif)$/i.test(a.name),
        );

        if (hasImage) {
          await this.replyUseDefaultBg(message);
          return;
        }
      }
    } catch (err) {
      logger.error("handleMessage error:", err);
    }
  }

  // ════════════════════════════════════════════
  //         HANDLE EMBED PROFILE
  // ════════════════════════════════════════════
  async handleEmbedProfile(message) {
    try {
      const embed = message.embeds[0];
      const authorName = embed.author?.name || "";

      // Check if this is a profile embed
      if (!authorName.toLowerCase().includes("profile")) {
        return;
      }

      // Extract time travels from embed
      const timeTravels = this.extractTimeTravels(embed);
      if (timeTravels === null) {
        return;
      }

      // Find the member who ran the command
      const member = await this.findProfileUser(message, authorName);
      if (!member) {
        return;
      }

      // Assign the appropriate role
      const result = await this.assignTimeTravelRole(member, timeTravels, message.guild);

      // Send reply to user
      await this.sendReply(message, member, timeTravels, result);
    } catch (err) {
      logger.error("handleEmbedProfile error:", err);
    }
  }

  // ════════════════════════════════════════════
  //    REPLY: USE DEFAULT BACKGROUND
  // ════════════════════════════════════════════
  async replyUseDefaultBg(message) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B) // Red warning
        .setTitle("⚠️ Custom Background Detected")
        .setDescription([
          `Hello! I detected you're using a **custom profile background**.`,
          ``,
          `I can only read Time Travels data from the **default EPIC RPG background**.`,
          ``,
          `**📋 To fix this:**`,
          `1. Use \`rpg bg default\` to switch to the default background`,
          `2. Then run \`rpg p\` again`,
          `3. I'll automatically assign your **Time Travel role** ✅`,
          ``,
          `**Why?** Custom backgrounds make it difficult to extract accurate data.`,
        ].join("\n"));

      await message.reply({ embeds: [embed] });
    } catch (err) {
      logger.error("replyUseDefaultBg error:", err);
    }
  }

  // ════════════════════════════════════════════
  //         EXTRACT TIME TRAVELS (EMBED)
  // ════════════════════════════════════════════
  extractTimeTravels(embed) {
    try {
      // Look for PROGRESS field (primary source)
      for (const field of embed.fields || []) {
        if (field.name !== "PROGRESS") continue;

        // Try to match time travels in any supported language
        const match = this.extractTimeFromText(field.value);
        if (match !== null) {
          return match;
        }
      }

      // Fallback: search entire embed
      const allText = [
        embed.description || "",
        ...(embed.fields || []).map((f) => `${f.name}\n${f.value}`),
      ].join("\n");

      return this.extractTimeFromText(allText);
    } catch (err) {
      logger.error("extractTimeTravels error:", err);
      return null;
    }
  }

  // ════════════════════════════════════════════
  //    EXTRACT TIME TRAVELS FROM TEXT
  // ════════════════════════════════════════════
  extractTimeFromText(text) {
    try {
      // Build regex pattern with all language variations
      const allTerms = [
        ...LANGUAGES.EN,
        ...LANGUAGES.ES,
        ...LANGUAGES.PT,
      ].join("|");

      // Pattern: "Time travels: 37" or "**Time travels**: 37" (multilingual)
      const pattern = new RegExp(
        `\\*\\*(${allTerms})\\*\\*\\s*[:=]\\s*([\\d,]+)`,
        "i",
      );

      const match = text.match(pattern);
      if (match) {
        return parseInt(match[2].replace(/,/g, ""));
      }

      // Fallback: search without bold markers
      const fallbackPattern = new RegExp(
        `(${allTerms})\\s*[:=]\\s*([\\d,]+)`,
        "i",
      );

      const fallbackMatch = text.match(fallbackPattern);
      if (fallbackMatch) {
        return parseInt(fallbackMatch[2].replace(/,/g, ""));
      }

      return null;
    } catch (err) {
      logger.error("extractTimeFromText error:", err);
      return null;
    }
  }

  // ════════════════════════════════════════════
  //           FIND PROFILE USER
  // ════════════════════════════════════════════
  async findProfileUser(epicRpgMessage, authorName) {
    try {
      // Method 1: Find recent "rpg p" command
      const messages = await epicRpgMessage.channel.messages.fetch({
        limit: 15,
        before: epicRpgMessage.id,
      });

      const profileCommands = ["rpg p", "rpg profile", "rpg pr"];

      for (const [, msg] of messages) {
        if (msg.author.bot) continue;

        const content = msg.content.toLowerCase().trim();
        const isProfileCmd = profileCommands.some(
          (cmd) => content === cmd || content.startsWith(cmd + " "),
        );

        if (isProfileCmd) {
          const member = await epicRpgMessage.guild.members
            .fetch(msg.author.id)
            .catch(() => null);
          if (member) return member;
        }
      }

      // Method 2: Match by embed author name
      return await this.findUserByAuthorName(epicRpgMessage, authorName);
    } catch (err) {
      logger.error("findProfileUser error:", err);
      return null;
    }
  }

  // ════════════════════════════════════════════
  //       FIND USER BY EMBED AUTHOR NAME
  // ════════════════════════════════════════════
  async findUserByAuthorName(message, authorName) {
    try {
      // Extract name from "Username — profile"
      const nameMatch = authorName.match(/^(.+?)\s*[—–-]\s*profile/i);
      if (!nameMatch) return null;

      const target = nameMatch[1].trim().toLowerCase();

      await message.guild.members.fetch();

      return (
        message.guild.members.cache.find((m) => {
          const checks = [
            m.user.username.toLowerCase(),
            m.user.globalName?.toLowerCase() || "",
            m.displayName.toLowerCase(),
            m.nickname?.toLowerCase() || "",
          ];
          return checks.some(
            (c) => c === target || c.includes(target) || target.includes(c),
          );
        }) || null
      );
    } catch (err) {
      logger.error("findUserByAuthorName error:", err);
      return null;
    }
  }

  // ════════════════════════════════════════════
  //         ASSIGN TIME TRAVEL ROLE
  // ════════════════════════════════════════════
  async assignTimeTravelRole(member, timeTravels, guild) {
    const result = {
      success: false,
      action: null,
      targetTier: null,
      error: null,
    };

    try {
      // Find the tier that matches this TT count
      const targetTier = TT_ROLES.find(
        (t) => timeTravels >= t.min && timeTravels <= t.max,
      );
      const allTtRoleIds = TT_ROLES.map((t) => t.roleId);
      const currentRoles = member.roles.cache.filter((r) =>
        allTtRoleIds.includes(r.id),
      );

      result.targetTier = targetTier || null;

      // Case 1: TT = 0 → remove all TT roles
      if (!targetTier) {
        if (currentRoles.size > 0) {
          await member.roles.remove(
            currentRoles.map((r) => r.id),
            "TT count is 0",
          );
        }
        result.action = "removed_all";
        result.success = true;
        return result;
      }

      // Case 2: Remove incorrect TT roles
      const toRemove = currentRoles
        .filter((r) => r.id !== targetTier.roleId)
        .map((r) => r.id);

      if (toRemove.length > 0) {
        await member.roles.remove(toRemove, `TT updated: ${timeTravels}`);
      }

      // Case 3: Already has correct role
      if (member.roles.cache.has(targetTier.roleId)) {
        result.action = "already_has";
        result.success = true;
        return result;
      }

      // Case 4: Role doesn't exist in guild
      if (!guild.roles.cache.has(targetTier.roleId)) {
        result.action = "error";
        result.error = `Role not found in guild`;
        return result;
      }

      // Case 5: Add the correct role
      await member.roles.add(
        targetTier.roleId,
        `TT: ${timeTravels} → ${targetTier.label}`,
      );

      result.action = "added";
      result.success = true;
      return result;
    } catch (err) {
      result.action = "error";
      result.error =
        err.code === 50013
          ? "Missing permissions — move bot role above TT roles"
          : err.message;
      return result;
    }
  }

  // ════════════════════════════════════════════
  //              SEND REPLY
  // ════════════════════════════════════════════
  async sendReply(epicRpgMessage, member, timeTravels, result) {
    try {
      const tier = result.targetTier;

      let statusText = "";
      if (!result.success) {
        statusText = `❌ ${result.error}`;
      } else if (result.action === "added") {
        statusText = `✅ Assigned <@&${tier.roleId}>`;
      } else if (result.action === "already_has") {
        statusText = `☑️ Already has <@&${tier.roleId}>`;
      } else if (result.action === "removed_all") {
        statusText = `🗑️ No TT — roles removed`;
      }

      const tierText = tier ? `${tier.emoji} ${tier.label}` : "—";

      const embed = new EmbedBuilder()
        .setColor(result.success ? EMBED_COLOR : 0xFF6B6B)
        .setDescription(
          [
            `**${member.user.username}** — Time Travel Check`,
            ``,
            `🌀 **Time Travels** — \`${timeTravels}\``,
            `🎖️ **Tier** — ${tierText}`,
            `📋 **Status** — ${statusText}`,
          ].join("\n"),
        );

      await epicRpgMessage.reply({ embeds: [embed] });
    } catch (err) {
      logger.error("sendReply error:", err);
    }
  }
}

module.exports = TimeTravelRolesFeature;