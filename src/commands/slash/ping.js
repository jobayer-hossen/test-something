const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows the bot's latency"),

  async execute(interaction) {
    try {
      const latency = interaction.client.ws.ping;
      await interaction.reply({
        content: `🏓 Pong! Latency: **${latency}ms**`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in ping command:", error);
      await interaction.reply({
        content: "❌ Error executing command",
        ephemeral: true,
      });
    }
  },
};