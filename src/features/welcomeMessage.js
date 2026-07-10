const Logger = require('../logger');

const logger = new Logger('WelcomeMessage');

// ✅ Welcome channel ID
const WELCOME_CHANNEL_ID = '1525186631907151953';

// ✅ Add more GIFs here in the future easily
const WELCOME_GIFS = [
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpnbmpwZjAzZzZjaWZ1dm9mazk4ZG8zNG91OWtwdHdmb3hnNWgzNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYC0LajbaPoEADu/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTF6Z3JwNWs0cnRya2NnajdhNTFoMHk0bTc1ZGFjczA1YWYzdDk5NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHQn7PBRvy9A5mE/giphy.gif',

  // 'https://media.giphy.com/media/YYYYYY/giphy.gif',
];

// ✅ Server channel IDs - update these
const CHANNELS = {
  rules: '1506670308470423763',
  general: '1330215688547209352',
  announcements: '1452091225870962903',
  // Add more channels here in future
};

// ✅ Get random GIF from list
function getRandomGif() {
  return WELCOME_GIFS[Math.floor(Math.random() * WELCOME_GIFS.length)];
}

// ✅ Build welcome message
function buildWelcomeMessage(member) {
  return (
    `╔══════════════════════════════╗\n` +
    `        🎉 **WELCOME!** 🎉\n` +
    `╚══════════════════════════════╝\n\n` +
    `Hey ${member} ! Welcome to **${member.guild.name}** 👋\n` +
    `We're so happy to have you here! 🥳\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 **GET STARTED**\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 Read the rules → <#${CHANNELS.rules}>\n` +
    `📢 Check announcements → <#${CHANNELS.announcements}>\n` +
    `💬 Say hi to everyone → <#${CHANNELS.general}>\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✨ **YOU ARE MEMBER #${member.guild.memberCount}** ✨\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `We hope you enjoy your stay! 💖`
  );
}

class WelcomeMessageFeature {
  constructor(client) {
    this.client = client;
  }

  // ✅ Initialize - listen to guildMemberAdd event
  initialize() {
    this.client.on('guildMemberAdd', async (member) => {
      await this.handleMemberJoin(member);
    });

    logger.info('✅ Welcome Message feature initialized');
  }

  async handleMemberJoin(member) {
    try {
      // Fetch welcome channel
      const channel = await this.client.channels.fetch(WELCOME_CHANNEL_ID);
      if (!channel) {
        logger.error('Welcome channel not found!');
        return;
      }

      // Get random GIF
      const gif = getRandomGif();

      // Build welcome text
      const welcomeText = buildWelcomeMessage(member);

      // Send GIF first
      await channel.send({ content: gif });

      // Send welcome text
      await channel.send({ content: welcomeText });

    //   logger.info(`✅ Welcomed ${member.user.username} to ${member.guild.name}`);
    } catch (err) {
      logger.error('Error sending welcome message:', err);
    }
  }
}

module.exports = WelcomeMessageFeature;