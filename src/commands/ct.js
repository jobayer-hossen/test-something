const { EmbedBuilder } = require("discord.js");
const CommandTracker = require("../database/schemas/CommandTracker");
const Logger = require("../logger");

const logger = new Logger("CtCommand");

const COMMAND_INFO = {
  id: "legendary_toothbrush",
  label: "🪥 Legendary Toothbrush",
  color: 0x00d9ff,
};

module.exports = {
  name: "ct",
  description: "Check legendary toothbrush leaderboard",

  async execute(message, args, client) {
    try {
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

// ════════════════════════════════════════════
//           TODAY'S LEADERBOARD
// ════════════════════════════════════════════
async function sendTodayLeaderboard(message, commandInfo) {
  const today = getTodayString();

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

// ════════════════════════════════════════════
//        RANGE LEADERBOARD (X days)
// ════════════════════════════════════════════
async function sendRangeLeaderboard(message, commandInfo, days) {
  const dates = getLastNDays(days);

  const allData = await CommandTracker.find({
    command: commandInfo.id,
    date: { $in: dates },
  }).lean();

  const last2Dates = dates.slice(0, 2);

  const userMap = new Map();

  for (const record of allData) {
    const existing = userMap.get(record.userId) || {
      userId: record.userId,
      username: record.username,
      displayName: record.displayName,
      total: 0,
      dailyBreakdown: {},
    };

    existing.total += record.count;

    if (last2Dates.includes(record.date)) {
      existing.dailyBreakdown[record.date] = record.count;
    }

    userMap.set(record.userId, existing);
  }

  // ✅ ALL users sorted (no .slice(0, 10) limit)
  const allUsers = Array.from(userMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  const totalUsage = allUsers.reduce((sum, user) => sum + user.total, 0);
  const uniqueUsers = userMap.size;

  const embed = new EmbedBuilder()
    .setColor(commandInfo.color)
    .setTitle(`${commandInfo.label} — Last ${days} Days`)
    .setDescription(
      buildRangeDescription(
        totalUsage,
        uniqueUsers,
        allUsers,
        days,
        last2Dates,
      ),
    )
    .setFooter({
      text: `📅 ${formatDate(new Date(dates[dates.length - 1]))} to ${formatDate(new Date())} • ${uniqueUsers} user(s)`,
    })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

// ════════════════════════════════════════════
//        BUILD RANGE DESCRIPTION
// ════════════════════════════════════════════
function buildRangeDescription(total, uniqueUsers, allUsers, days, last2Dates) {
  let description = `📊 **Total Usage:** ${total.toLocaleString()}\n`;
  // ✅ Show "All X Users" instead of "Top 10 Users"
  description += `**🏆 All ${uniqueUsers} User${uniqueUsers !== 1 ? "s" : ""}**\n\n`;

  if (allUsers.length === 0) {
    description += "```\nNo usage recorded in this period!\n```";
    return description;
  }

  const medals = ["🥇", "🥈", "🥉"];

  const dateLabel0 = formatDateShort(last2Dates[0]);
  const dateLabel1 = last2Dates[1] ? formatDateShort(last2Dates[1]) : null;

  allUsers.forEach((user, index) => {
    const medal = medals[index] || `\`${String(index + 1).padStart(2, "0")}\``;
    const name = (user.displayName || user.username).substring(0, 20);
    const totalCount = user.total.toLocaleString();

    let breakdown = "";

    if (last2Dates.length >= 1) {
      const count0 = user.dailyBreakdown[last2Dates[0]] || 0;

      if (last2Dates.length >= 2 && dateLabel1) {
        const count1 = user.dailyBreakdown[last2Dates[1]] || 0;
        breakdown = ` _(${dateLabel0}: **${count0.toLocaleString()}** | ${dateLabel1}: **${count1.toLocaleString()}**)_`;
      } else {
        breakdown = ` _(${dateLabel0}: **${count0.toLocaleString()}**)_`;
      }
    }

    description += `${medal} **${name}** — 🪥**${totalCount}**${breakdown}\n`;
  });

  // ✅ Discord embed description limit is 4096 chars - warn if close
  if (description.length > 3900) {
    description =
      description.substring(0, 3900) + "\n`... and more (too many to display)`";
  }

  return description;
}

// ════════════════════════════════════════════
//         BUILD TODAY DESCRIPTION
// ════════════════════════════════════════════
function buildTodayDescription(stats, top10) {
  let description = `📊 **Total Usage:** ${stats.total.toLocaleString()}\n`;
  description += `**🏆 Today's Top Users**\n\n`;

  if (top10.length === 0) {
    description += "```\nNo usage recorded today yet!\n```";
    return description;
  }

  const medals = ["🥇", "🥈", "🥉"];

  top10.forEach((user, index) => {
    const medal = medals[index] || `\`${String(index + 1).padStart(2, "0")}\``;
    const name = (user.displayName || user.username).substring(0, 20);

    description += `${medal} **${name}** — 🪥**${user.count.toLocaleString()}**\n`;
  });

  return description;
}

// ════════════════════════════════════════════
//              DATE HELPERS
// ════════════════════════════════════════════

// "2026-07-11" → today's date string
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// Get last N days as ["2026-07-12", "2026-07-11", ...]
// index 0 = today (most recent), last index = oldest
function getLastNDays(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

// "Dec 25, 2026" format
function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ✅ NEW: "Jul 11" short format for breakdown labels
// Input: "2026-07-11" string
function formatDateShort(dateString) {
  // Parse as UTC to avoid timezone shift
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
