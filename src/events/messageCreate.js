const Logger = require("../logger");
const userService = require("../database/services/userService");
const PersonalChannel = require("../database/schemas/PersonalChannel");
const moderationCommand = require("../commands/moderation");
const config = require("../config");

const logger = new Logger("MessageCreate");

const CHANNEL_COMMANDS = ["lock", "unlock", "hide", "unhide", "slow"];

/**
 * Main message create event handler
 * Handles commands, activity tracking, and feature triggers
 */
module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      // ════════════════════════════════════════
      // SAFETY CHECKS
      // ════════════════════════════════════════
      if (!message.guild) return;
      if (!client.user) return;
      if (message.author.id === client.user.id) return;

      // ════════════════════════════════════════
      // ENCHANTMENT WATCHER — BOT MESSAGES
      // Must be BEFORE the !message.author.bot check
      // ════════════════════════════════════════
      if (message.author.bot && client.features?.enchantmentWatcher) {
        try {
          await client.features.enchantmentWatcher.handleBotMessage(message);
        } catch (err) {
          logger.warn(
            `⚠️ Enchantment watcher bot message error: ${err.message}`,
          );
        }
      }

      // ════════════════════════════════════════
      // TRACK USER ACTIVITY (NOT BOTS)
      // ════════════════════════════════════════
      if (!message.author.bot && !message.webhookId) {
        await handleUserActivity(message, client, logger);
      }

      // ════════════════════════════════════════
      // SUMMONER TOOTHBRUSH TRACKING (BOT ONLY)
      // ════════════════════════════════════════
      if (
        message.author.id === config.EPIC_RPG_BOT_ID &&
        client.features?.summonerManager
      ) {
        await handleToothbrushTracking(message, client, logger);
      }

      // ════════════════════════════════════════
      // NO-PREFIX CHANNEL CONTROL COMMANDS
      // ════════════════════════════════════════
      if (!message.author.bot) {
        const handled = await handleChannelCommands(message, client, logger);
        if (handled) return;
      }

      // ════════════════════════════════════════
      // PREFIX COMMANDS (eb ...)
      // ════════════════════════════════════════
      const prefix = "eb";
      const lowerContent = message.content.toLowerCase();

      if (lowerContent.startsWith(prefix + " ")) {
        const handled = await handlePrefixCommands(
          message,
          client,
          prefix,
          logger,
        );
        if (handled) return;
      }

      // ════════════════════════════════════════
      // MESSAGE TRIGGERS & FEATURES
      // ════════════════════════════════════════
      await handleFeatureTriggers(message, client, logger);
    } catch (error) {
      logger.error(`💥 Critical error in messageCreate: ${error.message}`);
      logger.debug(error.stack);
    }
  },
};

/**
 * Handle user activity tracking
 */
async function handleUserActivity(message, client, logger) {
  try {
    // Create/update user in database
    await userService.getOrCreateUser(
      message.author.id,
      message.author.username,
      false,
    );

    // Add XP
    await userService.addXP(message.author.id, 1);

    // Update personal channel activity
    await PersonalChannel.findOneAndUpdate(
      { channelId: message.channel.id },
      { lastActivity: new Date() },
    ).catch(() => null);

    // Track activity
    if (client.features?.activityTracker) {
      await client.features.activityTracker.trackActivity(message);
    }

    // Enchantment watcher user commands
    if (client.features?.enchantmentWatcher) {
      await client.features.enchantmentWatcher.handleUserMessage(message);
    }
  } catch (error) {
    logger.debug(`⚠️ Error tracking user activity: ${error.message}`);
  }
}

/**
 * Handle summoner toothbrush tracking from Epic RPG bot
 */
async function handleToothbrushTracking(message, client, logger) {
  try {
    const content = message.content.trim();

    // Check for legendary toothbrush message
    if (
      content.includes("casts a magic spell") &&
      content.includes("legendary toothbrush")
    ) {
      const nameMatch = content.match(/^\*?\*?(.+?)\*?\*?\s+casts/i);

      if (nameMatch) {
        const epicRPGName = nameMatch[1].replace(/\*/g, "").trim();

        const CommandTracker = require("../database/schemas/CommandTracker");
        const userRecord = await CommandTracker.findOne({
          username: epicRPGName,
        }).lean();

        if (userRecord && client.features.summonerManager?.trackToothbrush) {
          await client.features.summonerManager.trackToothbrush(
            userRecord.userId,
          );
        }
      }
    }
  } catch (error) {
    logger.debug(`⚠️ Error tracking toothbrush: ${error.message}`);
  }
}

/**
 * Handle no-prefix channel control commands
 * Returns true if command was handled
 */
async function handleChannelCommands(message, client, logger) {
  try {
    const trimmed = message.content.trim();
    const words = trimmed.split(/\s+/);
    const firstWord = words[0].toLowerCase();

    // Check if this is a channel command
    if (!CHANNEL_COMMANDS.includes(firstWord)) {
      return false;
    }

    // Validate command format
    let isValid = false;

    if (words.length === 1) {
      isValid = true;
    } else if (words.length === 2 && words[1].match(/^<#\d+>$/)) {
      isValid = true;
    } else if (firstWord === "slow" && words.length === 2) {
      isValid = true;
    }

    if (!isValid) {
      return false;
    }

    // Execute channel command
    const channelCommand = client.commands.get("lock");
    if (!channelCommand) {
      logger.warn("⚠️ Lock command not found");
      return false;
    }

    try {
      const args = words.slice(1);
      await channelCommand.execute(message, args, client, firstWord);
      return true;
    } catch (error) {
      logger.error(
        `❌ Error executing channel command ${firstWord}: ${error.message}`,
      );
      return true; // Command was handled (error is logged)
    }
  } catch (error) {
    logger.debug(`⚠️ Error in channel commands: ${error.message}`);
    return false;
  }
}

/**
 * Handle prefix commands (eb command ...)
 * Returns true if command was handled
 */
async function handlePrefixCommands(message, client, prefix, logger) {
  try {
    const args = message.content
      .slice(prefix.length + 1)
      .trim()
      .split(/ +/);

    const commandName = args.shift()?.toLowerCase();

    if (!commandName) {
      return false;
    }

    // Try moderation commands first
    if (moderationCommand?.commands?.includes(commandName)) {
      try {
        await moderationCommand.execute(message, args, client, commandName);
        return true;
      } catch (error) {
        logger.error(
          `❌ Moderation command error [${commandName}]: ${error.message}`,
        );
        await message.channel
          .send("❌ An error occurred while executing this command!")
          .catch(() => {});
        return true;
      }
    }

    // Map channel commands to 'lock' handler
    const resolvedName = CHANNEL_COMMANDS.includes(commandName)
      ? "lock"
      : commandName;

    const command = client.commands.get(resolvedName);

    if (!command) {
      return false; // Command not found
    }

    try {
      await command.execute(message, args, client, commandName);
      return true;
    } catch (error) {
      logger.error(
        `❌ Command execution error [${commandName}]: ${error.message}`,
      );
      await message.channel
        .send("❌ An error occurred while executing this command!")
        .catch(() => {});
      return true;
    }
  } catch (error) {
    logger.debug(`⚠️ Error in prefix commands: ${error.message}`);
    return false;
  }
}

/**
 * Handle feature triggers (mentions, triggers, etc)
 */
async function handleFeatureTriggers(message, client, logger) {
  try {
    // ════════════════════════════════════════
    // OWNER MENTION STICKER RESPONSE
    // ════════════════════════════════════════
    const ownerID = "782630678389981244";
    const EXCLUDED_CATEGORY_ID = "1502453767847809195"; // staff-chat category

    const isDirectMention =
      message.mentions.users.has(ownerID) &&
      message.reference === null &&
      !message.author.bot;

    const containsIdLiteral =
      message.content.includes(`<@${ownerID}>`) ||
      message.content.includes(`<@!${ownerID}>`);

    // Get category ID (handles threads too, in case channel is a thread)
    const categoryId =
      message.channel.parentId && message.channel.isThread?.()
        ? message.channel.parent?.parentId
        : message.channel.parentId;

    const isInExcludedCategory = categoryId === EXCLUDED_CATEGORY_ID;

    if (isDirectMention && containsIdLiteral && !isInExcludedCategory) {
      const stickers = [
        "https://cdn.discordapp.com/emojis/1472947968821694466.webp?size=96",
        "https://cdn.discordapp.com/emojis/1472948142591971462.webp?size=96",
        "https://cdn.discordapp.com/emojis/1472947830669967392.webp?size=96",
        "https://cdn.discordapp.com/emojis/1466641318913507451.webp?size=48",
        "https://cdn.discordapp.com/emojis/1500347936691851274.webp?size=48",
        "https://cdn.discordapp.com/emojis/1357479670584574093.webp?size=96",
        "https://cdn.discordapp.com/emojis/1472946773608759457.webp?size=96",
        "https://cdn.discordapp.com/emojis/1473035254435680450.webp?size=96",
        "https://cdn.discordapp.com/emojis/1484112777558622210.webp?size=48",
        "https://cdn.discordapp.com/emojis/1472946717220540600.webp?size=96",
        "https://cdn.discordapp.com/emojis/1469534191136936107.webp?size=96",
        "https://media.discordapp.net/stickers/1476422766755315855.webp?size=160&quality=lossless",
      ];

      const randomSticker =
        stickers[Math.floor(Math.random() * stickers.length)];

      try {
        await message.channel.send({
          content: randomSticker,
          allowedMentions: { repliedUser: false },
        });
      } catch (err) {
        logger.debug(`⚠️ Failed to send sticker: ${err.message}`);
      }
    }

    // ════════════════════════════════════════
    // FEATURE TRIGGERS
    // ════════════════════════════════════════

    // Aman Trumpet Reminder
    if (client.features?.amanTrumpetReminder?.trackUsage) {
      try {
        await client.features.amanTrumpetReminder.trackUsage(
          message.author.id,
          message,
        );
      } catch (err) {
        logger.debug(`⚠️ Aman trumpet error: ${err.message}`);
      }
    }

    // Coin Rain
    if (client.features?.coinRain?.handleMessage) {
      try {
        client.features.coinRain.handleMessage(message);
      } catch (err) {
        logger.debug(`⚠️ Coin rain error: ${err.message}`);
      }
    }

    // Loot Box Summoning
    if (client.features?.LootBoxSummoningFeature?.handleMessage) {
      try {
        client.features.LootBoxSummoningFeature.handleMessage(message);
      } catch (err) {
        logger.debug(`⚠️ Loot box summoning error: ${err.message}`);
      }
    }

    // Command Tracker
    if (client.features?.commandTracker?.handleMessage) {
      try {
        await client.features.commandTracker.handleMessage(message);
      } catch (err) {
        logger.debug(`⚠️ Command tracker error: ${err.message}`);
      }
    }

    // Beach Party
    if (client.features?.beachPartyFeature?.handleMessage) {
      try {
        await client.features.beachPartyFeature.handleMessage(message);
      } catch (err) {
        logger.debug(`⚠️ Beach party error: ${err.message}`);
      }
    }

    // Fish God Cooking
    if (client.features?.fishGodCookingFeature?.handleMessage) {
      try {
        client.features.fishGodCookingFeature.handleMessage(message);
      } catch (err) {
        logger.debug(`⚠️ Fish god cooking error: ${err.message}`);
      }
    }

    // Renewal Reminder
    if (client.features?.renewalReminder) {
      try {
        if (!client.features.renewalReminder.checkInterval) {
          client.features.renewalReminder.initialize();
        }
      } catch (err) {
        logger.debug(`Renewal reminder error: ${err.message}`);
      }
    }
  } catch (error) {
    logger.error(`❌ Error processing message triggers: ${error.message}`);
  }
}
