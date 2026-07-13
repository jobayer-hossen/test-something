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
      const loadingMsg = await message.channel.send(
        "⏳ Fetching system status...",
      );

      // ════════════════════════════════════════
      //           FETCH ALL MEMBERS
      // ════════════════════════════════════════
      let totalUsers = 0;
      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.members.fetch();
          const realMembers = guild.members.cache.filter(
            (m) => !m.user.bot,
          ).size;
          totalUsers += realMembers;
        } catch (err) {
          logger.warn(
            `Could not fetch members for ${guild.name}: ${err.message}`,
          );
          totalUsers += guild.memberCount || 0;
        }
      }

      // ════════════════════════════════════════
      //               UPTIME
      // ════════════════════════════════════════
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString =
        days > 0
          ? `${days}d ${hours}h ${minutes}m`
          : hours > 0
            ? `${hours}h ${minutes}m ${seconds}s`
            : `${minutes}m ${seconds}s`;

      // ════════════════════════════════════════
      //              CPU LOAD
      // ════════════════════════════════════════
      const cpuLoad = os.loadavg();
      const cpuCores = os.cpus().length;
      let cpuPercent = 0;

      if (cpuLoad && cpuLoad[0]) {
        cpuPercent = Math.min(Math.round((cpuLoad[0] / cpuCores) * 100), 100);
      } else {
        const cpuUsage = process.cpuUsage();
        cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000);
      }
      const cpuBar = this.getProgressBar(cpuPercent);

      // ════════════════════════════════════════
      //            MEMORY LOAD
      // ════════════════════════════════════════
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);
      const memBar = this.getProgressBar(memPercent);

      // ════════════════════════════════════════
      //            BOT MEMORY
      // ════════════════════════════════════════
      const botHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const botMax = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
      const botPercent = Math.round((botHeap / botMax) * 100);
      const botBar = this.getProgressBar(botPercent);

      // ════════════════════════════════════════
      //         NETWORK & LATENCY
      // ════════════════════════════════════════
      const ping = client.ws.ping;
      const pingStatus =
        ping < 100
          ? "🟢 Excellent"
          : ping < 200
            ? "🟡 Good"
            : ping < 300
              ? "🟠 Fair"
              : "🔴 Poor";

      // ════════════════════════════════════════
      //    MESSAGE ROUND-TRIP LATENCY
      // ════════════════════════════════════════
      const roundTrip = Date.now() - message.createdTimestamp;

      // ════════════════════════════════════════
      //           SHARD INFORMATION
      // ════════════════════════════════════════
      const shardInfo = this.getShardInfo(client);

      // ════════════════════════════════════════
      //            BOT STATS
      // ════════════════════════════════════════
      const totalGuilds = client.guilds.cache.size;
      const totalChannels = client.channels.cache.size;
      const commandCount = client.commands ? client.commands.size : 0;

      // ════════════════════════════════════════
      //           BUILD EMBED
      // ════════════════════════════════════════
      const embed = new EmbedBuilder()
        .setColor("#00ff62")
        .setTitle("🤖 Epic Bot — System Dashboard")
        .setThumbnail(client.user.avatarURL())
        .addFields(
          // ── Row 1: Network (full width) ──
          {
            name: "📡 Network & Latency",
            value: [
              `**WebSocket Ping** : \`${ping}ms\` ${pingStatus}`,
              `**Round-Trip**     : \`${roundTrip}ms\``,
              `**Uptime**         : \`${uptimeString}\``,
            ].join("\n"),
            inline: false,
          },

          // ── Row 2: Bot Stats | CPU | Memory ──
          {
            name: "📊 Bot Statistics",
            value: [
              `**Users**    : \`${totalUsers.toLocaleString()}\``,
              `**Servers**  : \`${totalGuilds}\``,
              `**Channels** : \`${totalChannels}\``,
              `**Commands** : \`${commandCount}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🔥 CPU Load",
            value: [
              `**Usage** : \`${cpuPercent}%\``,
              `${cpuBar}`,
              `**Cores** : \`${cpuCores}\``,
              `**Avg**   : \`${cpuLoad.map((l) => l.toFixed(2)).join(" / ")}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "💾 Memory",
            value: [
              `**System** : \`${usedMem}GB / ${totalMem}GB\``,
              `${memBar} \`${memPercent}%\``,
              `**Bot**    : \`${botHeap}MB / ${botMax}MB\``,
              `${botBar} \`${botPercent}%\``,
            ].join("\n"),
            inline: true,
          },

          // ── Row 3: Shard (full width) ──
          {
            name: "🔌 Gateway & Shard Status",
            value: shardInfo,
            inline: false,
          },
        )
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      await loadingMsg.delete();
      await message.channel.send({ embeds: [embed] });

      logger.info(
        `Status command used by ${message.author.tag} (${message.author.id})`,
      );
    } catch (error) {
      logger.error("Error in status command:", error);
      await message.channel
        .send("❌ Failed to retrieve system status. Please try again.")
        .catch(() => {});
    }
  },

  // ════════════════════════════════════════
  //         SHARD INFO BUILDER
  // ════════════════════════════════════════
  getShardInfo(client) {
    try {
      const ws = client.ws;
      const shards = ws.shards;

      const statusMap = {
        0: "🟢 Ready",
        1: "🟡 Connecting",
        2: "🟡 Reconnecting",
        3: "⚫ Idle",
        4: "🟠 Nearly",
        5: "🔴 Disconnected",
        6: "🟢 Waiting for Guilds",
        7: "🟡 Identifying",
        8: "🟡 Resuming",
      };

      // ✅ Single shard (no ShardingManager)
      if (!shards || shards.size === 0) {
        const statusLabel = statusMap[ws.status ?? 0] ?? "❓ Unknown";
        const pingStr = ws.ping === -1 ? "N/A" : `${ws.ping}ms`;
        const seqStr = ws.sequence ?? "N/A";
        const sessionStr = ws.sessionId
          ? `${ws.sessionId.substring(0, 12)}...`
          : "N/A";
        const gatewayStr = ws.gateway
          ? ws.gateway.split("?")[0].replace("wss://", "")
          : "N/A";

        return [
          `**Total Shards** : \`1\` | **Shard 0** : ${statusLabel} | \`${pingStr}\` | Seq: \`${seqStr}\``,
          `**Session** : \`${sessionStr}\` | **Gateway** : \`${gatewayStr}\``,
        ].join("\n");
      }

      // ✅ Multiple shards - one line each
      const lines = [`**Total Shards** : \`${shards.size}\``];

      for (const [id, shard] of shards) {
        const statusLabel = statusMap[shard.status ?? 0] ?? "❓ Unknown";
        const pingStr = shard.ping === -1 ? "N/A" : `${shard.ping}ms`;
        const seqStr = shard.sequence ?? "N/A";

        lines.push(
          `**Shard ${id}** : ${statusLabel} | \`${pingStr}\` | Seq: \`${seqStr}\``,
        );
      }

      return lines.join("\n");
    } catch (err) {
      logger.warn("Could not get shard info:", err.message);
      return "❌ Could not retrieve shard information";
    }
  },

  // ════════════════════════════════════════
  //           PROGRESS BAR
  // ════════════════════════════════════════
  getProgressBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  },
};
