const Logger = require('../logger');
const config = require('../config');

const logger = new Logger('InteractionCreate');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ════════════════════════════════════════
    //   BUTTON INTERACTIONS
    // ════════════════════════════════════════
    if (interaction.isButton()) {

      // Enchantment watcher buttons
      if (
        interaction.customId.startsWith('eb_enchant_') &&
        interaction.channelId === config.ENCHANT_CHANNEL_ID
      ) {
        if (client.features?.enchantmentWatcher) {
          await client.features.enchantmentWatcher.handleButtonClick(interaction);
        }
        return;
      }

      // other button handlers go here in future
      return;
    }

    // ════════════════════════════════════════
    //   SLASH COMMANDS
    // ════════════════════════════════════════
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
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};