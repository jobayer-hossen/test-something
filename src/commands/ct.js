const CommandTracker = require('../database/schemas/CommandTracker');
const Logger = require('../logger');

const logger = new Logger('CtCommand');

const COMMAND_INFO = {
  id: 'legendary_toothbrush',
  label: '🪥 RPG Use Legendary Toothbrush'
};

module.exports = {
  name: 'ct',
  description: 'Check legendary toothbrush leaderboard',

  async execute(message, args, client) {
    try {
      await sendLeaderboard(message, COMMAND_INFO);
    } catch (err) {
      logger.error("Error in ct command:", err);
      await message.channel.send("❌ Something went wrong. Please try again.");
    }
  }
};

async function sendLeaderboard(message, commandInfo) {
  const now = new Date();

  // ✅ Today's date string
  const today = now.toISOString().split('T')[0];

  // ✅ Total usage today (sum of all counts)
  const totalResult = await CommandTracker.aggregate([
    {
      $match: {
        command: commandInfo.id,
        date: today
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' }
      }
    }
  ]);

  const totalToday = totalResult[0]?.total || 0;

  // ✅ Top 10 users today - just simple find and sort
  const top10 = await CommandTracker.find({
    command: commandInfo.id,
    date: today
  })
    .sort({ count: -1 })
    .limit(10)
    .lean();

  // Medal emojis
  const medals = ['🥇', '🥈', '🥉'];

  // Build leaderboard text
  let leaderboardText = '';

  if (top10.length === 0) {
    leaderboardText = '> No usage recorded today yet!';
  } else {
    top10.forEach((user, index) => {
      const medal = medals[index] || `**${index + 1}.**`;
      const name = user.displayName || user.username;
      leaderboardText += `${medal} **${name}** — \`${user.count}\` times\n`;
    });
  }

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const response =
    `${commandInfo.label} — **Today's Leaderboard**\n` +
    `📅 ${dateStr}\n` +
    `📊 Total Usage Today: **${totalToday}**\n\n` +
    `**🏆 Top 10 Users**\n` +
    leaderboardText +
    `\n_Data auto-deletes after 2 days_`;

  await message.channel.send({ content: response });
}