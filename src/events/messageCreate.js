const Logger = require('../logger');

const logger = new Logger('MessageCreate');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Ignore DMs
    if (!message.guild) return;

    // Ignore our own bot messages
    if (message.author.id === client.user.id) return;

    const prefix = 'eb ';

    // Handle prefix commands
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = client.commands.get(commandName);

      if (command) {
        try {
          await command.execute(message, args, client);
        } catch (error) {
          logger.error(`Error executing command ${commandName}:`, error.message);
          await message.reply('❌ An error occurred while executing this command!');
        }
      }
    }

    try {
      // Handle coin rain
      if (client.features.coinRain) {
        await client.features.coinRain.handleMessage(message);
      }

      // Handle lootbox summoning
      if (client.features.lootboxSummoning) {
        await client.features.lootboxSummoning.handleMessage(message);
      }
    } catch (error) {
      logger.error('Error processing message:', error.message);
    }
  },
};