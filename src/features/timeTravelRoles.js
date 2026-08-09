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

// ════════════════════════════════════════════
//           SINGLE EMBED COLOR
// ════════════════════════════════════════════
const EMBED_COLOR = 0x2b2d31; // Discord dark

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
      if (message.channelId !== PROFILE_CHANNEL_ID) return;
      if (message.author.id !== EPIC_RPG_BOT_ID) return;
      if (!message.embeds?.length) return;

      const embed = message.embeds[0];
      const authorName = embed.author?.name || "";

      if (!authorName.toLowerCase().includes("profile")) return;

      const timeTravels = this.extractTimeTravels(embed);
      if (timeTravels === null) return;

      const member = await this.findProfileUser(message, authorName);
      if (!member) return;

      const result = await this.assignTimeTravelRole(
        member,
        timeTravels,
        message.guild,
      );

      await this.sendReply(message, member, timeTravels, result);
    } catch (err) {
      logger.error("handleMessage error:", err);
    }
  }

  // ════════════════════════════════════════════
  //         EXTRACT TIME TRAVELS
  // ════════════════════════════════════════════
  extractTimeTravels(embed) {
    try {
      // Primary: PROGRESS field
      for (const field of embed.fields || []) {
        if (field.name !== "PROGRESS") continue;

        // ✅ FIX: Match numbers with commas like 17,640,220
        const match = field.value.match(/\*\*Time travels\*\*\s*:\s*([\d,]+)/i);
        if (match) {
          // Remove commas before parsing → "17,640,220" → 17640220
          return parseInt(match[1].replace(/,/g, ""));
        }
      }

      // Fallback: search all text
      const allText = [
        embed.description || "",
        ...(embed.fields || []).map((f) => `${f.name}\n${f.value}`),
      ].join("\n");

      // ✅ FIX: Also handle commas in fallback
      const match = allText.match(
        /time\s*travels?\*\*?\s*[:\-]\s*\*?\*?([\d,]+)/i,
      );
      return match ? parseInt(match[1].replace(/,/g, "")) : null;
    } catch (err) {
      logger.error("extractTimeTravels error:", err);
      return null;
    }
  }

  // ════════════════════════════════════════════
  //           FIND PROFILE USER
  // ════════════════════════════════════════════
  async findProfileUser(epicRpgMessage, authorName) {
    try {
      // Method 1: Find recent rpg p command
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

      // Method 2: Match by author name
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
      const targetTier = TT_ROLES.find(
        (t) => timeTravels >= t.min && timeTravels <= t.max,
      );
      const allTtRoleIds = TT_ROLES.map((t) => t.roleId);
      const currentRoles = member.roles.cache.filter((r) =>
        allTtRoleIds.includes(r.id),
      );

      result.targetTier = targetTier || null;

      // TT = 0 → remove all
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

      // Remove wrong TT roles
      const toRemove = currentRoles
        .filter((r) => r.id !== targetTier.roleId)
        .map((r) => r.id);

      if (toRemove.length > 0) {
        await member.roles.remove(toRemove, `TT updated: ${timeTravels}`);
      }

      // Already has correct role
      if (member.roles.cache.has(targetTier.roleId)) {
        result.action = "already_has";
        result.success = true;
        return result;
      }

      // Add correct role
      if (!guild.roles.cache.has(targetTier.roleId)) {
        result.action = "error";
        result.error = `Role \`${targetTier.roleId}\` not found in guild`;
        return result;
      }

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

      // ✅ Status text
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

      // ✅ Tier text
      const tierText = tier ? `${tier.emoji} ${tier.label}` : "—";

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
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
