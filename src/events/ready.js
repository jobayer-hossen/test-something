const Logger = require("../logger");
const logger = new Logger("Ready");

module.exports = {
  name: "ready", // ← CHANGE BACK TO 'ready' (not clientReady)
  once: true,
  execute(client) {
    console.log("=== READY EVENT FIRED ===");
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
          { name: "EPIC-BOTS | Vibing 🎮", type: 0 },
          { name: "🌧️ Coin Rains in EPIC-BOTS", type: 3 },
          { name: "🎁 Lootbox Events in EPIC-BOTS", type: 3 },
          { name: "🤝 Invite your friends to EPIC-BOTS", type: 3 },
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
        try {
          client.features.amanTrumpetReminder.initialize();
          logger.info("🎺 Aman Trumpet Reminder initialized");
        } catch (error) {
          logger.error("Error initializing Aman Trumpet Reminder:", error);
        }
      }
      if (client.features?.tournamentManager) {
        const TOURNAMENT_GUILD_ID = 894383235063222313;
        const TOURNAMENT_CHANNEL_ID = 1445056583636877434;
        client.features.tournamentManager.start(
          TOURNAMENT_GUILD_ID,
          TOURNAMENT_CHANNEL_ID,
        );
      }
    } catch (error) {
      logger.error("Error in ready event:", error.message);
    }
  },
};
