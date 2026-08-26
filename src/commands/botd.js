const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("BotDirectoryCommand");

// Page colors (different border color per option)
const COLORS = {
  overview: 0x5865f2,   // blurple
  falcon: 0xe74c3c,     // red
  arcane: 0x9b59b6,     // purple
  giveaway: 0x1abc9c,   // teal
  epic: 0xf1c40f,       // gold
  backup: 0x95a5a6,     // gray
  navi: 0x3498db,       // blue
  avaron: 0x2ecc71,     // green
  staff: 0xe67e22,      // orange
};

function buildEmbed(pageKey) {
  const embed = new EmbedBuilder()
    .setColor(COLORS[pageKey] ?? COLORS.overview)

  // Keep emojis minimal (only where helpful)
  switch (pageKey) {
    case "overview":
      return embed
        .setTitle("Bot Directory — Overview")
        .setDescription(
          [
            "Use the select menu below to view each bot’s role and rules.",
            "",
            "**Quick Map**",
            "• **Falcon™** — Invite Events",
            "• **Arcane** — Chat XP + Event Role",
            "• **Giveaway Boat** — Leveling + Color Roles",
            "• **EPIC BOT** — Moderation + Summon/Catch + Logs + Rooms/Supporters",
            "• **Carl / Dyno** — Backup moderation + Purge",
            "• **Navi Lite** — EPIC RPG event pings (Lure/Arena/Cut/...)",
            "• **AvaRon** — EPIC RPG detection pings (God’s Coins/Trading/Epic Coins)",
            "",
            "**Important**",
            "• **Arcane Level ≠ Giveaway Boat Level** (two different systems).",
            "• Moderation priority: **EPIC BOT first**, then **Dyno/Carl** if needed.",
          ].join("\n")
        );

    case "falcon":
      return embed
        .setTitle("🦅 Falcon™ — Invite Events")
        .setDescription("<@899899858981371935> is dedicated to the **Invite Event system**.")
        .addFields(
          {
            name: "Main Function",
            value: "Invite-based events and invite tracking for those events.",
          },
          {
            name: "Used For",
            value: "• Invite Events\n• Tracking invites related to events",
          },
          {
            name: "Notes",
            value:
              "Falcon is **not** used for our main moderation, leveling, or staff systems.",
          }
        );

    case "arcane":
      return embed
        .setTitle("⭐ Arcane — Chat XP + Event Role")
        .setDescription(
          "<@437808476106784770> manages **Chat XP** and assigns the **current Event Role**."
        )
        .addFields(
          {
            name: "Main Function",
            value:
              "Members earn XP through chat activity. This can be used for activity-based events.",
          },
          {
            name: "How Members Check Level",
            value: "Use **/level** or **!level** (Arcane).",
          },
          {
            name: "Current Event (example)",
            value:
              "• Event: **Summer Event**\n• Event Role: **Epic Summer**\n• Requirement: **Level 2** in Arcane",
          },
          {
            name: "Important",
            value:
              "The Event Role is **not permanent**. When a new event starts, the role changes to match the new event.",
          }
        );

    case "giveaway":
      return embed
        .setTitle("🎉 Giveaway Boat — Leveling + Color Roles")
        .setDescription(
          "<@530082442967646230> manages the server’s **general leveling** tied to **color role unlocks**."
        )
        .addFields(
          {
            name: "How Members Check Level",
            value: "Use **/level** or **g.level** (Giveaway Boat).",
          },
          {
            name: "Color Unlock System",
            value:
              "Every **10 levels**, members unlock the next color-role channel (Leveling category).\nExamples:\n• <#1475904270996865085>\n• <#1475904372796948637>\n• <#1475904524966428876>\n• ...\n• <#1475905713673994321>",
          },
          {
            name: "Where to Pick Colors",
            value:
              "Inside the unlocked level channels, members select from the available color roles.\nMore info: <#1470272458375565375>",
          },
          {
            name: "Important",
            value:
              "**Arcane Level ≠ Giveaway Boat Level**\nArcane = Chat XP / Event Role\nGiveaway Boat = Leveling / Color Roles",
          }
        );

    case "epic":
      return embed
        .setTitle("🤖 EPIC BOT — Core Systems")
        .setDescription(
          "<@1503730573116706866> is one of the **main bots** and manages several core server systems."
        )
        .addFields(
          {
            name: "🛡️ Moderation (Primary)",
            value:
              "Use EPIC BOT first for normal moderation:\n• `eb warn`\n• `eb timeout`\n• `eb kick`\n• `eb ban`",
          },
          {
            name: "🔔 Summon & Catch Pings",
            value:
              "Manages <@&1470272874161111061> and <@&1470272824500555980>.\nCatch ping only sends for events worth at least **1Q Coins**.",
          },
          {
            name: "📋 Logs",
            value:
              "Manages main logging:\n• <#1503339439777124382> (channel activity)\n• <#1537836420700442644> (staff activity)",
          },
          {
            name: "🏠 Personal Rooms",
            value:
              "Tracks inactive personal rooms and moves them to **Archive** to keep categories clean.",
          },
          {
            name: "💎 Supporter / Booster Rooms",
            value:
              "Keeps booster rooms in **Supporters** while they boost.\nIf boosting stops, EPIC BOT moves the room to the bottom of **Epic Citizen**.",
          },
          {
            name: "More Info",
            value: "Use: **`eb about`** (and check <#1513223652362031346> if you use it).",
          }
        );

    case "backup":
      return embed
        .setTitle("🔨 Carl Bot & Dyno — Backup Moderation + Purge")
        .setDescription(
          "<@235148962103951360> and <@161660517914509312> have moderation enabled, but they are **not** our primary moderation system."
        )
        .addFields(
          {
            name: "Moderation Priority",
            value:
              "1) **EPIC BOT** — standard moderation\n2) **Dyno / Carl** — backup or missing functions",
          },
          {
            name: "When to Use Dyno/Carl",
            value:
              "• EPIC BOT doesn’t have the command needed\n• You need **purge**\n• You need a specific admin-only function",
          },
          {
            name: "Message Cleanup (Purge)",
            value: "Examples:\n• `?purge`\n• `&purge`",
          }
        );

    case "navi":
      return embed
        .setTitle("🧭 Navi Lite — EPIC RPG Event Pings")
        .setDescription("<@1213487623688167494> is used for EPIC RPG-related ping roles.")
        .addFields({
          name: "It Manages These Pings",
          value:
            "• @LURE\n• @ARENA\n• @CUT\n• @TIME TO FIGHT\n• @FIGHT\n• @LETS GET THAT PICKAXE",
        });

    case "avaron":
      return embed
        .setTitle("🐉 AvaRon — EPIC RPG Detection & Pings")
        .setDescription(
          "<@1351289444572987507> monitors specific EPIC RPG events and sends the matching pings automatically."
        )
        .addFields({
          name: "Currently Manages",
          value: "• @GOD'S COINS\n• @TRADING\n• @EPIC COINS",
        });

    case "staff":
      return embed
        .setTitle("🛡️ Staff Rule — Which Bot to Use?")
        .setDescription("Follow this to keep moderation consistent and organized.")
        .addFields(
          {
            name: "Primary Moderation Bot",
            value:
              "<@1503730573116706866> is the primary moderation bot.\nUse:\n• `eb warn`\n• `eb timeout`\n• `eb kick`\n• `eb ban`",
          },
          {
            name: "Secondary / Backup",
            value:
              "<@235148962103951360> / <@161660517914509312> are secondary.\nUse them when EPIC BOT lacks a needed function, or for purge:\n• `?purge`\n• `&purge`",
          }
        );

    default:
      return buildEmbed("overview");
  }
}

function buildMenu(customId, selected = "overview") {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Select a page…")
    .addOptions(
      {
        label: "Overview",
        value: "overview",
        description: "All bots + quick rules",
        emoji: "📚",
        default: selected === "overview",
      },
      {
        label: "Falcon™ (Invite Events)",
        value: "falcon",
        description: "Invite event system",
        emoji: "🦅",
        default: selected === "falcon",
      },
      {
        label: "Arcane (Chat XP + Event Role)",
        value: "arcane",
        description: "Chat XP + current event role",
        emoji: "⭐",
        default: selected === "arcane",
      },
      {
        label: "Giveaway Boat (Leveling + Colors)",
        value: "giveaway",
        description: "Levels unlock color role channels",
        emoji: "🎉",
        default: selected === "giveaway",
      },
      {
        label: "EPIC BOT (Core Systems)",
        value: "epic",
        description: "Moderation, logs, pings, rooms",
        emoji: "🤖",
        default: selected === "epic",
      },
      {
        label: "Carl + Dyno (Backup + Purge)",
        value: "backup",
        description: "Backup moderation + purge commands",
        emoji: "🧰",
        default: selected === "backup",
      },
      {
        label: "Navi Lite (RPG Pings)",
        value: "navi",
        description: "Lure/Arena/Cut/Time to Fight...",
        emoji: "🧭",
        default: selected === "navi",
      },
      {
        label: "AvaRon (RPG Detection)",
        value: "avaron",
        description: "God's Coins/Trading/Epic Coins",
        emoji: "🐉",
        default: selected === "avaron",
      },
      {
        label: "Staff Rule (Moderation Priority)",
        value: "staff",
        description: "Which bot to use for staff actions",
        emoji: "🛡️",
        default: selected === "staff",
      }
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  name: "bot",
  description: "Bot Directory (select menu pages).",
  aliases: ["bots", "botd", "botdirectory"],

  // Adjust parameters to match your command handler
  async execute(message, args, client) {
    try {
      // Allow: eb bot | eb bot directory | eb bot d
      if (args?.length) {
        const a0 = String(args[0]).toLowerCase();
        if (!["directory", "d"].includes(a0)) {
          // still open directory; no noisy error
        }
      }

      const customId = `botdir:${message.id}:${message.author.id}`;

      const sent = await message.channel.send({
        embeds: [buildEmbed("overview")],
        components: [buildMenu(customId, "overview")],
        allowedMentions: { parse: [] },
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 10 * 60 * 1000, // 10 minutes
      });

      collector.on("collect", async (interaction) => {
        // Only allow the command user to control the menu
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            content: "Only the user who opened this menu can control it.",
            ephemeral: true,
          });
        }

        const value = interaction.values?.[0] ?? "overview";
        await interaction.update({
          embeds: [buildEmbed(value)],
          components: [buildMenu(customId, value)],
          allowedMentions: { parse: [] },
        });
      });

      collector.on("end", async () => {
        // Disable menu after timeout (keeps message clean)
        const disabledRow = buildMenu(customId, "overview");
        disabledRow.components[0].setDisabled(true);

        await sent.edit({
          components: [disabledRow],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      });
    } catch (err) {
      logger.error(err);
      // keep it quiet; optional minimal notice:
      // message.channel.send("Failed to open bot directory.");
    }
  },
};