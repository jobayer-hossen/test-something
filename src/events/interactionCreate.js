const Logger = require("../logger");
const config = require("../config");
const { MessageFlags } = require("discord.js");

const logger = new Logger("InteractionCreate");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // ════════════════════════════════════════
      //   BUTTON INTERACTIONS
      // ════════════════════════════════════════
      if (interaction.isButton()) {
        // Enchantment watcher buttons
        if (
          interaction.customId.startsWith("eb_enchant_") &&
          config.ENCHANT_CHANNEL_ID &&
          interaction.channelId === config.ENCHANT_CHANNEL_ID
        ) {
          if (client.features?.enchantmentWatcher) {
            await client.features.enchantmentWatcher.handleButtonClick(
              interaction,
            );
          }
          return;
        }

        // Other button handlers go here in future
        logger.debug(`Button clicked: ${interaction.customId}`);
        return;
      }

      // ════════════════════════════════════════
      //   SELECT MENU INTERACTIONS
      // ════════════════════════════════════════
      if (interaction.isStringSelectMenu()) {
        logger.debug(`Select menu used: ${interaction.customId}`);
        // Handle select menus here if needed
        return;
      }

      // ════════════════════════════════════════
      //   SLASH COMMANDS
      // ════════════════════════════════════════
      if (!interaction.isChatInputCommand()) return;

      const command = client.slashCommands?.get(interaction.commandName);

      if (!command) {
        logger.warn(`Unknown slash command: ${interaction.commandName}`);
        await interaction.reply({
          content: "❌ This command is not available",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(
          `Error executing slash command /${interaction.commandName}:`,
          error.message,
        );

        const errorMessage = {
          content: "❌ An error occurred while executing this command!",
          flags: MessageFlags.Ephemeral,
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          logger.error("Failed to send error message:", replyError.message);
        }
      }
    } catch (error) {
      logger.error("Critical error in interactionCreate:", error.message);
    }
  },
};