const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("WelcomeMessage");

const WELCOME_CHANNEL_ID = "1525186631907151953";

const WELCOME_GIFS = [
  "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpnbmpwZjAzZzZjaWZ1dm9mazk4ZG8zNG91OWtwdHdmb3hnNWgzNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYC0LajbaPoEADu/giphy.gif",
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTF6Z3JwNWs0cnRya2NnajdhNTFoMHk0bTc1ZGFjczA1YWYzdDk5NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHQn7PBRvy9A5mE/giphy.gif",
];

const CHANNELS = {
  rules: "1506670308470423763",
  general: "1330215688547209352",
  announcements: "1452091225870962903",
  ping: "1470272561106522304",
};

function getRandomGif() {
  return WELCOME_GIFS[Math.floor(Math.random() * WELCOME_GIFS.length)];
}

function buildWelcomeEmbed(member) {
  const avatarURL = member.user.displayAvatarURL({
    size: 256,
    dynamic: true,
    format: "png",
  });

  const memberCount = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Discord blurple - clean and professional
    .setAuthor({
      name: `✨ Welcome to ${member.guild.name}!`,
      iconURL: member.guild.iconURL({ dynamic: true }),
    })
    .setDescription(
      `Hey ${member} ! We're glad to have you here 🎉\n` +
      `To get started, please check out the following channels.\n`
    )
    .addFields(
      {
        name: "📜 Rules",
        value: `Please read <#${CHANNELS.rules}> to understand our guidelines.`,
        inline: false,
      },
      {
        name: "🔔 Ping Roles",
        value: `Grab your roles in <#${CHANNELS.ping}> to unlock the server.`,
        inline: false,
      },
      {
        name: "📢 Announcements",
        value: `Stay updated in <#${CHANNELS.announcements}>.`,
        inline: false,
      },
      {
        name: "💬 General Chat",
        value: `Say hello and meet everyone in <#${CHANNELS.general}>!`,
        inline: false,
      }
    )
    .setThumbnail(avatarURL) // ✅ User avatar on right side
    .setFooter({
      text: `Member #${memberCount} • Enjoy your stay!`,
      iconURL: avatarURL,
    })
    .setTimestamp();

  return embed;
}

class WelcomeMessageFeature {
  constructor(client) {
    this.client = client;
  }

  initialize() {
    this.client.on("guildMemberAdd", async (member) => {
      await this.handleMemberJoin(member);
    });

    logger.info("✅ Welcome Message feature initialized");
  }

  async handleMemberJoin(member) {
    try {
      const channel = await this.client.channels.fetch(WELCOME_CHANNEL_ID);
      if (!channel) {
        logger.error("Welcome channel not found!");
        return;
      }

      const gif = getRandomGif();
      const embed = buildWelcomeEmbed(member);

      // ✅ Send GIF first
      await channel.send({ content: gif });

      // ✅ Send embed
      await channel.send({ embeds: [embed] });

      // logger.info(`✅ Welcomed ${member.user.username} — Member #${member.guild.memberCount}`);
    } catch (err) {
      logger.error("Error sending welcome message:", err);
    }
  }
}

module.exports = WelcomeMessageFeature;