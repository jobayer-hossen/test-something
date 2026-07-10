const CommandTracker = require('../database/schemas/CommandTracker');
const Logger = require('../logger');

const logger = new Logger('EbCommand');

// ✅ Leaderboard shortcodes - add more in future
const COMMAND_SHORTCUTS = {
  'ct': {
    id: 'legendary_toothbrush',
    label: '🪥 RPG Use Legendary Toothbrush'
  }
  // Future:
  // 'tr': { id: 'coin_trumpet', label: '🎺 RPG Use Coin Trumpet' }
};

module.exports = {
  name: 'eb',
  description: 'Check command usage leaderboard',

  async execute(message, args, client) {
    try {
      // ✅ eb ct → check legendary toothbrush leaderboard
      const subCommand = args[0]?.toLowerCase();

      if (!subCommand) {
        return await sendHelpMessage(message);
      }

      const commandInfo = COMMAND_SHORTCUTS[subCommand];

      if (!commandInfo) {
        return await message.reply({
          content:
            `❌ Unknown shortcode \`${subCommand}\`\n\n` +
            `**Available shortcuts:**\n` +
            Object.entries(COMMAND_SHORTCUTS)
              .map(([key, val]) => `> \`eb ${key}\` → ${val.label}`)
              .join('\n')
        });
      }

      await sendLeaderboard(message, commandInfo);
    } catch (err) {
      logger.error('Error in eb command:', err);
      await message.reply('❌ Something went wrong. Please try again.');
    }
  }
};

// ✅ Send leaderboard embed
async function sendLeaderboard(message, commandInfo) {
  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Total usage today
  const totalToday = await CommandTracker.countDocuments({
    command: commandInfo.id,
    usedAt: { $gte: startOfDay, $lte: endOfDay }
  });

  // Top 10 users today
  const top10 = await CommandTracker.aggregate([
    {
      $match: {
        command: commandInfo.id,
        usedAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$userId',
        username: { $last: '$username' },
        displayName: { $last: '$displayName' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

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

  // Date string
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
    `\n_Data resets every 2 days automatically_`;

  await message.reply({ content: response });
}

// ✅ Help message
async function sendHelpMessage(message) {
  const shortcuts = Object.entries(COMMAND_SHORTCUTS)
    .map(([key, val]) => `> \`eb ${key}\` → ${val.label}`)
    .join('\n');

  await message.reply({
    content:
      `**📊 Command Usage Leaderboard**\n\n` +
      `**Usage:** \`eb <shortcode>\`\n\n` +
      `**Available Shortcuts:**\n` +
      shortcuts
  });
}