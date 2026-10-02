const Logger = require("../logger");
const logger = new Logger("Ready");

module.exports = {
  name: "clientReady", // ✅ fixed v15
  once: true,
  execute(client) {
    logger.info(`✅ Bot logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);

    try {
      client.user.setPresence({
        activities: [{ name: "EPIC-BOTS | Vibing 🎮", type: 0 }],
        status: "online",
      });

      logger.info("✅ Presence set successfully!");

      setInterval(() => {
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
        const randomActivity =
          activities[Math.floor(Math.random() * activities.length)];
        client.user.setPresence({
          activities: [randomActivity],
          status: "online",
        });
      }, 20000);

      logger.info("✅ Status rotation started!");

      if (client.features?.amanTrumpetReminder) {
        client.features.amanTrumpetReminder.initialize();
      }

      if (client.features?.inactivityMonitor) {
        client.features.inactivityMonitor.initialize();
      }

      if (client.features?.summonerManager) {
        client.features.summonerManager.initialize();
      }
    } catch (error) {
      logger.error("Error in ready event:", error.message);
    }
  },
};
