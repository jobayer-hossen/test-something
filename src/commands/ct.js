const { EmbedBuilder } = require("discord.js");
const CommandTracker = require("../database/schemas/CommandTracker");
const Logger = require("../logger");

const logger = new Logger("CtCommand");

const COMMAND_INFO = {
  id: "legendary_toothbrush",
  label: "🪥 Legendary Toothbrush",
  emoji: "🪥",
  color: 0x00d9ff, // Cyan blue color
};

module.exports = {
  name: "ct",
  description: "Check legendary toothbrush leaderboard",

  async execute(message, args, client) {
    try {
      // Parse arguments
      const daysArg = args[0];
      let days = 1; // Default: today only

      if (daysArg) {
        const match = daysArg.match(/^(\d+)d$/i);
        if (match) {
          days = parseInt(match[1]);
          if (days < 1 || days > 365) {
            return message.channel.send(
              "❌ Please specify between 1d and 365d",
            );
          }
        } else {
          return message.channel.send(
            "❌ Invalid format. Use: `eb ct` or `eb ct 20d`",
          );
        }
      }

      if (days === 1) {
        await sendTodayLeaderboard(message, COMMAND_INFO);
      } else {
        await sendRangeLeaderboard(message, COMMAND_INFO, days);
      }
    } catch (err) {
      logger.error("Error in ct command:", err);
      await message.channel.send("❌ Something went wrong. Please try again.");
    }
  },
};

// ✅ Today's leaderboard
async function sendTodayLeaderboard(message, commandInfo) {
  const today = getTodayString();

  // Total usage today
  const totalResult = await CommandTracker.aggregate([
    {
      $match: {
        command: commandInfo.id,
        date: today,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$count" },
        uniqueUsers: { $sum: 1 },
      },
    },
  ]);

  const stats = totalResult[0] || { total: 0, uniqueUsers: 0 };

  // Top 10 users today
  const top10 = await CommandTracker.find({
    command: commandInfo.id,
    date: today,
  })
    .sort({ count: -1 })
    .limit(10)
    .lean();

  const embed = new EmbedBuilder()
    .setColor(commandInfo.color)
    .setTitle(`${commandInfo.label} — Today's Leaderboard`)
    .setDescription(buildTodayDescription(stats, top10))
    .setFooter({ text: `📅 ${formatDate(new Date())}` })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

// ✅ Last X days leaderboard
async function sendRangeLeaderboard(message, commandInfo, days) {
  const dates = getLastNDays(days);

  // Get all data for these dates
  const allData = await CommandTracker.find({
    command: commandInfo.id,
    date: { $in: dates },
  }).lean();

  // Aggregate by user
  const userTotals = new Map();

  for (const record of allData) {
    const existing = userTotals.get(record.userId) || {
      userId: record.userId,
      username: record.username,
      displayName: record.displayName,
      total: 0,
    };
    existing.total += record.count;
    userTotals.set(record.userId, existing);
  }

  // Sort and get top 10
  const top10 = Array.from(userTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const totalUsage = Array.from(userTotals.values()).reduce(
    (sum, user) => sum + user.total,
    0,
  );

  const uniqueUsers = userTotals.size;

  const embed = new EmbedBuilder()
    .setColor(commandInfo.color)
    .setTitle(`${commandInfo.emoji} ${commandInfo.label} — Last ${days} Days`)
    .setDescription(buildRangeDescription(totalUsage, uniqueUsers, top10, days))
    .setFooter({
      text: `📅 ${formatDate(new Date(dates[dates.length - 1]))} to ${formatDate(new Date())}`,
    })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

// ✅ Build today's description
function buildTodayDescription(stats, top10) {
  let description = `📊 **Total Usage:** ${stats.total.toLocaleString()}\n`;
  description += `👥 **Unique Users:** ${stats.uniqueUsers}\n`;

  description += "**🏆 Top 10 Users**\n\n";

  if (top10.length === 0) {
    description += "```\nNo usage recorded today yet!\n```";
    return description;
  }

  const medals = ["🥇", "🥈", "🥉"];

  top10.forEach((user, index) => {
    const medal = medals[index] || `\`${String(index + 1).padStart(2, "0")}\``;
    const name = (user.displayName || user.username).substring(0, 20);
    const count = user.count.toLocaleString().padStart(2, " ");

    description += `${medal} **${name}** — 🪥**${user.count}** \n`;
  });

  return description;
}

// ✅ Build range description
function buildRangeDescription(total, uniqueUsers, top10, days) {
  let description = `📊 **Total Usage:** ${total.toLocaleString()}\n`;
  description += `👥 **Unique Users:** ${uniqueUsers}\n`;
  description += `📈 **Average/Day:** ${Math.round(total / days).toLocaleString()}\n\n`;

  if (top10.length === 0) {
    description += "```\nNo usage recorded in this period!\n```";
    return description;
  }

  description += "**🏆 Top 10 Users**\n";

  const medals = ["🥇", "🥈", "🥉"];

  top10.forEach((user, index) => {
    const medal = medals[index] || `\`${String(index + 1).padStart(2, "0")}\``;
    const name = (user.displayName || user.username).substring(0, 20);
    const count = user.total.toLocaleString().padStart(6, " ");
    const avg = Math.round(user.total / days);

    description += `${medal} **${name}** \`${count}x\` _(~${avg}/day)_\n`;
  });

  return description;
}

// ✅ Helper: Get today's date string
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// ✅ Helper: Get last N days as date strings
function getLastNDays(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

// ✅ Helper: Format date nicely
function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
