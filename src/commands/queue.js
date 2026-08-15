// commands/queue.js
const rateLimitQueue = require("../utils/RateLimitQueue");
const Logger = require("../logger");
const logger = new Logger("Queue");

module.exports = {
    name: "queue",
    description: "Manage the rate limit queue",

    async execute(message, args, client) {
        // Admin check
        if (!message.member?.permissions.has("Administrator")) {
            return message.reply("❌ Administrator permission required.").catch(() => {});
        }

        const sub = args[0]?.toLowerCase();

        // eb queue clear → clear this channel
        // eb queue clear all → clear everything
        if (sub === "clear") {
            const scope = args[1]?.toLowerCase();

            if (scope === "all") {
                const cleared = rateLimitQueue.clearAll();
                logger.info(`[Queue] ALL queues cleared (${cleared} tasks) by ${message.author.username}`);
                return message.reply(`✅ Cleared **${cleared}** tasks from all queues.`).catch(() => {});
            }

            // Default → clear this channel only
            const cleared = rateLimitQueue.clearChannel(message.channel.id);
            logger.info(`[Queue] #${message.channel.name} cleared (${cleared} tasks) by ${message.author.username}`);
            return message.reply(`✅ Cleared **${cleared}** tasks from this channel.`).catch(() => {});
        }

        // eb queue status
        if (sub === "status") {
            const s = rateLimitQueue.getStats();
            return message.reply(
                `📋 **Queue Status**\n` +
                `Active Queues: \`${s.activeQueues}\`\n` +
                `Pending Tasks: \`${s.totalQueued}\`\n` +
                `Rate Limits Hit: \`${s.rateLimits}\`\n` +
                `Spam Channels: \`${s.spamChannels}\`\n` +
                `Global Paused: \`${s.globalPaused}\``
            ).catch(() => {});
        }

        // eb queue pause [ms]
        if (sub === "pause") {
            const ms = Math.min(parseInt(args[1]) || 5000, 30000);
            rateLimitQueue.pauseGlobal(ms);
            logger.info(`[Queue] Paused ${ms}ms by ${message.author.username}`);
            return message.reply(`⏸️ Queue paused for \`${ms}ms\`.`).catch(() => {});
        }

        // Default → show usage
        return message.reply(
            `**Queue Commands**\n` +
            `\`eb queue clear\` - Clear this channel queue\n` +
            `\`eb queue clear all\` - Clear all queues\n` +
            `\`eb queue status\` - Show queue info\n` +
            `\`eb queue pause [ms]\` - Pause queue`
        ).catch(() => {});
    }
};