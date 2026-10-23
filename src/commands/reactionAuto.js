const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const MentionReaction = require('../database/schemas/MentionReaction');

// ══════════════════════════════════════════
// INLINE PARSERS
// ══════════════════════════════════════════

function parseEmojiInput(message, input) {
  if (!input) return { valid: false, reason: 'No emoji provided.' };

  const customMatch = input.match(/^<(a?):(\w+):(\d+)>$/);
  if (customMatch) {
    const [, , , id] = customMatch;
    // Only allow emojis from THIS server, not globally cached ones from other guilds
    const emoji = message.guild.emojis.cache.get(id);
    if (!emoji) {
      return {
        valid: false,
        reason: "That emoji must be from this server. I can't use emojis from other servers for reactions.",
      };
    }
    return { valid: true, raw: input };
  }

  const unicodeEmojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)+$/u;
  if (unicodeEmojiRegex.test(input) && input.length <= 8) {
    return { valid: true, raw: input };
  }

  return { valid: false, reason: "That doesn't look like a valid emoji." };
}

function parseGifOrImageUrl(input) {
  try {
    const url = new URL(input);
    const validHosts = [
      'tenor.com', 'giphy.com', 'media.giphy.com', 'media.tenor.com',
      'cdn.discordapp.com', 'media.discordapp.net', 'imgur.com', 'i.imgur.com',
    ];
    const validExtensions = ['.gif', '.png', '.jpg', '.jpeg', '.webp'];

    const hasValidExtension = validExtensions.some((ext) =>
      url.pathname.toLowerCase().endsWith(ext)
    );
    const hasValidHost = validHosts.some((host) => url.hostname.includes(host));

    if (hasValidExtension || hasValidHost) {
      return { valid: true, url: input };
    }
    return { valid: false, reason: "That doesn't look like a valid image/gif link." };
  } catch (err) {
    return { valid: false, reason: "That's not a valid URL." };
  }
}

// Helper to always reply without pinging the command author
function silentReply(message, content) {
  return message.reply({
    ...(typeof content === 'string' ? { content } : content),
    allowedMentions: { repliedUser: false },
  });
}

// ══════════════════════════════════════════
// COMMAND
// ══════════════════════════════════════════

module.exports = {
  name: 'ra',
  aliases: ['reactionauto', 'autoreact'],
  description: 'Manage auto-react/auto-respond on mentions (Admin only)',

  async execute(message, args, client) {
    // ── Admin-only guard ──
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return silentReply(message, '❌ Only server administrators can use this command.');
    }

    const subcommand = args[0]?.toLowerCase();
    const validSubcommands = ['set', 'edit', 'remove', 'list', 'view'];

    if (!subcommand || !validSubcommands.includes(subcommand)) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Reaction Auto — Command Help')
        .setDescription(
          '`eb ra set react <emoji> [@user]` — set the reaction for when a user is mentioned\n' +
          '`eb ra set respond <emoji/gif link> [@user]` — set the auto-response for when a user is mentioned\n' +
          '`eb ra edit react <emoji> [@user]` — edit an existing reaction\n' +
          '`eb ra edit respond <emoji/gif link> [@user]` — edit an existing response\n' +
          '`eb ra remove react [@user]` — remove reaction setting\n' +
          '`eb ra remove respond [@user]` — remove response setting\n' +
          '`eb ra remove all [@user]` — remove both settings\n' +
          '`eb ra view [@user]` — view a user\'s current settings\n' +
          '`eb ra list` — list all configured users\n\n' +
          '*If no user is mentioned, it defaults to yourself.*\n' +
          '*Custom emojis must be from this server.*'
        );
      return silentReply(message, { embeds: [embed] });
    }

    // ── LIST ──
    if (subcommand === 'list') {
      const all = await MentionReaction.find({
        $or: [{ reactEmoji: { $ne: null } }, { respondContent: { $ne: null } }],
      }).lean();

      if (all.length === 0) {
        return silentReply(message, 'No mention react/respond settings are configured yet.');
      }

      const lines = all.map((entry) => {
        const react = entry.reactEmoji || '—';
        const respond = entry.respondContent || '—';
        return `<@${entry.userId}> → React: ${react} | Respond: ${respond}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Configured Mention Reactions/Responses')
        .setDescription(lines.join('\n').slice(0, 4000));

      return silentReply(message, { embeds: [embed] });
    }

    // ── VIEW ──
    if (subcommand === 'view') {
      const targetUser = message.mentions.users.first() || message.author;

      if (targetUser.bot) {
        return silentReply(message, '❌ Bots cannot have mention react/respond settings.');
      }

      const settings = await MentionReaction.findOne({ userId: targetUser.id }).lean();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Mention Settings — ${targetUser.username}`)
        .addFields(
          { name: 'React Emoji', value: settings?.reactEmoji || 'Not set', inline: true },
          { name: 'Respond Content', value: settings?.respondContent || 'Not set', inline: true }
        );

      return silentReply(message, { embeds: [embed] });
    }

    // ── SET / EDIT (same logic) ──
    if (subcommand === 'set' || subcommand === 'edit') {
      const type = args[1]?.toLowerCase();

      if (!type || !['react', 'respond'].includes(type)) {
        return silentReply(
          message,
          `Usage: \`eb ra ${subcommand} react <emoji> [@user]\` or \`eb ra ${subcommand} respond <emoji/gif link> [@user]\``
        );
      }

      const targetUser = message.mentions.users.first() || message.author;

      if (targetUser.bot) {
        return silentReply(message, '❌ You cannot set mention react/respond for a bot account.');
      }

      let valueArgs = args.slice(2);
      if (message.mentions.users.size > 0) {
        valueArgs = valueArgs.filter((a) => !a.includes(targetUser.id));
      }
      const value = valueArgs.join(' ').trim();

      if (!value) {
        return silentReply(
          message,
          `Please provide ${type === 'react' ? 'an emoji' : 'an emoji or gif/image link'} to set.`
        );
      }

      if (subcommand === 'edit') {
        const existing = await MentionReaction.findOne({ userId: targetUser.id }).lean();
        const hasExisting = type === 'react' ? existing?.reactEmoji : existing?.respondContent;
        if (!hasExisting) {
          return silentReply(
            message,
            `${targetUser.username} doesn't have a ${type} setting yet. Use \`eb ra set\` instead.`
          );
        }
      }

      if (type === 'react') {
        const parsed = parseEmojiInput(message, value);
        if (!parsed.valid) {
          return silentReply(message, `❌ ${parsed.reason}`);
        }

        await MentionReaction.findOneAndUpdate(
          { userId: targetUser.id },
          {
            $set: {
              reactEmoji: parsed.raw,
              setBy: message.author.id,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        return silentReply(
          message,
          `✅ Reaction ${parsed.raw} will now be used when **${targetUser.username}** is mentioned.`
        );
      }

      if (type === 'respond') {
        const emojiParsed = parseEmojiInput(message, value);
        let respondType, respondContent;

        if (emojiParsed.valid) {
          respondType = 'emoji';
          respondContent = emojiParsed.raw;
        } else {
          const urlParsed = parseGifOrImageUrl(value);
          if (!urlParsed.valid) {
            return silentReply(message, "❌ That's not a valid emoji or gif/image link.");
          }
          respondType = 'gif';
          respondContent = urlParsed.url;
        }

        await MentionReaction.findOneAndUpdate(
          { userId: targetUser.id },
          {
            $set: {
              respondContent,
              respondType,
              setBy: message.author.id,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        return silentReply(
          message,
          `✅ Auto-response set for when **${targetUser.username}** is mentioned.`
        );
      }
    }

    // ── REMOVE ──
    if (subcommand === 'remove') {
      const type = args[1]?.toLowerCase();

      if (!type || !['react', 'respond', 'all'].includes(type)) {
        return silentReply(
          message,
          'Usage: `eb ra remove react [@user]` / `eb ra remove respond [@user]` / `eb ra remove all [@user]`'
        );
      }

      const targetUser = message.mentions.users.first() || message.author;

      const existing = await MentionReaction.findOne({ userId: targetUser.id });
      if (!existing) {
        return silentReply(message, `${targetUser.username} has no mention settings configured.`);
      }

      const update = {};
      if (type === 'react' || type === 'all') update.reactEmoji = null;
      if (type === 'respond' || type === 'all') {
        update.respondContent = null;
        update.respondType = null;
      }

      await MentionReaction.findOneAndUpdate(
        { userId: targetUser.id },
        { $set: { ...update, updatedAt: new Date() } }
      );

      return silentReply(
        message,
        `✅ Removed ${type === 'all' ? 'all mention settings' : `the ${type} setting`} for **${targetUser.username}**.`
      );
    }
  },
};