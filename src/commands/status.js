const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("StatusCommand");

module.exports = {
  name: "status",
  description: "Check bot status and statistics",

  async execute(message, args, client) {
    try {
      const uptime = process.uptime();
      // Professional uptime math
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const maxMemory = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
      const ping = client.ws.ping;
      
      const status = ping < 100 ? "✅ Excellent" : ping < 200 ? "✅ Good" : "⚠️ Fair";
      const memoryPercent = Math.round((memoryUsage / maxMemory) * 100);
      const memoryBar = this.getBar(memoryPercent);

      // Feature Status Checks
      const getStatus = (feat) => feat ? "✅ Active" : "❌ Inactive";

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("🤖 Epic Bot Status Dashboard")
        .setThumbnail(client.user.avatarURL())
        .addFields(
          {
            name: "🟢 SERVER STATUS",
            value: `**Ping:** ${ping}ms (${status})\n**Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s`,
            inline: false,
          },
          {
            name: "💾 Memory Usage",
            value: `${memoryUsage}MB / ${maxMemory}MB\n${memoryBar} ${memoryPercent}%`,
            inline: false,
          },
          {
            name: "📊 Statistics",
            value: `Servers: **${client.guilds.cache.size}**\nUsers: **${client.users.cache.size}**\nCommands: **${client.commands.size}**`,
            inline: true,
          },
          {
            name: "🚀 Feature Status",
            value: `🌧️ Coin Rain: ${getStatus(client.features.coinRain)}\n🎁 Lootbox: ${getStatus(client.features.lootboxSummoning)}\n⏰ RPG Tracker: ${getStatus(client.features.rpgTracker)}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Epic Bot | Real-time Metrics",
          iconURL: client.user.avatarURL(),
        });

      // USE message.channel.send instead of message.channel.send to avoid the reply link
      await message.channel.send({ embeds: [embed] });
      
      logger.info(`Status command used by ${message.author.tag}`);
    } catch (error) {
      logger.error("Error in status command:", error.message);
      await message.channel.send("❌ An error occurred while fetching status.");
    }
  },

  getBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  },
};