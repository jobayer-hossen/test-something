// events/messageCreate.js
const Logger = require("../logger");
const userService = require("../database/services/userService");
const PersonalChannel = require("../database/schemas/PersonalChannel");
const moderationCommand = require("../commands/moderation");
const rateLimitQueue = require("../utils/RateLimitQueue");

const logger = new Logger("MessageCreate");

const CHANNEL_COMMANDS = ["lock", "unlock", "hide", "unhide", "slow"];

function isAdmin(member) {
    if (!member) return false;
    return (
        member.permissions.has("Administrator") ||
        member.user.id === process.env.OWNER_ID
    );
}

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        try {
            if (!message.guild) return;
            if (message.author.id === client.user.id) return;

            // Spam tracking
            const isSpam = rateLimitQueue.trackMessage(message.channel.id);

            // Init moderation once
            if (!client._modInitDone) {
                try {
                    moderationCommand.init(client);
                    client._modInitDone = true;
                } catch (err) {
                    logger.error("Failed to init moderation:", err.message);
                }
            }

            // Track user activity (skip during spam)
            if (!message.author.bot && !isSpam) {
                try {
                    await userService.getOrCreateUser(
                        message.author.id,
                        message.author.username,
                        message.author.bot
                    );
                    await userService.addXP(message.author.id, 1);
                    await PersonalChannel.findOneAndUpdate(
                        { channelId: message.channel.id },
                        { lastActivity: new Date() }
                    ).catch(() => null);
                } catch (err) {
                    logger.debug("User tracking error:", err.message);
                }
            }

            const prefix = "eb";
            const lowerContent = message.content.toLowerCase();

            // ── No-prefix channel commands (admin only) ──
            if (!message.author.bot) {
                const firstWord = message.content.trim().split(/\s+/)[0].toLowerCase();

                if (CHANNEL_COMMANDS.includes(firstWord)) {
                    if (!isAdmin(message.member)) return;

                    const args = message.content.trim().split(/\s+/).slice(1);
                    const cmd = client.commands.get("lock");
                    if (cmd) {
                        await cmd.execute(message, args, client, firstWord).catch((err) => {
                            logger.error(`[${firstWord}] failed:`, err.message);
                        });
                    }
                    return;
                }
            }

            // ── Prefix commands (eb ...) ──
            if (lowerContent.startsWith(prefix + " ")) {
                if (!isAdmin(message.member)) return;

                const args = message.content.slice(prefix.length + 1).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();

                // Moderation
                if (moderationCommand.commands.includes(commandName)) {
                    await moderationCommand.execute(message, args, client, commandName).catch((err) => {
                        logger.error(`[mod:${commandName}] failed:`, err.message);
                    });
                    return;
                }

                // Channel control via prefix
                const resolvedName = CHANNEL_COMMANDS.includes(commandName) ? "lock" : commandName;
                const command = client.commands.get(resolvedName);

                if (command) {
                    await command.execute(message, args, client, commandName).catch((err) => {
                        logger.error(`[${commandName}] failed:`, err.message);
                    });
                }
            }

            // ── Message triggers ──
            try {
                const ownerID = "782630678389981244";
                const isDirectMention =
                    message.mentions.users.has(ownerID) &&
                    !message.reference &&
                    !message.author.bot;

                if (isDirectMention && message.content.includes(`<@${ownerID}>`)) {
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
                    ];
                    await message.channel.send({
                        content: stickers[Math.floor(Math.random() * stickers.length)],
                        allowedMentions: { repliedUser: false }
                    }).catch(() => {});
                }

                if (!isSpam) {
                    if (client.features?.amanTrumpetReminder)
                        await client.features.amanTrumpetReminder.trackUsage(message.author.id, message);

                    if (client.features?.commandTracker)
                        await client.features.commandTracker.handleMessage(message);
                }

                if (client.features?.coinRain)
                    client.features.coinRain.handleMessage(message);

                if (client.features?.LootBoxSummoningFeature)
                    client.features.LootBoxSummoningFeature.handleMessage(message);

                if (client.features?.tournamentManager)
                    await client.features.tournamentManager.handleJoinWord(message);

                if (client.features?.beachPartyFeature)
                    await client.features.beachPartyFeature.handleMessage(message);

            } catch (err) {
                logger.error("Trigger error:", err.message);
            }

        } catch (err) {
            logger.error("messageCreate error:", err.message);
        }
    }
};