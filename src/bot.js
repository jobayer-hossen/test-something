const http = require("http");
const https = require("https");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const Logger = require("./logger");
const config = require("./config");
const database = require("./database/connection");

// Features
const CoinRainFeature = require("./features/coinRain");
const LootboxSummoningFeature = require("./features/lootboxSummoning");
const AmanCoinMention = require("./features/amanTrumpetReminder");
const BaseManager = require("./features/baseManager");
const TournamentManager = require("./features/tournamentManager");

const logger = new Logger("Bot");

// ✅ FIX: Separate Keep-Alive Server
const keepAliveServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("I'm alive");
});

keepAliveServer.listen(process.env.PORT || 3000, () => {
  console.log(`✅ HTTP keep-alive on port ${process.env.PORT || 3000}`);
});

// ✅ FIX: Self-Ping to prevent Render sleep
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(
    () => {
      https
        .get(process.env.RENDER_EXTERNAL_URL, (res) => {
          console.log("🏓 Ping Status:", res.statusCode);
        })
        .on("error", (err) => {});
    },
    10 * 60 * 1000,
  ); // Every 10 minutes
}

class EpicRPGBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
      ],
      rest: { timeout: 30000, retries: 5 },
    });

    this.client.commands = new Collection();
    this.client.features = {};
  }

  async initialize() {
    try {
      logger.info("🚀 Initializing Epic RPG Bot...");

      process.on("unhandledRejection", (e) => {
        console.error("❌ UNHANDLED:", e.message.substring(0, 200));
      });

      process.on("uncaughtException", (e) => {
        console.error("❌ EXCEPTION:", e.message.substring(0, 200));
      });

      // ✅ CRITICAL: Check & Trim Token
      console.log("=== ENV CHECK ===");
      const rawToken = process.env.DISCORD_TOKEN;
      console.log("Raw Token Length:", rawToken?.length);

      const cleanToken = rawToken?.trim();
      if (!cleanToken || cleanToken.length < 50) {
        console.error("❌ INVALID TOKEN LENGTH!");
        process.exit(1);
      }
      console.log("Clean Token Length:", cleanToken.length);
      console.log("Token Starts With:", cleanToken.substring(0, 5) + "...");

      await this.connectDatabase();
      this.loadFeatures();
      await this.loadCommands();
      await this.loadEvents();

      // ✅ Debug Listeners for Freeze Detection
      this.setupDebugListeners();

      // ✅ LOGIN WITH ERROR HANDLING AND TIMEOUT
      console.log("🔑 Attempting Discord login...");

      // Add login error catcher
      try {
        await this.client.login(cleanToken); // Use cleanToken, not config.discord.token
        console.log("✅ Discord login successful! Waiting for READY event...");
      } catch (loginError) {
        console.error("❌ LOGIN FAILED:", loginError.message);
        console.error("Error code:", loginError.code);
        if (loginError.code === "TokenInvalid") {
          console.error(
            "❌ Token is invalid! Check DISCORD_TOKEN in Render env variables",
          );
        }
        process.exit(1);
      }

      // Wait for ready event with timeout
      const readyTimeout = setTimeout(() => {
        console.error("❌ READY EVENT NEVER FIRED IN 60 SECONDS!");
        console.error(
          "❌ Check if event name is 'ready' (not 'clientReady') for discord.js v14",
        );
        process.exit(1);
      }, 60000);

      // Listen for 'ready' (v14) not 'clientReady' (v15)
      this.client.once("ready", () => {
        clearTimeout(readyTimeout);
        console.log("✅ READY EVENT CONFIRMED FIRED! Bot is online!");
      });
    } catch (error) {
      console.error("❌ FATAL ERROR:", error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  setupDebugListeners() {
    this.client.on("debug", (info) => {
      if (/Connecting|READY|Session|WebSocket|Error/i.test(info)) {
        console.log("🔧 GATEWAY:", info.substring(0, 200));
      }
    });

    this.client.on("shardError", (err, id) => {
      console.error(`❌ SHARD ${id} Error:`, err.message.substring(0, 200));
    });

    this.client.on("invalidated", () => {
      console.error("❌ SESSION INVALIDATED! Restarting...");
      process.exit(1);
    });
  }

  async connectDatabase() {
    try {
      logger.info("🔌 Connecting MongoDB...");
      const connected = await database.connect();
      this.client.db = connected;
      logger.info("✅ Database connected!");
    } catch (err) {
      console.warn("⚠️ DB Failed - features may not work:", err.message);
    }
  }

  loadFeatures() {
    logger.info("📦 Loading Features...");
    this.client.features.coinRain = new CoinRainFeature(this.client);
    this.client.features.lootboxSummoning = new LootboxSummoningFeature(
      this.client,
    );
    this.client.features.amanTrumpetReminder = new AmanCoinMention(this.client);
    this.client.features.baseManager = new BaseManager(this.client);
    this.client.features.tournamentManager = new TournamentManager(this.client);

    logger.info("✅ Features loaded");
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, "commands");
    const commandFiles = await fs.readdir(commandsPath);
    const jsFiles = commandFiles.filter((f) => f.endsWith(".js"));

    for (const file of jsFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.name && command.execute) {
        this.client.commands.set(command.name, command);
      }
    }
    logger.info(`✅ Commands loaded: ${jsFiles.length}`);
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, "events");
    const eventFiles = await fs.readdir(eventsPath);
    const jsFiles = eventFiles.filter((f) => f.endsWith(".js"));

    for (const file of jsFiles) {
      const event = require(path.join(eventsPath, file));
      if (event.once) {
        this.client.once(event.name, (...args) =>
          event.execute(...args, this.client),
        );
      } else {
        this.client.on(event.name, (...args) =>
          event.execute(...args, this.client),
        );
      }
    }
    logger.info("✅ Events loaded");
  }
}

const bot = new EpicRPGBot();
bot.initialize();

module.exports = bot;
