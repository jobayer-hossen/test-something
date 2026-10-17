
const http = require("http");
const https = require("https");
const {
  Client,
  GatewayIntentBits,
  Collection,
  Routes,
  REST,
} = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const Logger = require("./logger");
const config = require("./config");
const database = require("./database/connection");

// Features
const ActivityTracker = require("./features/ActivityTracker");
const RoleManager = require("./features/RoleManager");
const InactivityMonitor = require("./features/InactivityMonitor");
const SummonerManager = require("./features/SummonerManager");
const WelcomeMessageFeature = require("./features/welcomeMessage");
const CoinRainFeature = require("./features/coinRain");
const LootBoxSummoningFeature = require("./features/LootBoxSummoningFeature");
const AmanCoinMention = require("./features/amanTrumpetReminder");
const BaseManager = require("./features/baseManager");
const CommandTrackerFeature = require("./features/commandTracker");
const TimeTravelRolesFeature = require("./features/timeTravelRoles");
const BeachPartyFeature = require("./features/BeachPartyFeature");
const EnchantmentWatcher = require("./features/EnchantmentWatcher");
const FishGodCookingFeature = require("./features/FishGodCookingFeature");

const logger = new Logger("Bot");

// ════════════════════════════════════════════
// KEEP-ALIVE HTTP SERVER
// ════════════════════════════════════════════
const keepAliveServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    const health = {
      status: "alive",
      uptime: process.uptime().toFixed(0) + "s",
      timestamp: new Date().toISOString(),
      features: {
        activityTracker: !!this.client?.features?.activityTracker,
        roleManager: !!this.client?.features?.roleManager,
        inactivityMonitor: !!this.client?.features?.inactivityMonitor,
        summonerManager: !!this.client?.features?.summonerManager,
      },
      inactivityRunning:
        this.client?.features?.inactivityMonitor?.isRunning || false,
      summonerEvaluating:
        this.client?.features?.summonerManager?.isEvaluating || false,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(health, null, 2));
  }

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
// SELF-PING (Render Anti-Sleep)
// ════════════════════════════════════════════
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(
    () => {
      https
        .get(process.env.RENDER_EXTERNAL_URL, (res) => {
          console.log(
            `🏓 Self-ping: ${res.statusCode} | Uptime: ${process.uptime().toFixed(0)}s`,
          );
        })
        .on("error", (err) => {
          console.warn("⚠️ Self-ping failed:", err.message);
        });
    },
    10 * 60 * 1000,
  );
}

// ════════════════════════════════════════════
// MAIN BOT CLASS
// ════════════════════════════════════════════
class EpicRPGBot {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isDestroyed = false;

    // 🔒 Guards to prevent multiple/overlapping login attempts
    this.isConnecting = false;
    this.hasConnectedOnce = false;

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 300000;
    this.reconnectTimer = null;
    this.readyTimeout = null;

    this.stats = {
      startTime: Date.now(),
      totalReconnects: 0,
      lastReadyAt: null,
      disconnects: 0,
    };
  }

  // ══════════════════════════════════════════
  // CREATE FRESH CLIENT WITH ERROR TRACKING
  // ══════════════════════════════════════════
  createClient() {
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
      ws: {
        large_threshold: 250,
      },
    });

    this.client.commands = new Collection();
    this.client.slashCommands = new Collection(); // ✅ Slash commands store
    this.client.features = {};
    this.isReady = false;

    // ✅ INITIALIZE ERROR TRACKING
    this.client.errorCount = {
      total: 0,
      interactions: 0,
      commands: 0,
      messages: 0,
      discord: 0,
      other: 0,
      lastError: null,
      lastErrorTime: null,
    };

    logger.info("🔧 Fresh Discord client created");
    return this.client;
  }

  // ══════════════════════════════════════════
  // INITIALIZE
  // ══════════════════════════════════════════
  async initialize() {
    this.setupProcessHandlers();

    logger.info("🚀 Initializing Epic RPG Bot...");

    const cleanToken = this.validateToken();
    if (!cleanToken) {
      process.exit(1);
    }

    this.cleanToken = cleanToken;

    if (!process.env.CLIENT_ID) {
      logger.warn(
        "⚠️ CLIENT_ID not set - Slash commands will not be registered",
      );
    }

    await this.connectDatabase();

    await this.startBot();
  }

  // ══════════════════════════════════════════
  // VALIDATE TOKEN
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

    const parts = cleanToken.split(".");
    if (parts.length !== 3) {
      console.error(
        "❌ Token format invalid! Expected 3 parts, got:",
        parts.length,
      );
      return null;
    }

    console.log("✅ Token valid | Length:", cleanToken.length);
    console.log("✅ Token preview:", cleanToken.substring(0, 10) + "...");
    return cleanToken;
  }

  // ══════════════════════════════════════════
  // LOAD SLASH COMMANDS
  // ══════════════════════════════════════════
  async loadSlashCommands() {
    try {
      if (!this.client || !this.client.slashCommands) {
        logger.warn("⚠️ Client not ready for slash commands");
        return;
      }

      const slashCommandsPath = path.join(__dirname, "commands", "slash");

      try {
        await fs.access(slashCommandsPath);
      } catch {
        logger.warn(
          "⚠️ Slash commands directory not found (optional feature)",
        );
        return;
      }

      const slashCommandFiles = await fs.readdir(slashCommandsPath);
      const jsFiles = slashCommandFiles.filter((f) => f.endsWith(".js"));

      const slashCommandsData = [];
      let loaded = 0;
      let failed = 0;

      for (const file of jsFiles) {
        try {
          delete require.cache[
            require.resolve(path.join(slashCommandsPath, file))
          ];
          const command = require(path.join(slashCommandsPath, file));

          if (command.data && command.execute) {
            slashCommandsData.push(command.data.toJSON());
            this.client.slashCommands.set(command.data.name, command);
            loaded++;
          } else {
            console.warn(
              `⚠️ Slash command ${file} missing data or execute method`,
            );
            failed++;
          }
        } catch (err) {
          console.error(
            `❌ Failed to load slash command ${file}:`,
            err.message,
          );
          failed++;
        }
      }

      logger.info(`✅ Slash Commands: ${loaded} loaded, ${failed} failed`);

      if (loaded > 0 && process.env.CLIENT_ID) {
        await this.registerSlashCommands(slashCommandsData);
      } else if (loaded > 0 && !process.env.CLIENT_ID) {
        console.warn(
          "⚠️ CLIENT_ID not set, skipping slash command registration",
        );
      }
    } catch (err) {
      console.error("❌ Slash commands loading error:", err.message);
    }
  }

  // ══════════════════════════════════════════
  // REGISTER SLASH COMMANDS WITH DISCORD
  // ══════════════════════════════════════════
  async registerSlashCommands(slashCommandsData) {
    try {
      const rest = new REST({ version: "10" }).setToken(this.cleanToken);

      logger.info(
        `📝 Registering ${slashCommandsData.length} slash commands with Discord...`,
      );

      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: slashCommandsData,
      });

      logger.info("✅ Slash commands registered successfully");
    } catch (error) {
      console.error("❌ Failed to register slash commands:", error.message);

      if (error.message?.includes("401")) {
        console.error(
          "❌ Authentication failed - Check DISCORD_TOKEN and CLIENT_ID",
        );
      }
      if (error.message?.includes("404")) {
        console.error("❌ Application not found - Check CLIENT_ID");
      }
    }
  }

  // ══════════════════════════════════════════
  // START BOT (with retry + duplicate-login guard)
  // ══════════════════════════════════════════
  async startBot() {
    if (this.isDestroyed) return;

    // 🔒 Prevent overlapping login attempts
    if (this.isConnecting) {
      logger.warn("⚠️ Login already in progress. Skipping duplicate attempt...");
      return;
    }

    // 🔒 Already connected right now
    if (this.client?.isReady?.()) {
      logger.info("✅ Bot already connected. Skipping login.");
      return;
    }

    // 🔒 Already connected once before — Discord.js owns reconnection now
    if (this.hasConnectedOnce) {
      logger.info(
        "🔄 Already connected before — Discord.js is managing Gateway reconnection.",
      );
      return;
    }

    this.isConnecting = true;

    try {
      logger.info(
        `🔄 Starting bot (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`,
      );

      this.createClient();

      this.loadFeatures();
      await this.loadCommands();
      await this.loadSlashCommands();
      await this.loadEvents();

      this.setupDebugListeners();
      this.setupConnectionListeners();
      this.setupErrorListeners(); // ✅ NEW: Error tracking

      console.log("🔑 Logging into Discord...");
      await this.client.login(this.cleanToken);
      console.log("✅ Login sent! Waiting for READY event...");
    } catch (loginError) {
      console.error("❌ Login failed:", loginError.message);

      if (this.isUnrecoverableError(loginError)) {
        console.error("❌ Unrecoverable error - stopping bot");
        process.exit(1);
      }

      if (!this.hasConnectedOnce) {
        this.scheduleReconnect(`Login error: ${loginError.message}`);
      } else {
        logger.warn("⚠️ Discord.js will handle Gateway reconnection.");
      }
    } finally {
      this.isConnecting = false;
    }
  }

  // ══════════════════════════════════════════
  // SETUP ERROR LISTENERS (NEW)
  // ══════════════════════════════════════════
  setupErrorListeners() {
    // ✅ Command errors
    this.client.on("commandError", (error, context) => {
      this.client.errorCount.total++;
      this.client.errorCount.commands++;
      this.client.errorCount.lastError = error.message;
      this.client.errorCount.lastErrorTime = new Date();

      logger.error(`Command Error [${context?.command}]:`, error.message);
    });

    // ✅ Interaction errors (slash commands, buttons, etc.)
    this.client.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isCommand()) {
          const command = this.client.slashCommands.get(
            interaction.commandName,
          );
          if (!command) return;

          try {
            await command.execute(interaction);
          } catch (error) {
            this.client.errorCount.total++;
            this.client.errorCount.interactions++;
            this.client.errorCount.lastError = error.message;
            this.client.errorCount.lastErrorTime = new Date();

            logger.error(
              `Slash Command Error [${interaction.commandName}]:`,
              error.message,
            );

            try {
              await interaction.reply({
                content: "❌ An error occurred while executing this command.",
                ephemeral: true,
              });
            } catch (e) {
              logger.error("Failed to send error reply:", e.message);
            }
          }
        }
      } catch (error) {
        this.client.errorCount.total++;
        this.client.errorCount.interactions++;
        logger.error("Interaction handler error:", error.message);
      }
    });

    // ✅ Message command errors
    this.client.on("messageCreate", async (message) => {
      try {
        if (message.author.bot || !message.guild) return;

        const prefix = config.PREFIX || "!";
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = this.client.commands.get(commandName);

        if (!command) return;

        try {
          await command.execute(message, args, this.client);
        } catch (error) {
          this.client.errorCount.total++;
          this.client.errorCount.messages++;
          this.client.errorCount.lastError = error.message;
          this.client.errorCount.lastErrorTime = new Date();

          logger.error(
            `Message Command Error [${commandName}]:`,
            error.message,
          );

          try {
            await message.reply({
              content: "❌ An error occurred while executing this command.",
            });
          } catch (e) {
            logger.error("Failed to send error reply:", e.message);
          }
        }
      } catch (error) {
        this.client.errorCount.total++;
        this.client.errorCount.messages++;
        logger.error("Message handler error:", error.message);
      }
    });

    // ✅ Discord API errors
    this.client.rest.on("rateLimited", (info) => {
      this.client.errorCount.total++;
      this.client.errorCount.discord++;
      this.client.errorCount.lastError = `Rate Limited: ${info.route}`;
      this.client.errorCount.lastErrorTime = new Date();

      console.warn(`⚠️ RATE LIMITED!`);
      console.warn(`   Route: ${info.method} ${info.route}`);
      console.warn(`   Retry after: ${info.retryAfter}ms`);
    });

    // ✅ General client errors
    this.client.on("error", (error) => {
      this.client.errorCount.total++;
      this.client.errorCount.discord++;
      this.client.errorCount.lastError = error.message;
      this.client.errorCount.lastErrorTime = new Date();

      logger.error("Client error:", error.message);
    });
  }

  // ══════════════════════════════════════════
  // CONNECTION LISTENERS
  // ══════════════════════════════════════════
  setupConnectionListeners() {
    this.client.once("ready", (client) => {
      this.isReady = true;
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.stats.lastReadyAt = Date.now();

      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      const uptime = ((Date.now() - this.stats.startTime) / 1000).toFixed(0);

      console.log("╔══════════════════════════════════════╗");
      console.log("║         ✅ BOT IS ONLINE!            ║");
      console.log("╠══════════════════════════════════════╣");
      console.log(`║ 🤖 Tag:     ${client.user.tag.padEnd(24)}║`);
      console.log(`║ 🆔 ID:      ${client.user.id.padEnd(24)}║`);
      console.log(
        `║ 🏰 Guilds:  ${String(client.guilds.cache.size).padEnd(24)}║`,
      );
      console.log(`║ ⏱️  Startup: ${(uptime + "s").padEnd(24)}║`);
      console.log(
        `║ 🔄 Reconnects: ${String(this.stats.totalReconnects).padEnd(21)}║`,
      );
      console.log("╚══════════════════════════════════════╝");
    });

    this.client.on("shardResume", (id, replayedEvents) => {
      this.isReady = true;

      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }

      console.log(
        `✅ Shard ${id} RESUMED | Replayed: ${replayedEvents} events`,
      );
      this.reconnectAttempts = 0;
    });

    this.client.on("shardReconnecting", (id) => {
      this.isReady = false;
      console.log(`🔄 Shard ${id} reconnecting to Discord...`);
    });

    this.client.on("shardDisconnect", (event, id) => {
      this.isReady = false;
      this.stats.disconnects++;

      const code = event.code;
      const reason = event.reason || "No reason provided";

      console.warn(`⚠️ Shard ${id} disconnected!`);
      console.warn(`   Code: ${code} | Reason: ${reason}`);
      console.warn(`   Total disconnects: ${this.stats.disconnects}`);

      if (this.isUnrecoverableCode(code)) {
        console.error(`❌ Unrecoverable disconnect code: ${code}`);
        console.error(`❌ ${this.getCloseCodeReason(code)}`);
        process.exit(1);
      }

      if (!this.hasConnectedOnce) {
        setTimeout(() => {
          if (!this.isReady && !this.isDestroyed && !this.hasConnectedOnce) {
            console.warn(
              "⚠️ Auto-reconnect didn't work, attempting manual reconnect...",
            );
            this.scheduleReconnect(`Shard ${id} stayed disconnected`);
          }
        }, 15000);
      } else {
        console.log("ℹ️ Discord.js will automatically handle reconnection.");
      }
    });

    this.readyTimeout = setTimeout(() => {
      if (!this.isReady && !this.hasConnectedOnce) {
        console.error("❌ READY event never fired in 90 seconds!");
        this.scheduleReconnect("Ready timeout exceeded");
      }
    }, 90000);
  }

  // ══════════════════════════════════════════
  // SCHEDULE RECONNECT
  // ══════════════════════════════════════════
  scheduleReconnect(reason) {
    if (this.isDestroyed) return;

    if (this.hasConnectedOnce) {
      logger.info(
        "🔄 Skipping manual reconnect — Discord.js already manages the Gateway.",
      );
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectAttempts++;
    this.stats.totalReconnects++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(
        `❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached!`,
      );
      console.error("❌ Bot shutting down. Render will auto-restart.");
      process.exit(1);
    }

    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.floor(baseDelay + jitter);

    console.log("╔══════════════════════════════════════╗");
    console.log("║         🔄 RECONNECT SCHEDULED       ║");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ Reason:   ${reason.substring(0, 27).padEnd(27)}║`);
    console.log(
      `║ Attempt:  ${String(`${this.reconnectAttempts}/${this.maxReconnectAttempts}`).padEnd(27)}║`,
    );
    console.log(
      `║ Delay:    ${String((delay / 1000).toFixed(1) + "s").padEnd(27)}║`,
    );
    console.log(
      `║ Total:    ${String(this.stats.totalReconnects + " reconnects").padEnd(27)}║`,
    );
    console.log("╚══════════════════════════════════════╝");

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log(
        `🔄 Executing reconnect attempt ${this.reconnectAttempts}...`,
      );
      await this.startBot();
    }, delay);
  }

  // ══════════════════════════════════════════
  // DEBUG LISTENERS
  // ══════════════════════════════════════════
  setupDebugListeners() {
    this.client.on("debug", (info) => {
      if (
        /Connecting|READY|Session|Resume|Identify|Error|Invalid/i.test(info)
      ) {
        console.log("🔧 GATEWAY:", info.substring(0, 250));
      }
    });

    this.client.on("warn", (info) => {
      console.warn("⚠️ CLIENT WARN:", info.substring(0, 200));
    });

    this.client.on("shardError", (err, id) => {
      console.error(`❌ SHARD ${id} ERROR:`, err.message?.substring(0, 200));
    });

    this.client.on("invalidated", () => {
      console.error("❌ SESSION INVALIDATED!");
      console.error("❌ Token may be invalid or session limit hit");
      process.exit(1);
    });

    this.client.rest.on("rateLimited", (info) => {
      console.warn(`⚠️ RATE LIMITED!`);
      console.warn(`   Route: ${info.method} ${info.route}`);
      console.warn(`   Retry after: ${info.retryAfter}ms`);
    });
  }

  // ══════════════════════════════════════════
  // PROCESS ERROR HANDLERS
  // ══════════════════════════════════════════
  setupProcessHandlers() {
    process.on("unhandledRejection", (reason, promise) => {
      const msg = reason?.message || String(reason);
      console.error("❌ UNHANDLED REJECTION:", msg.substring(0, 300));

      if (this.client?.errorCount) {
        this.client.errorCount.total++;
        this.client.errorCount.other++;
        this.client.errorCount.lastError = msg;
        this.client.errorCount.lastErrorTime = new Date();
      }
    });

    process.on("uncaughtException", (error) => {
      console.error(
        "❌ UNCAUGHT EXCEPTION:",
        error.message?.substring(0, 300),
      );
      console.error(error.stack?.substring(0, 500));

      if (this.client?.errorCount) {
        this.client.errorCount.total++;
        this.client.errorCount.other++;
        this.client.errorCount.lastError = error.message;
        this.client.errorCount.lastErrorTime = new Date();
      }

      if (!this.isDestroyed) {
        this.isDestroyed = true;
        process.exit(1);
      }
    });

    const shutdown = async (signal) => {
      console.log(`\n📴 Received ${signal} - Gracefully shutting down...`);
      this.isDestroyed = true;

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.readyTimeout) clearTimeout(this.readyTimeout);

      // Shutdown features gracefully
      try {
        if (this.client?.features?.activityTracker) {
          await this.client.features.activityTracker.shutdown();
        }

        if (this.client?.features?.inactivityMonitor) {
          this.client.features.inactivityMonitor.shutdown();
        }

        if (this.client?.features?.summonerManager) {
          this.client.features.summonerManager.shutdown();
        }
      } catch (error) {
        console.error("Error during feature shutdown:", error);
      }

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

      setTimeout(() => process.exit(0), 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  // ══════════════════════════════════════════
  // UNRECOVERABLE ERROR CHECK
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
    const unrecoverableCodes = [4004, 4010, 4011, 4013, 4014];
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
  // DATABASE CONNECTION
  // ══════════════════════════════════════════
  async connectDatabase() {
    try {
      logger.info("🔌 Connecting to MongoDB...");
      const connected = await database.connect();
      this.dbConnection = connected;
      logger.info("✅ Database connected!");
    } catch (err) {
      console.warn(
        "⚠️ Database failed - some features may not work:",
        err.message,
      );
    }
  }

  // ══════════════════════════════════════════
  // LOAD FEATURES
  // ══════════════════════════════════════════
  loadFeatures() {
    logger.info("📦 Loading features...");

    try {
      if (this.dbConnection) {
        this.client.db = this.dbConnection;
      }

      // Existing features
      this.client.features.coinRain = new CoinRainFeature(this.client);
      this.client.features.LootBoxSummoningFeature =
        new LootBoxSummoningFeature(this.client);
      this.client.features.amanTrumpetReminder = new AmanCoinMention(
        this.client,
      );
      this.client.features.baseManager = new BaseManager(this.client);
      this.client.features.commandTracker = new CommandTrackerFeature(
        this.client,
      );
      this.client.features.welcomeMessage = new WelcomeMessageFeature(
        this.client,
      );
      this.client.features.welcomeMessage.initialize();
      this.client.features.timeTravelRoles = new TimeTravelRolesFeature(
        this.client,
      );
      this.client.features.beachPartyFeature = new BeachPartyFeature(
        this.client,
      );

      this.client.features.fishGodCookingFeature = new FishGodCookingFeature(
        this.client,
      );

      // NEW FEATURES
      this.client.features.activityTracker = new ActivityTracker(this.client);
      this.client.features.activityTracker.initialize();

      this.client.features.roleManager = new RoleManager(this.client);

      this.client.features.inactivityMonitor = new InactivityMonitor(
        this.client,
      );

      this.client.features.summonerManager = new SummonerManager(this.client);

      this.client.features.enchantmentWatcher = new EnchantmentWatcher(
        this.client,
      );

      logger.info("✅ All features loaded");
    } catch (err) {
      console.error("❌ Feature loading error:", err.message);
      throw err;
    }
  }

  // ══════════════════════════════════════════
  // LOAD COMMANDS
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
  // LOAD EVENTS
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
// START THE BOT
// ════════════════════════════════════════════
const bot = new EpicRPGBot();
bot.initialize().catch((err) => {
  console.error("❌ Failed to initialize bot:", err.message);
  process.exit(1);
});

module.exports = bot;