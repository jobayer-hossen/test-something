require("dotenv").config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  },

  // Guild configuration
  GUILD_ID: "894383235063222313",

  // Role IDs
  SUMMONER_ROLE_ID: "1324850447050084452",

  // Channel IDs
  USER_LOGS_CHANNEL_ID: "1548424640605458464",
  ANNOUNCEMENT_CHANNEL_ID: "1452091225870962903",
  EPIC_PERKS_CHANNEL_ID: "1548429032029290527",

  // Bot IDs
  EPIC_RPG_BOT_ID: "555955826880413696",

  // Inactivity settings
  INACTIVITY_THRESHOLD_DAYS: 30,
  INACTIVITY_CHECK_DAYS: [3, 13, 23], // Days of month to run checks

  // Summoner settings
  SUMMONER_THRESHOLD: 500,
  SUMMONER_PERIOD_DAYS: 14,
  TOOTHBRUSH_COMMAND: "legendary_toothbrush",
};
