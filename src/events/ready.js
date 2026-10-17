const Logger = require("../logger");
const logger = new Logger("Ready");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    try {
      logger.info(`✅ Bot logged in as ${client.user.tag}`);
      logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);

      // ════════════════════════════════════════
      // SET INITIAL PRESENCE
      // ════════════════════════════════════════
      try {
        await client.user.setPresence({
          activities: [{ name: "EPIC-BOTS | Vibing 🎮", type: 0 }],
          status: "online",
        });
        logger.info("✅ Presence set successfully!");
      } catch (err) {
        logger.warn(`⚠️ Failed to set initial presence: ${err.message}`);
      }

      // ════════════════════════════════════════
      // STATUS ROTATION (Every 20 seconds)
      // ════════════════════════════════════════
      const activities = [
        { name: "🎉 Super Donor GAs in EPIC-BOTS", type: 3 },
        { name: "🌧️ Coin Rains Happening!", type: 3 },
        { name: "🎁 Massive Summon Drops", type: 3 },
        { name: "⚡ Epic Summon Events", type: 3 },
        { name: "🌧️ Summon rain everyday", type: 3 },
        { name: "🤝 Invite Friends & Earn Rewards", type: 3 },
        { name: "💰 Gamble Responsibly in EPIC-BOTS", type: 3 },
        { name: "🔥 Active Community Events", type: 3 },
        { name: "🚀 Growing Every Day!", type: 3 },
        { name: "✨ New Events Every Month", type: 3 },
      ];

      let activityIndex = 0;

      const statusInterval = setInterval(async () => {
        try {
          const activity = activities[activityIndex % activities.length];
          await client.user.setPresence({
            activities: [activity],
            status: "online",
          });
          activityIndex++;
        } catch (err) {
          logger.warn(`⚠️ Failed to update presence: ${err.message}`);
        }
      }, 20000);

      logger.info("✅ Status rotation started!");

      // ════════════════════════════════════════
      // INITIALIZE FEATURES
      // ════════════════════════════════════════
      const featuresToInitialize = [
        {
          name: "amanTrumpetReminder",
          feature: client.features?.amanTrumpetReminder,
        },
        {
          name: "inactivityMonitor",
          feature: client.features?.inactivityMonitor,
        },
        { name: "summonerManager", feature: client.features?.summonerManager },
      ];

      for (const { name, feature } of featuresToInitialize) {
        try {
          if (feature?.initialize && typeof feature.initialize === "function") {
            feature.initialize();
            logger.info(`✅ ${name} initialized`);
          }
        } catch (err) {
          logger.warn(`⚠️ Failed to initialize ${name}: ${err.message}`);
        }
      }

      // ════════════════════════════════════════
      // CLEANUP ON PROCESS EXIT
      // ════════════════════════════════════════
      process.once("beforeExit", () => {
        clearInterval(statusInterval);
        logger.info("✅ Status rotation interval cleared");
      });
    } catch (error) {
      logger.error(`❌ Critical error in ready event: ${error.message}`);
      logger.debug(error.stack);
    }
  },
};