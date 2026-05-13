const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('./logger');
const config = require('./config');
const CoinRainFeature = require('./features/coinRain');
const LootboxSummoningFeature = require('./features/lootboxSummoning');

// Keep bot alive on Render
http.createServer((req, res) => {
  res.write("I'm alive");
  res.end();
}).listen(process.env.PORT || 3000);

const logger = new Logger('Bot');

class EpicRPGBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences, // Status/Activity
        GatewayIntentBits.GuildMembers, // Member events
      ],
    });

    this.client.commands = new Collection();
    this.client.features = {};
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Epic RPG Bot...');

      // Load features
      this.loadFeatures();

      // Load commands
      await this.loadCommands();

      // Load events
      await this.loadEvents();

      // Login to Discord
      await this.client.login(config.discord.token);

      logger.info('✅ Bot initialization complete!');
    } catch (error) {
      logger.error('Fatal error during initialization:', error.message);
      process.exit(1);
    }
  }

  loadFeatures() {
    logger.info('📦 Loading features...');

    this.client.features.coinRain = new CoinRainFeature(this.client);
    logger.debug('✅ CoinRain feature loaded');

    this.client.features.lootboxSummoning = new LootboxSummoningFeature(
      this.client
    );
    logger.debug('✅ LootboxSummoning feature loaded');

    logger.info('✅ All features loaded successfully');
  }

  async loadCommands() {
    try {
      logger.info('⌨️ Loading commands...');

      const commandsPath = path.join(__dirname, 'commands');
      const commandFiles = await fs.readdir(commandsPath);

      const jsFiles = commandFiles.filter((file) => file.endsWith('.js'));

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
      logger.error('Error loading commands:', error.message);
      throw error;
    }
  }

  async loadEvents() {
    try {
      logger.info('📡 Loading events...');

      const eventsPath = path.join(__dirname, 'events');
      const eventFiles = await fs.readdir(eventsPath);

      const jsFiles = eventFiles.filter((file) => file.endsWith('.js'));

      for (const file of jsFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
          this.client.once(event.name, (...args) =>
            event.execute(...args, this.client)
          );
        } else {
          this.client.on(event.name, (...args) =>
            event.execute(...args, this.client)
          );
        }

        logger.debug(`Event loaded: ${event.name}`);
      }

      logger.info('✅ Events loaded successfully');
    } catch (error) {
      logger.error('Error loading events:', error.message);
      throw error;
    }
  }
}

// Initialize and start bot
const bot = new EpicRPGBot();
bot.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('⏹️  Shutting down gracefully...');
  process.exit(0);
});

module.exports = bot;