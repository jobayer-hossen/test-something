const {
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("ChannelCommand");

// ════════════════════════════════════════════
//         CONFIGURATION
//   ✅ Easy to add more channels & roles
// ════════════════════════════════════════════
const ALLOWED_CONTROLS = [
  {
    // Control channel 1
    channelId: "1529464827171573850",
    roleIds: [
      "1524850447050084452", // Role 1
      // "1234567890123456789", // Role 2 ← add more roles here
    ],
  },
  {
    // Control channel 1
    channelId: "1538104045091430412",
    roleIds: [
      "1524850447050084452", // Role 1
      // "1234567890123456789", // Role 2 ← add more roles here
    ],
  },
  // ✅ Add more control channels below:
  // {
  //   channelId : "1234567890123456789",  // Another control channel
  //   roleIds   : [
  //     "1234567890123456789",             // Roles that can use it
  //   ],
  // },
];

// ════════════════════════════════════════════
//         EMBED COLORS
// ════════════════════════════════════════════
const COLORS = {
  lock: 0xe74c3c, // Red
  unlock: 0x2ecc71, // Green
  hide: 0x95a5a6, // Grey
  unhide: 0x3498db, // Blue
  slow: 0xf39c12, // Orange
  error: 0xff0000, // Red
};

module.exports = {
  name: "lock",
  aliases: ["unlock", "hide", "unhide", "slow"],
  description: "Channel control commands",

  async execute(message, args, client, commandName) {
    try {
      // ✅ Get command from 4th param or message content
      const command = (
        commandName || message.content.trim().split(/\s+/)[0]
      ).toLowerCase();

      // ════════════════════════════════════════
      //         PERMISSION CHECK
      // ════════════════════════════════════════
      const isAdmin = message.member.permissions.has(
        PermissionFlagsBits.Administrator,
      );

      // ✅ Check if user has ANY allowed role in ANY allowed channel
      const isAllowedRole = ALLOWED_CONTROLS.some(
        (control) =>
          message.channelId === control.channelId &&
          control.roleIds.some((roleId) =>
            message.member.roles.cache.has(roleId),
          ),
      );

      // ✅ hide/unhide → admin only
      if (["hide", "unhide"].includes(command) && !isAdmin) {
        return message.reply({
          embeds: [
            errorEmbed("Only administrators can hide or unhide channels."),
          ],
          allowedMentions: { repliedUser: false },
        });
      }

      // ✅ Must be admin OR allowed role
      if (!isAdmin && !isAllowedRole) {
        return message.reply({
          embeds: [
            errorEmbed("You don't have permission to use this command."),
          ],
          allowedMentions: { repliedUser: false },
        });
      }

      // ════════════════════════════════════════
      //         RESOLVE TARGET CHANNEL
      // ════════════════════════════════════════
      let targetChannel = message.mentions.channels.first() || message.channel;

      if (targetChannel.type !== ChannelType.GuildText) {
        return message.reply({
          embeds: [errorEmbed("Target must be a text channel.")],
          allowedMentions: { repliedUser: false },
        });
      }

      // ════════════════════════════════════════
      //         EXECUTE COMMAND
      // ════════════════════════════════════════
      switch (command) {
        case "lock":
          await handleLock(message, targetChannel);
          break;
        case "unlock":
          await handleUnlock(message, targetChannel);
          break;
        case "hide":
          await handleHide(message, targetChannel);
          break;
        case "unhide":
          await handleUnhide(message, targetChannel);
          break;
        case "slow":
          await handleSlowmode(message, targetChannel, args);
          break;
      }
    } catch (err) {
      logger.error("Channel command error:", err);
      await message.reply({
        embeds: [errorEmbed("Something went wrong. Check bot permissions.")],
        allowedMentions: { repliedUser: false },
      });
    }
  },
};

// ════════════════════════════════════════════
//           EMBED BUILDERS
// ════════════════════════════════════════════
function buildEmbed(color, description, footer = null) {
  const embed = new EmbedBuilder().setColor(color).setDescription(description);

  if (footer) embed.setFooter({ text: footer });

  return embed;
}

function errorEmbed(text) {
  return buildEmbed(COLORS.error, `❌ ${text}`);
}

// ════════════════════════════════════════════
//              LOCK CHANNEL
// ════════════════════════════════════════════
async function handleLock(message, channel) {
  try {
    const everyonePerms = channel.permissionOverwrites.cache.get(
      message.guild.id,
    );
    const alreadyLocked = everyonePerms?.deny.has(
      PermissionFlagsBits.SendMessages,
    );

    if (alreadyLocked) {
      return message.reply({
        embeds: [buildEmbed(COLORS.lock, `🔒 ${channel} is already locked.`)],
        allowedMentions: { repliedUser: false },
      });
    }

    await channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: false,
    });

    // ✅ Reply with embed
    await message.reply({
      embeds: [
        buildEmbed(
          COLORS.lock,
          `🔒 **Channel Locked**\n\n${channel} has been locked.`,
        ),
      ],
      allowedMentions: { repliedUser: false },
    });

    // ✅ Notice in locked channel if different
    if (channel.id !== message.channelId) {
      await channel
        .send({
          embeds: [
            buildEmbed(COLORS.lock, `🔒 **This channel has been locked.**`),
          ],
        })
        .catch(() => {});
    }
  } catch (err) {
    await message.reply({
      embeds: [
        errorEmbed(
          err.code === 50013
            ? "Missing permissions to lock that channel."
            : "Failed to lock channel.",
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}

// ════════════════════════════════════════════
//             UNLOCK CHANNEL
// ════════════════════════════════════════════
async function handleUnlock(message, channel) {
  try {
    const everyonePerms = channel.permissionOverwrites.cache.get(
      message.guild.id,
    );
    const isLocked = everyonePerms?.deny.has(PermissionFlagsBits.SendMessages);

    if (!isLocked) {
      return message.reply({
        embeds: [
          buildEmbed(COLORS.unlock, `🔓 ${channel} is already unlocked.`),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    await channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: null,
    });

    await message.reply({
      embeds: [
        buildEmbed(
          COLORS.unlock,
          `🔓 **Channel Unlocked**\n\n${channel} has been unlocked.`,
        ),
      ],
      allowedMentions: { repliedUser: false },
    });

    if (channel.id !== message.channelId) {
      await channel
        .send({
          embeds: [
            buildEmbed(COLORS.unlock, `🔓 **This channel has been unlocked.**`),
          ],
        })
        .catch(() => {});
    }
  } catch (err) {
    await message.reply({
      embeds: [
        errorEmbed(
          err.code === 50013
            ? "Missing permissions to unlock that channel."
            : "Failed to unlock channel.",
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}

// ════════════════════════════════════════════
//              HIDE CHANNEL
// ════════════════════════════════════════════
async function handleHide(message, channel) {
  try {
    const everyonePerms = channel.permissionOverwrites.cache.get(
      message.guild.id,
    );
    const alreadyHidden = everyonePerms?.deny.has(
      PermissionFlagsBits.ViewChannel,
    );

    if (alreadyHidden) {
      return message.reply({
        embeds: [buildEmbed(COLORS.hide, `🙈 ${channel} is already hidden.`)],
        allowedMentions: { repliedUser: false },
      });
    }

    await channel.permissionOverwrites.edit(message.guild.id, {
      ViewChannel: false,
    });

    await message.reply({
      embeds: [
        buildEmbed(
          COLORS.hide,
          `🙈 **Channel Hidden**\n\n${channel} is now hidden from everyone.`,
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    await message.reply({
      embeds: [
        errorEmbed(
          err.code === 50013
            ? "Missing permissions to hide that channel."
            : "Failed to hide channel.",
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}

// ════════════════════════════════════════════
//             UNHIDE CHANNEL
// ════════════════════════════════════════════
async function handleUnhide(message, channel) {
  try {
    const everyonePerms = channel.permissionOverwrites.cache.get(
      message.guild.id,
    );
    const isHidden = everyonePerms?.deny.has(PermissionFlagsBits.ViewChannel);

    if (!isHidden) {
      return message.reply({
        embeds: [
          buildEmbed(COLORS.unhide, `👁️ ${channel} is already visible.`),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    await channel.permissionOverwrites.edit(message.guild.id, {
      ViewChannel: null,
    });

    await message.reply({
      embeds: [
        buildEmbed(
          COLORS.unhide,
          `👁️ **Channel Visible**\n\n${channel} is now visible to everyone.`,
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    await message.reply({
      embeds: [
        errorEmbed(
          err.code === 50013
            ? "Missing permissions to unhide that channel."
            : "Failed to unhide channel.",
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}

// ════════════════════════════════════════════
//             SLOWMODE CHANNEL
// ════════════════════════════════════════════
async function handleSlowmode(message, channel, args) {
  try {
    const secondsArg = args.find((a) => !a.startsWith("<#") && a !== "");

    // No arg → show current
    if (!secondsArg) {
      const current = channel.rateLimitPerUser;
      const display =
        current === 0 ? "**off**" : `**${formatSeconds(current)}**`;
      return message.reply({
        embeds: [
          buildEmbed(
            COLORS.slow,
            `🐢 **Slowmode Status**\n\n${channel} slowmode is currently ${display}.`,
          ),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    // ✅ "on" → default 3 seconds
    if (secondsArg === "on") {
      await channel.setRateLimitPerUser(3);
      return message.reply({
        embeds: [
          buildEmbed(
            COLORS.slow,
            `🐢 **Slowmode Enabled**\n\nSlowmode set to **3s** in ${channel}.`,
          ),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    // off / 0
    if (secondsArg === "off" || secondsArg === "0") {
      await channel.setRateLimitPerUser(0);
      return message.reply({
        embeds: [
          buildEmbed(
            COLORS.slow,
            `🐢 **Slowmode Disabled**\n\nSlowmode has been turned off in ${channel}.`,
          ),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    // Parse: 10 | 10s | 5m | 1h
    const timeMatch = secondsArg.match(/^(\d+)(s|m|h)?$/i);
    if (!timeMatch) {
      return message.reply({
        embeds: [
          buildEmbed(
            COLORS.error,
            [
              "❌ **Invalid Format**",
              "",
              "Examples:",
              "`slow on` — 3 seconds (default)",
              "`slow 10` — 10 seconds",
              "`slow 5m` — 5 minutes",
              "`slow 1h` — 1 hour",
              "`slow off` — disable",
            ].join("\n"),
          ),
        ],
        allowedMentions: { repliedUser: false },
      });
    }

    let seconds = parseInt(timeMatch[1]);
    const unit = (timeMatch[2] || "s").toLowerCase();
    if (unit === "m") seconds *= 60;
    if (unit === "h") seconds *= 3600;

    if (seconds > 21600) {
      return message.reply({
        embeds: [errorEmbed("Maximum slowmode is **6 hours**.")],
        allowedMentions: { repliedUser: false },
      });
    }

    await channel.setRateLimitPerUser(seconds);

    await message.reply({
      embeds: [
        buildEmbed(
          COLORS.slow,
          `🐢 **Slowmode Updated**\n\nSlowmode set to **${formatSeconds(seconds)}** in ${channel}.`,
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    await message.reply({
      embeds: [
        errorEmbed(
          err.code === 50013
            ? "Missing permissions to set slowmode."
            : "Failed to set slowmode.",
        ),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}

// ════════════════════════════════════════════
//           FORMAT SECONDS HELPER
// ════════════════════════════════════════════
function formatSeconds(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${seconds % 60 > 0 ? `${seconds % 60}s` : ""}`.trim();
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60) > 0 ? `${Math.floor((seconds % 3600) / 60)}m` : ""}`.trim();
}
