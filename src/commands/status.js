const { EmbedBuilder } = require("discord.js");
const os = require("os");
const Logger = require("../logger");

const logger = new Logger("StatusCommand");

module.exports = {
  name: "status",
  aliases: ["st"],
  description: "Check bot status and system metrics",

  async execute(message, args, client) {
    try {
      const loadingMsg = await message.channel.send("⏳ Fetching system status...");

      // ========== NETWORK SPEED CALCULATION (sample twice) ==========
      const netBefore = this.getNetworkBytes();
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 sec
      const netAfter = this.getNetworkBytes();

      const inboundSpeed = (netAfter.rx - netBefore.rx) / 1024; // KB/s
      const outboundSpeed = (netAfter.tx - netBefore.tx) / 1024; // KB/s

      // ========== FETCH ALL MEMBERS ==========
      let totalUsers = 0;
      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.members.fetch();
          const realMembers = guild.members.cache.filter(m => !m.user.bot).size;
          totalUsers += realMembers;
        } catch (err) {
          logger.warn(`Could not fetch members for ${guild.name}: ${err.message}`);
          totalUsers += guild.memberCount || 0;
        }
      }

      // ========== UPTIME ==========
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;

      // ========== CPU LOAD ==========
      const cpuLoad = os.loadavg(); // [1min, 5min, 15min] - Linux/Mac only
      const cpuCores = os.cpus().length;
      let cpuPercent = 0;
      
      if (cpuLoad && cpuLoad[0]) {
        cpuPercent = Math.min(Math.round((cpuLoad[0] / cpuCores) * 100), 100);
      } else {
        // Fallback for Windows - use process CPU (not system-wide)
        const cpuUsage = process.cpuUsage();
        cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000);
      }
      const cpuBar = this.getProgressBar(cpuPercent);

      // ========== MEMORY LOAD ==========
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);
      const memBar = this.getProgressBar(memPercent);

      // ========== BOT MEMORY ==========
      const botHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const botMax = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
      const botPercent = Math.round((botHeap / botMax) * 100);
      const botBar = this.getProgressBar(botPercent);

      // ========== NETWORK & LATENCY ==========
      const ping = client.ws.ping;
      const pingStatus = ping < 100 ? "🟢 Excellent" : ping < 200 ? "🟡 Good" : ping < 300 ? "🟠 Fair" : "🔴 Poor";

      // ========== BOT STATS ==========
      const totalGuilds = client.guilds.cache.size;
      const totalChannels = client.channels.cache.size;
      const commandCount = client.commands ? client.commands.size : 0;

      // ========== SYSTEM INFO ==========
      const platform = os.platform();
      const platformIcon = platform === "linux" ? "🐧" : platform === "win32" ? "🪟" : platform === "darwin" ? "🍎" : "💻";
      const nodeVersion = process.version;
      const discordJsVersion = require("discord.js").version;
      const cpuModel = os.cpus()[0]?.model || "Unknown";

      // ========== BUILD EMBED ==========
      const embed = new EmbedBuilder()
        .setColor("#00ff62")
        .setTitle("🤖 Epic Bot — System Dashboard")
        .setThumbnail(client.user.avatarURL())
        .addFields(
          {
            name: "📡 Network & Latency",
            value: [
              `**WebSocket Ping**: \`${ping}ms\` ${pingStatus}`,
              `**⬇️ Inbound**: \`${inboundSpeed.toFixed(2)} KB/s\``,
              `**⬆️ Outbound**: \`${outboundSpeed.toFixed(2)} KB/s\``,
              `**Uptime**: \`${uptimeString}\``,
            ].join("\n"),
            inline: false,
          },
          {
            name: "📊 Bot Statistics",
            value: [
              `**Users**: \`${totalUsers.toLocaleString()}\``,
              `**Servers**: \`${totalGuilds}\``,
              `**Channels**: \`${totalChannels}\``,
              `**Commands**: \`${commandCount}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🔥 CPU Load",
            value: [
              `**Usage**: \`${cpuPercent}%\``,
              `${cpuBar}`,
              `**Cores**: \`${cpuCores}\``,
              `**Load Avg**: \`${cpuLoad ? cpuLoad.map(l => l.toFixed(2)).join(" / ") : "N/A"}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "💾 Memory Usage",
            value: [
              `**System**: \`${usedMem}GB / ${totalMem}GB\``,
              `${memBar} \`${memPercent}%\``,
              `**Bot Heap**: \`${botHeap}MB / ${botMax}MB\``,
              `${botBar} \`${botPercent}%\``,
            ].join("\n"),
            inline: true,
          },
        )
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      await loadingMsg.delete();
      await message.channel.send({ embeds: [embed] });

      logger.info(`Status command executed by ${message.author.tag} (${message.author.id})`);
    } catch (error) {
      logger.error("Error in status command:", error);
      await message.channel.send("❌ Failed to retrieve system status. Please try again.");
    }
  },

  // ✅ Get network bytes from all interfaces
  getNetworkBytes() {
    const nets = os.networkInterfaces();
    let rx = 0, tx = 0;

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (!net.internal) {
          rx += net.rx || 0;
          tx += net.tx || 0;
        }
      }
    }

    return { rx, tx };
  },

  // ✅ Progress bar
  getProgressBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  },

};