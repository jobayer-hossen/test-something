// utils/RateLimitQueue.js
const Logger = require("../logger");
const logger = new Logger("RateLimitQueue");

class RateLimitQueue {
    constructor() {
        this.queues = new Map();
        this.processing = new Map();
        this.globalPaused = false;
        this.globalPauseUntil = 0;

        this.stats = {
            processed: 0,
            dropped: 0,
            rateLimits: 0,
            skipped: 0
        };

        this.channelActivity = new Map();
        this.spamChannels = new Set();

        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    // ─────────────────────────────────────
    //   ADD REACTION TO QUEUE
    // ─────────────────────────────────────
    addReaction(channelId, task, options = {}) {
        const { maxQueue = 5, skipIfSpam = true } = options;

        if (skipIfSpam && this.spamChannels.has(channelId)) {
            this.stats.skipped++;
            return false;
        }

        if (!this.queues.has(channelId)) {
            this.queues.set(channelId, []);
        }

        const queue = this.queues.get(channelId);

        if (queue.length >= maxQueue) {
            this.stats.dropped++;
            return false;
        }

        queue.push({
            task,
            addedAt: Date.now(),
            maxAge: options.maxAge || 10000
        });

        if (!this.processing.get(channelId)) {
            this.processQueue(channelId);
        }

        return true;
    }

    // ─────────────────────────────────────
    //   PROCESS QUEUE
    // ─────────────────────────────────────
    async processQueue(channelId) {
        this.processing.set(channelId, true);
        const queue = this.queues.get(channelId);

        while (queue && queue.length > 0) {
            // Check global pause
            if (this.globalPaused) {
                const waitTime = Math.max(0, this.globalPauseUntil - Date.now());
                if (waitTime > 0) await this.sleep(waitTime);
                this.globalPaused = false;
            }

            const item = queue.shift();

            // Drop stale tasks
            if (Date.now() - item.addedAt > item.maxAge) {
                this.stats.dropped++;
                continue;
            }

            try {
                await item.task();
                this.stats.processed++;
                await this.sleep(350);

            } catch (error) {
                if (error?.status === 429) {
                    const retryAfter = (error.retryAfter || 1) * 1000;
                    this.stats.rateLimits++;
                    logger.warn(`Rate limited on channel ${channelId}, retrying after ${retryAfter}ms`);
                    queue.unshift(item);
                    await this.sleep(retryAfter + 200);

                } else if (error?.status === 404 || error?.status === 403) {
                    // Message gone or no permission - silent drop
                    this.stats.dropped++;

                } else {
                    this.stats.dropped++;
                    logger.error(`Task error on channel ${channelId}:`, error?.message?.substring(0, 100));
                }
            }
        }

        this.queues.delete(channelId);
        this.processing.set(channelId, false);
    }

    // ─────────────────────────────────────
    //   SPAM DETECTION
    // ─────────────────────────────────────
    trackMessage(channelId) {
        if (!this.channelActivity.has(channelId)) {
            this.channelActivity.set(channelId, {
                count: 0,
                windowStart: Date.now(),
                flaggedAt: null
            });
        }

        const data = this.channelActivity.get(channelId);
        const now = Date.now();

        // Reset window every 3 seconds
        if (now - data.windowStart > 3000) {
            data.count = 0;
            data.windowStart = now;
        }

        data.count++;

        // Flag as spam: 15+ messages in 3 seconds
        if (data.count >= 15 && !this.spamChannels.has(channelId)) {
            this.spamChannels.add(channelId);
            data.flaggedAt = now;
            logger.warn(`Channel ${channelId} flagged as spam - queue cleared`);
            this.clearChannel(channelId);

            // Auto-unflag after 8 seconds
            setTimeout(() => {
                const current = this.channelActivity.get(channelId);
                if (current && Date.now() - current.flaggedAt >= 8000) {
                    this.spamChannels.delete(channelId);
                    logger.info(`Channel ${channelId} spam flag removed`);
                }
            }, 8000);
        }

        return this.spamChannels.has(channelId);
    }

    isSpamChannel(channelId) {
        return this.spamChannels.has(channelId);
    }

    // ─────────────────────────────────────
    //   GLOBAL PAUSE
    // ─────────────────────────────────────
    pauseGlobal(ms) {
        this.globalPaused = true;
        this.globalPauseUntil = Date.now() + ms;
        logger.warn(`Global queue paused for ${ms}ms`);
    }

    // ─────────────────────────────────────
    //   CLEAR METHODS
    // ─────────────────────────────────────
    clearChannel(channelId) {
        const queue = this.queues.get(channelId);
        const count = queue?.length || 0;
        this.queues.delete(channelId);
        return count;
    }

    clearAll() {
        let total = 0;
        this.queues.forEach((q) => (total += q.length));
        this.queues.clear();
        this.spamChannels.clear();
        logger.info(`All queues cleared - ${total} tasks dropped`);
        return total;
    }

    // ─────────────────────────────────────
    //   MISSING: getSpamChannels + unmarkSpam
    //   needed by queue.js command
    // ─────────────────────────────────────
    getSpamChannels() {
        return [...this.spamChannels];
    }

    unmarkSpam(channelId) {
        this.spamChannels.delete(channelId);
        logger.info(`Spam flag manually removed from channel ${channelId}`);
    }

    // ─────────────────────────────────────
    //   STATS
    // ─────────────────────────────────────
    getStats() {
        let totalQueued = 0;
        this.queues.forEach((q) => (totalQueued += q.length));

        return {
            ...this.stats,
            activeQueues: this.queues.size,
            totalQueued,
            spamChannels: this.spamChannels.size,
            globalPaused: this.globalPaused
        };
    }

    // ─────────────────────────────────────
    //   CLEANUP - Remove stale data
    // ─────────────────────────────────────
    cleanup() {
        const now = Date.now();
        this.channelActivity.forEach((data, channelId) => {
            if (now - data.windowStart > 60000) {
                this.channelActivity.delete(channelId);
            }
        });
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = new RateLimitQueue();