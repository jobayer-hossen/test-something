const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reload slash commands (restart Discord after)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({
      content:
        "🔄 Commands are being reloaded. Please **fully restart Discord** (close completely and reopen) to see the new commands.",
      ephemeral: true,
    });
  },
};