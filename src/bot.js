const http = require("http");
const https = require("https");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const Logger = require("./logger");
const config = require("./config");
const database = require("./database/connection");

// Features
const WelcomeMessageFeature = require("./features/welcomeMessage");
const CoinRainFeature = require("./features/coinRain");
const LootBoxSummoningFeature = require("./features/LootBoxSummoningFeature");
const AmanCoinMention = require("./features/amanTrumpetReminder");
const BaseManager = require("./features/baseManager");
const TournamentManager = require("./features/tournamentManager");
const CommandTrackerFeature = require("./features/commandTracker");
const TimeTravelRolesFeature = require("./features/timeTravelRoles");

const BeachPartyFeature = require("./features/BeachPartyFeature");

const logger = new Logger("Bot");

// ════════════════════════════════════════════
//           KEEP-ALIVE HTTP SERVER
// ════════════════════════════════════════════
const keepAliveServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "alive",
      uptime: process.uptime().toFixed(0) + "s",
      timestamp: new Date().toISOString(),
    }),
  );
});

keepAliveServer.listen(process.env.PORT || 3000, () => {
  console.log(`✅ HTTP keep-alive on port ${process.env.PORT || 3000}`);
});

keepAliveServer.on("error", (err) => {
  console.error("❌ Keep-alive server error:", err.message);
});

// ════════════════════════════════════════════
//           SELF-PING (Render Anti-Sleep)
// ════════════════════════════════════════════
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(
    () => {
      https
        .get(process.env.RENDER_EXTERNAL_URL, (res) => {
          console.log(`🏓 Self-ping: ${res.statusCode} | Uptime: ${process.uptime().toFixed(0)}s`);
        })
        .on("error", (err) => {
          console.warn("⚠️ Self-ping failed:", err.message);
        });
    },
    10 * 60 * 1000, // Every 10 minutes
  );
}

// ════════════════════════════════════════════
//              MAIN BOT CLASS
// ════════════════════════════════════════════
class EpicRPGBot {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isDestroyed = false;

    // Reconnect tracking
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;      // Start: 5 seconds
    this.maxReconnectDelay = 300000; // Max: 5 minutes
    this.reconnectTimer = null;
    this.readyTimeout = null;

    // Stats tracking
    this.stats = {
      startTime: Date.now(),
      totalReconnects: 0,
      lastReadyAt: null,
      disconnects: 0,
    };
  }

  // ══════════════════════════════════════════
  //           CREATE FRESH CLIENT
  // ══════════════════════════════════════════
  createClient() {
    // Destroy old client if exists
    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
      ],
      rest: {
        timeout: 30000,
        retries: 5,
      },
      // ✅ WebSocket options for stability
      ws: {
        large_threshold: 250,
      },
    });

    this.client.commands = new Collection();
    this.client.features = {};
    this.isReady = false;

    logger.info("🔧 Fresh Discord client created");
    return this.client;
  }

  // ══════════════════════════════════════════
  //              INITIALIZE
  // ══════════════════════════════════════════
  async initialize() {
    // ✅ Global error handlers - register ONCE at startup
    this.setupProcessHandlers();

    logger.info("🚀 Initializing Epic RPG Bot...");

    // ✅ Validate token FIRST before anything else
    const cleanToken = this.validateToken();
    if (!cleanToken) {
      process.exit(1);
    }

    this.cleanToken = cleanToken;

    // ✅ Connect database (non-blocking)
    await this.connectDatabase();

    // ✅ First connection attempt
    await this.startBot();
  }

  // ══════════════════════════════════════════
  //           VALIDATE TOKEN
  // ══════════════════════════════════════════
  validateToken() {
    console.log("=== TOKEN VALIDATION ===");
    const rawToken = process.env.DISCORD_TOKEN;

    if (!rawToken) {
      console.error("❌ DISCORD_TOKEN is not set in environment variables!");
      return null;
    }

    const cleanToken = rawToken.trim();

    if (cleanToken.length < 50) {
      console.error("❌ Token too short:", cleanToken.length, "chars");
      return null;
    }

    // Basic token format check (3 parts separated by dots)
    const parts = cleanToken.split(".");
    if (parts.length !== 3) {
      console.error("❌ Token format invalid! Expected 3 parts, got:", parts.length);
      return null;
    }

    console.log("✅ Token valid | Length:", cleanToken.length);
    console.log("✅ Token preview:", cleanToken.substring(0, 10) + "...");
    return cleanToken;
  }

  // ══════════════════════════════════════════
  //           START BOT (with retry)
  // ══════════════════════════════════════════
  async startBot() {
    if (this.isDestroyed) return;

    try {
      logger.info(`🔄 Starting bot (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);

      // Create fresh client every attempt
      this.createClient();

      // Load everything onto new client
      this.loadFeatures();
      await this.loadCommands();
      await this.loadEvents();

      // Setup all listeners BEFORE login
      this.setupDebugListeners();
      this.setupConnectionListeners();

      // ✅ Attempt login
      console.log("🔑 Logging into Discord...");
      await this.client.login(this.cleanToken);
      console.log("✅ Login sent! Waiting for READY event...");

    } catch (loginError) {
      console.error("❌ Login failed:", loginError.message);

      // Check if error is unrecoverable
      if (this.isUnrecoverableError(loginError)) {
        console.error("❌ Unrecoverable error - stopping bot");
        process.exit(1);
      }

      // Otherwise attempt reconnect
      this.scheduleReconnect(`Login error: ${loginError.message}`);
    }
  }

  // ══════════════════════════════════════════
  //        CONNECTION LISTENERS
  // ══════════════════════════════════════════
  setupConnectionListeners() {
    // ✅ READY - Bot is fully online
    this.client.once("ready", (client) => {
      this.isReady = true;
      this.reconnectAttempts = 0; // Reset on successful connect
      this.stats.lastReadyAt = Date.now();

      // Clear ready timeout
      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }

      const uptime = ((Date.now() - this.stats.startTime) / 1000).toFixed(0);

      console.log("╔══════════════════════════════════════╗");
      console.log("║         ✅ BOT IS ONLINE!            ║");
      console.log("╠══════════════════════════════════════╣");
      console.log(`║ 🤖 Tag:     ${client.user.tag.padEnd(24)}║`);
      console.log(`║ 🆔 ID:      ${client.user.id.padEnd(24)}║`);
      console.log(`║ 🏰 Guilds:  ${String(client.guilds.cache.size).padEnd(24)}║`);
      console.log(`║ ⏱️  Startup: ${(uptime + "s").padEnd(24)}║`);
      console.log(`║ 🔄 Reconnects: ${String(this.stats.totalReconnects).padEnd(21)}║`);
      console.log("╚══════════════════════════════════════╝");
    });

    // ✅ RESUMED - Reconnected after disconnect
    this.client.on("shardResume", (id, replayedEvents) => {
      this.isReady = true;

      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }

      console.log(`✅ Shard ${id} RESUMED | Replayed: ${replayedEvents} events`);
      this.reconnectAttempts = 0;
    });

    // ✅ RECONNECTING
    this.client.on("shardReconnecting", (id) => {
      this.isReady = false;
      console.log(`🔄 Shard ${id} reconnecting to Discord...`);
    });

    // ✅ DISCONNECT - Handle specific close codes
    this.client.on("shardDisconnect", (event, id) => {
      this.isReady = false;
      this.stats.disconnects++;

      const code = event.code;
      const reason = event.reason || "No reason provided";

      console.warn(`⚠️ Shard ${id} disconnected!`);
      console.warn(`   Code: ${code} | Reason: ${reason}`);
      console.warn(`   Total disconnects: ${this.stats.disconnects}`);

      // ✅ Handle specific WebSocket close codes
      if (this.isUnrecoverableCode(code)) {
        console.error(`❌ Unrecoverable disconnect code: ${code}`);
        console.error(`❌ ${this.getCloseCodeReason(code)}`);
        process.exit(1);
      }

      // Discord.js auto-reconnects for most codes
      // We only manually reconnect if it doesn't
      setTimeout(() => {
        if (!this.isReady && !this.isDestroyed) {
          console.warn("⚠️ Auto-reconnect didn't work, attempting manual reconnect...");
          this.scheduleReconnect(`Shard ${id} stayed disconnected`);
        }
      }, 15000); // Wait 15s for Discord.js auto-reconnect
    });

    // ✅ READY TIMEOUT - If ready never fires
    this.readyTimeout = setTimeout(() => {
      if (!this.isReady) {
        console.error("❌ READY event never fired in 90 seconds!");
        this.scheduleReconnect("Ready timeout exceeded");
      }
    }, 90000);
  }

  // ══════════════════════════════════════════
  //         SCHEDULE RECONNECT
  // ══════════════════════════════════════════
  scheduleReconnect(reason) {
    if (this.isDestroyed) return;

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectAttempts++;
    this.stats.totalReconnects++;

    // Check max attempts
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached!`);
      console.error("❌ Bot shutting down. Render will auto-restart.");
      process.exit(1);
    }

    // ✅ Exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    // Add random jitter (±20%) to prevent thundering herd
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.floor(baseDelay + jitter);

    console.log("╔══════════════════════════════════════╗");
    console.log("║         🔄 RECONNECT SCHEDULED       ║");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ Reason:   ${reason.substring(0, 27).padEnd(27)}║`);
    console.log(`║ Attempt:  ${String(`${this.reconnectAttempts}/${this.maxReconnectAttempts}`).padEnd(27)}║`);
    console.log(`║ Delay:    ${String((delay / 1000).toFixed(1) + "s").padEnd(27)}║`);
    console.log(`║ Total:    ${String(this.stats.totalReconnects + " reconnects").padEnd(27)}║`);
    console.log("╚══════════════════════════════════════╝");

    this.reconnectTimer = setTimeout(async () => {
      console.log(`🔄 Executing reconnect attempt ${this.reconnectAttempts}...`);
      await this.startBot();
    }, delay);
  }

  // ══════════════════════════════════════════
  //         DEBUG LISTENERS
  // ══════════════════════════════════════════
  setupDebugListeners() {
    this.client.on("debug", (info) => {
      if (/Connecting|READY|Session|Resume|Identify|Error|Invalid/i.test(info)) {
        console.log("🔧 GATEWAY:", info.substring(0, 250));
      }
    });

    this.client.on("warn", (info) => {
      console.warn("⚠️ CLIENT WARN:", info.substring(0, 200));
    });

    this.client.on("shardError", (err, id) => {
      console.error(`❌ SHARD ${id} ERROR:`, err.message?.substring(0, 200));
      // Shard error doesn't always mean disconnect, let Discord.js handle it
    });

    this.client.on("invalidated", () => {
      console.error("❌ SESSION INVALIDATED!");
      console.error("❌ Token may be invalid or session limit hit");
      process.exit(1); // Unrecoverable - Render will restart
    });

    // ✅ Track REST rate limits
    this.client.rest.on("rateLimited", (info) => {
      console.warn(`⚠️ RATE LIMITED!`);
      console.warn(`   Route: ${info.method} ${info.route}`);
      console.warn(`   Retry after: ${info.retryAfter}ms`);
    });
  }

  // ══════════════════════════════════════════
  //         PROCESS ERROR HANDLERS
  // ══════════════════════════════════════════
  setupProcessHandlers() {
    process.on("unhandledRejection", (reason, promise) => {
      const msg = reason?.message || String(reason);
      console.error("❌ UNHANDLED REJECTION:", msg.substring(0, 300));

      // Don't exit on unhandled rejections - log and continue
    });

    process.on("uncaughtException", (error) => {
      console.error("❌ UNCAUGHT EXCEPTION:", error.message?.substring(0, 300));
      console.error(error.stack?.substring(0, 500));

      // Uncaught exceptions are dangerous - restart
      if (!this.isDestroyed) {
        this.isDestroyed = true;
        process.exit(1);
      }
    });

    // ✅ Graceful shutdown handlers
    const shutdown = (signal) => {
      console.log(`\n📴 Received ${signal} - Gracefully shutting down...`);
      this.isDestroyed = true;

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.readyTimeout) clearTimeout(this.readyTimeout);

      if (this.client) {
        try {
          this.client.destroy();
          console.log("✅ Discord client destroyed");
        } catch (e) {
          // ignore
        }
      }

      keepAliveServer.close(() => {
        console.log("✅ HTTP server closed");
        process.exit(0);
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => process.exit(0), 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  // ══════════════════════════════════════════
  //         UNRECOVERABLE ERROR CHECK
  // ══════════════════════════════════════════
  isUnrecoverableError(error) {
    const unrecoverableCodes = [
      "TokenInvalid",
      "TOKEN_INVALID",
      "DISALLOWED_INTENTS",
    ];
    return unrecoverableCodes.includes(error.code);
  }

  isUnrecoverableCode(code) {
    // Discord WebSocket close codes that mean we can't reconnect
    const unrecoverableCodes = [
      4004, // Authentication failed (bad token)
      4010, // Invalid shard
      4011, // Sharding required
      4013, // Invalid intents
      4014, // Disallowed intents
    ];
    return unrecoverableCodes.includes(code);
  }

  getCloseCodeReason(code) {
    const reasons = {
      4000: "Unknown error - try reconnecting",
      4001: "Unknown opcode",
      4002: "Decode error",
      4003: "Not authenticated",
      4004: "❌ Authentication failed - CHECK YOUR TOKEN",
      4005: "Already authenticated",
      4007: "Invalid sequence",
      4008: "Rate limited",
      4009: "Session timed out",
      4010: "Invalid shard",
      4011: "Sharding required",
      4012: "Invalid API version",
      4013: "Invalid intents",
      4014: "Disallowed intents - Enable in Discord Dev Portal",
    };
    return reasons[code] || `Unknown close code: ${code}`;
  }

  // ══════════════════════════════════════════
  //         DATABASE CONNECTION
  // ══════════════════════════════════════════
  async connectDatabase() {
    try {
      logger.info("🔌 Connecting to MongoDB...");
      const connected = await database.connect();
      this.dbConnection = connected; // Store on bot instance
      logger.info("✅ Database connected!");
    } catch (err) {
      console.warn("⚠️ Database failed - some features may not work:", err.message);
      // Non-fatal - bot can run without DB
    }
  }

  // ══════════════════════════════════════════
  //         LOAD FEATURES
  // ══════════════════════════════════════════
  loadFeatures() {
    logger.info("📦 Loading features...");

    try {
      // ✅ Pass db connection to client
      if (this.dbConnection) {
        this.client.db = this.dbConnection;
      }

      this.client.features.coinRain = new CoinRainFeature(this.client);
      this.client.features.LootBoxSummoningFeature = new LootBoxSummoningFeature(this.client);
      this.client.features.amanTrumpetReminder = new AmanCoinMention(this.client);
      this.client.features.baseManager = new BaseManager(this.client);
      this.client.features.tournamentManager = new TournamentManager(this.client);
      this.client.features.commandTracker = new CommandTrackerFeature(this.client);
      this.client.features.welcomeMessage = new WelcomeMessageFeature(this.client);
      this.client.features.welcomeMessage.initialize();
      this.client.features.timeTravelRoles = new TimeTravelRolesFeature(this.client);
      this.client.features.beachPartyFeature = new BeachPartyFeature(this.client);

      logger.info("✅ All features loaded");
    } catch (err) {
      console.error("❌ Feature loading error:", err.message);
      throw err; // Fatal - can't run without features
    }
  }

  // ══════════════════════════════════════════
  //         LOAD COMMANDS
  // ══════════════════════════════════════════
  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, "commands");
      const commandFiles = await fs.readdir(commandsPath);
      const jsFiles = commandFiles.filter((f) => f.endsWith(".js"));
      let loaded = 0;
      let failed = 0;

      for (const file of jsFiles) {
        try {
          const command = require(path.join(commandsPath, file));
          if (command.name && command.execute) {
            this.client.commands.set(command.name, command);
            loaded++;
          } else {
            console.warn(`⚠️ Command ${file} missing name or execute`);
            failed++;
          }
        } catch (err) {
          console.error(`❌ Failed to load command ${file}:`, err.message);
          failed++;
        }
      }

      logger.info(`✅ Commands: ${loaded} loaded, ${failed} failed`);
    } catch (err) {
      console.error("❌ Commands directory error:", err.message);
      throw err;
    }
  }

  // ══════════════════════════════════════════
  //         LOAD EVENTS
  // ══════════════════════════════════════════
  async loadEvents() {
    try {
      const eventsPath = path.join(__dirname, "events");
      const eventFiles = await fs.readdir(eventsPath);
      const jsFiles = eventFiles.filter((f) => f.endsWith(".js"));
      let loaded = 0;

      for (const file of jsFiles) {
        try {
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
          loaded++;
        } catch (err) {
          console.error(`❌ Failed to load event ${file}:`, err.message);
        }
      }

      logger.info(`✅ Events: ${loaded} loaded`);
    } catch (err) {
      console.error("❌ Events directory error:", err.message);
      throw err;
    }
  }
}

// ════════════════════════════════════════════
//              START THE BOT
// ════════════════════════════════════════════
const bot = new EpicRPGBot();
bot.initialize().catch((err) => {
  console.error("❌ Failed to initialize bot:", err.message);
  process.exit(1);
});

module.exports = bot;