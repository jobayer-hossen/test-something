const http = require("http");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const Logger = require("./logger");
const config = require("./config");
const database = require("./database/connection");
const CoinRainFeature = require("./features/coinRain");
const LootboxSummoningFeature = require("./features/lootboxSummoning");
const AmanCoinMention = require("./features/amanTrumpetReminder"); // Add this
const BaseManager = require("./features/baseManager");

// Keep bot alive on Render
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("I'm alive - " + new Date().toISOString());
    res.end();
    console.log("🏓 Ping received from UptimeRobot:", new Date().toISOString());
  })
  .listen(process.env.PORT || 3000);

const logger = new Logger("Bot");

class EpicRPGBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.client.commands = new Collection();
    this.client.features = {};
  }

  async initialize() {
    try {
      logger.info("🚀 Initializing Epic RPG Bot...");

      // ✅ ADD THIS - catch ALL errors
      process.on("unhandledRejection", (error) => {
        console.error("❌ UNHANDLED REJECTION:", error.message);
        console.error("Code:", error.code);
        console.error("Stack:", error.stack);
      });

      process.on("uncaughtException", (error) => {
        console.error("❌ UNCAUGHT EXCEPTION:", error.message);
        console.error("Stack:", error.stack);
      });

      // Check env variables first
      console.log("=== ENV CHECK ===");
      console.log("DISCORD_TOKEN exists:", !!process.env.DISCORD_TOKEN);
      console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
      console.log("CLIENT_ID exists:", !!process.env.CLIENT_ID);
      console.log("================");

      // Connect database
      try {
        logger.info("🔌 Connecting to MongoDB...");
        const dbConnected = await database.connect();

        if (dbConnected) {
          logger.info("✅ Database connected!");
          this.client.db = true;
        } else {
          logger.warn("⚠️ No database - some features may not work!");
          this.client.db = false;
        }
      } catch (dbError) {
        console.error("❌ DB Error:", dbError.message);
        this.client.db = false;
      }

      // Load everything
      this.loadFeatures();
      await this.loadCommands();
      await this.loadEvents();

      // Login
      console.log("🔑 Attempting Discord login...");
      await this.client.login(config.discord.token);
      console.log("✅ Discord login successful!");
    } catch (error) {
      console.error("❌ FATAL ERROR:", error.message);
      console.error("Stack:", error.stack);
      process.exit(1);
    }
  }

  loadFeatures() {
    logger.info("📦 Loading features...");

    this.client.features.coinRain = new CoinRainFeature(this.client);
    logger.debug("✅ CoinRain feature loaded");

    this.client.features.lootboxSummoning = new LootboxSummoningFeature(
      this.client,
    );
    logger.debug("✅ LootboxSummoning feature loaded");

    // Add Aman Trumpet Reminder
    this.client.features.amanTrumpetReminder = new AmanCoinMention(this.client);
    logger.debug("✅ Aman Trumpet Reminder feature loaded");

    logger.info("✅ All features loaded successfully");

    // Add RPG Base Manager feature
    this.client.features.baseManager = new BaseManager(this.client);
    logger.debug("✅ Base Manager feature loaded");
  }

  async loadCommands() {
    try {
      logger.info("⌨️ Loading commands...");

      const commandsPath = path.join(__dirname, "commands");
      const commandFiles = await fs.readdir(commandsPath);

      const jsFiles = commandFiles.filter((file) => file.endsWith(".js"));

      for (const file of jsFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (command.name && command.execute) {
          this.client.commands.set(command.name, command);
          logger.debug(`Command loaded: ${command.name}`);
        }
      }

      logger.info(`✅ ${jsFiles.length} commands loaded successfully`);
    } catch (error) {
      logger.error("Error loading commands:", error.message);
      throw error;
    }
  }

  async loadEvents() {
    try {
      logger.info("📡 Loading events...");

      const eventsPath = path.join(__dirname, "events");
      const eventFiles = await fs.readdir(eventsPath);

      const jsFiles = eventFiles.filter((file) => file.endsWith(".js"));

      for (const file of jsFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
          this.client.once(event.name, (...args) =>
            event.execute(...args, this.client),
          );
        } else {
          this.client.on(event.name, (...args) =>
            event.execute(...args, this.client),
          );
        }

        logger.debug(`Event loaded: ${event.name}`);
      }

      logger.info("✅ Events loaded successfully");
    } catch (error) {
      logger.error("Error loading events:", error.message);
      throw error;
    }
  }
}

// Initialize and start bot
const bot = new EpicRPGBot();
bot.initialize();

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("⏹️  Shutting down gracefully...");
  process.exit(0);
});

module.exports = bot;
