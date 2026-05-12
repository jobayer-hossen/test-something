const Logger = require('../logger');

const logger = new Logger('InteractionCreate');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error.message);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ An error occurred while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while executing this command!',
          ephemeral: true,
        });
      }
    }
  },
};