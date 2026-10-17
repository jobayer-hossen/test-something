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
      let fetchErrors = 0;
      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.members.fetch();
          const realMembers = guild.members.cache.filter(
            (m) => !m.user.bot,
          ).size;
          totalUsers += realMembers;
        } catch (err) {
          fetchErrors++;
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
      const cpuWarning =
        cpuPercent > 80 ? "⚠️ **High CPU usage**" : cpuPercent > 60 ? "⚡ Moderate" : "✅ Normal";

      // ════════════════════════════════════════
      //            MEMORY LOAD
      // ════════════════════════════════════════
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);
      const memBar = this.getProgressBar(memPercent);
      const memWarning =
        memPercent > 80 ? "⚠️ **High memory usage**" : memPercent > 60 ? "⚡ Moderate" : "✅ Normal";

      // ════════════════════════════════════════
      //            BOT MEMORY
      // ════════════════════════════════════════
      const botHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const botMax = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
      const botPercent = Math.round((botHeap / botMax) * 100);
      const botBar = this.getProgressBar(botPercent);
      const botMemWarning =
        botPercent > 90
          ? "⚠️ **Critical bot memory**"
          : botPercent > 75
            ? "⚡ High"
            : "✅ Normal";

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
      //        BOT PERMISSIONS & HEALTH
      // ════════════════════════════════════════
      const botHealth = this.getBotHealth(client);
      const ratelimitStatus = this.getRateLimitStatus(client);
      const hostInfo = this.getHostInfo();

      // ════════════════════════════════════════
      //        ERROR & WARNING TRACKING
      // ════════════════════════════════════════
      const errorStats = this.getErrorStats(client);

      // ════════════════════════════════════════
      //        GUILD RESTRICTIONS CHECK
      // ════════════════════════════════════════
      const restrictionStats = this.checkGuildRestrictions(client);

      // ════════════════════════════════════════
      //           BUILD EMBED
      // ════════════════════════════════════════
      const embed = new EmbedBuilder()
        .setColor(botHealth.color)
        .setTitle("🤖 Epic Bot — System Dashboard")
        .setThumbnail(client.user.avatarURL())
        .addFields(
          // ── Row 1: Bot Health Status ──
          {
            name: "💚 Bot Health Status",
            value: botHealth.status,
            inline: false,
          },

          // ── Row 2: Network (full width) ──
          {
            name: "📡 Network & Latency",
            value: [
              `**WebSocket Ping** : \`${ping}ms\` ${pingStatus}`,
              `**Round-Trip**     : \`${roundTrip}ms\``,
              `**Uptime**         : \`${uptimeString}\``,
            ].join("\n"),
            inline: false,
          },

          // ── Row 3: Bot Stats | CPU | Memory ──
          {
            name: "📊 Bot Statistics",
            value: [
              `**Users**         : \`${totalUsers.toLocaleString()}\``,
              `**Servers**       : \`${totalGuilds}\``,
              `**Channels**      : \`${totalChannels}\``,
              `**Commands**      : \`${commandCount}\``,
              `**Fetch Errors**  : \`${fetchErrors}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🔥 CPU Load",
            value: [
              `**Usage** : \`${cpuPercent}%\` ${cpuWarning}`,
              `${cpuBar}`,
              `**Cores** : \`${cpuCores}\``,
              `**Avg**   : \`${cpuLoad.map((l) => l.toFixed(2)).join(" / ")}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "💾 Memory",
            value: [
              `**System** : \`${usedMem}GB / ${totalMem}GB\` ${memWarning}`,
              `${memBar} \`${memPercent}%\``,
              `**Bot**    : \`${botHeap}MB / ${botMax}MB\` ${botMemWarning}`,
              `${botBar} \`${botPercent}%\``,
            ].join("\n"),
            inline: true,
          },

          // ── Row 4: Shard (full width) ──
          {
            name: "🔌 Gateway & Shard Status",
            value: shardInfo,
            inline: false,
          },

          // ── Row 5: Rate Limit Status ──
          {
            name: "⚡ Rate Limit Status",
            value: ratelimitStatus,
            inline: false,
          },

          // ── Row 6: Host Information ──
          {
            name: "🖥️ Host Information",
            value: hostInfo,
            inline: true,
          },

          // ── Row 7: Error Statistics ──
          {
            name: "⚠️ Error Statistics",
            value: errorStats,
            inline: true,
          },

          // ── Row 8: Guild Restrictions ──
          {
            name: "🔒 Guild Restrictions",
            value: restrictionStats,
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
  //         BOT HEALTH CHECK
  // ════════════════════════════════════════
  getBotHealth(client) {
    const checks = {
      ready: client.isReady(),
      connected: client.ws.status === 0,
      noMissedHeartbeats: client.ws.lastHeartbeatAcked,
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const healthPercent = Math.round((passedChecks / totalChecks) * 100);

    let status = `**Health Score:** \`${healthPercent}%\`\n`;
    status += `**Ready State:** ${checks.ready ? "✅ Ready" : "❌ Not Ready"}\n`;
    status += `**Connected:** ${checks.connected ? "✅ Connected" : "❌ Disconnected"}\n`;
    status += `**Heartbeat:** ${checks.noMissedHeartbeats ? "✅ ACK" : "❌ Missed"}`;

    const color =
      healthPercent === 100
        ? "#00ff62"
        : healthPercent >= 75
          ? "#FFD700"
          : "#FF6B6B";

    return { status, color, healthPercent };
  },

  // ════════════════════════════════════════
  //       RATE LIMIT STATUS
  // ════════════════════════════════════════
  getRateLimitStatus(client) {
    try {
      const rest = client.rest;
      const globalRemaining = rest.globalRemaining ?? "N/A";
      const globalReset = rest.globalReset ?? 0;

      let status = `**Global Requests:** \`${globalRemaining}\`\n`;

      if (globalReset) {
        const resetTime = new Date(globalReset);
        status += `**Global Reset:** <t:${Math.floor(globalReset / 1000)}:R>\n`;
      }

      status += `**API Version:** \`${client.options.rest.version || "10"}\`\n`;
      status += `**Request Status:** ✅ Normal`;

      return status;
    } catch (err) {
      logger.warn("Could not get rate limit status:", err.message);
      return "❌ Could not retrieve rate limit information";
    }
  },

  // ════════════════════════════════════════
  //       HOST INFORMATION
  // ════════════════════════════════════════
  getHostInfo() {
    try {
      const platform = os.platform();
      const arch = os.arch();
      const nodeVersion = process.version;
      const uptime = Math.floor(os.uptime() / 86400); // days

      return [
        `**Platform:** \`${platform}\` (\`${arch}\`)`,
        `**Node.js:** \`${nodeVersion}\``,
        `**Host Uptime:** \`${uptime} days\``,
        `**Total RAM:** \`${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB\``,
      ].join("\n");
    } catch (err) {
      logger.warn("Could not get host info:", err.message);
      return "❌ Could not retrieve host information";
    }
  },

  // ════════════════════════════════════════
  //       ERROR STATISTICS
  // ════════════════════════════════════════
  getErrorStats(client) {
    // Track errors in client.errorCount (you need to initialize this)
    if (!client.errorCount) {
      client.errorCount = {
        total: 0,
        interactions: 0,
        commands: 0,
        messages: 0,
        other: 0,
      };
    }

    const errors = client.errorCount;

    return [
      `**Total Errors:** \`${errors.total}\``,
      `**Interaction Errors:** \`${errors.interactions}\``,
      `**Command Errors:** \`${errors.commands}\``,
      `**Message Errors:** \`${errors.messages}\``,
      `**Other:** \`${errors.other}\``,
    ].join("\n");
  },

  // ════════════════════════════════════════
  //    CHECK GUILD RESTRICTIONS
  // ════════════════════════════════════════
  checkGuildRestrictions(client) {
    let restrictedGuilds = 0;
    let noBotRoleGuilds = 0;
    let noPermGuilds = 0;

    const { PermissionFlagsBits } = require("discord.js");

    for (const guild of client.guilds.cache.values()) {
      try {
        const botMember = guild.members.me;
        if (!botMember) {
          noBotRoleGuilds++;
          continue;
        }

        // Check critical permissions
        const requiredPerms = [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageRoles,
          PermissionFlagsBits.ModerateMembers,
        ];

        const hasAllPerms = requiredPerms.every((perm) =>
          botMember.permissions.has(perm),
        );

        if (!hasAllPerms) {
          noPermGuilds++;
        }

        // Check if bot role is too low
        if (botMember.roles.highest.position < 1) {
          restrictedGuilds++;
        }
      } catch (err) {
        logger.debug(`Could not check permissions for guild: ${err.message}`);
      }
    }

    return [
      `**Restricted Guilds:** \`${restrictedGuilds}\``,
      `**Missing Role:** \`${noBotRoleGuilds}\``,
      `**Missing Perms:** \`${noPermGuilds}\``,
      `**Status:** ${restrictedGuilds > 0 || noPermGuilds > 0 ? "⚠️ Attention needed" : "✅ All good"}`,
    ].join("\n");
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