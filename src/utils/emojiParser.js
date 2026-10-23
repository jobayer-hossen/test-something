function parseEmojiInput(client, input) {
  if (!input) return { valid: false, reason: 'No emoji provided.' };

  const customMatch = input.match(/^<(a?):(\w+):(\d+)>$/);
  if (customMatch) {
    const [, , , id] = customMatch;
    const emoji = client.emojis.cache.get(id);
    if (!emoji) {
      return {
        valid: false,
        reason: "I don't have access to that emoji. Please use an emoji from a server I'm in.",
      };
    }
    return { valid: true, type: 'custom', raw: input };
  }

  // Basic unicode emoji check
  const unicodeEmojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)+$/u;
  if (unicodeEmojiRegex.test(input) && input.length <= 8) {
    return { valid: true, type: 'unicode', raw: input };
  }

  return { valid: false, reason: "That doesn't look like a valid emoji." };
}

function parseGifOrImageUrl(input) {
  try {
    const url = new URL(input);

    const validHosts = [
      'tenor.com', 'giphy.com', 'media.giphy.com', 'media.tenor.com',
      'cdn.discordapp.com', 'media.discordapp.net',
      'imgur.com', 'i.imgur.com',
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

module.exports = { parseEmojiInput, parseGifOrImageUrl };