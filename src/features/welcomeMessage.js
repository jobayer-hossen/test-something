const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("WelcomeMessage");

const WELCOME_CHANNEL_ID = "1526253398863642797";

const CHANNELS = {
  rules: "1506670308470423763",
  pingRoles: "1470272561106522304",
  colorRoles: "1470272458375565375",
  announcements: "1452091225870962903",
  epicEvents: "1472272358734692352",
  general: "1330215688547209352",
  help: "1501580781838139602",
  suggestions: "1490143542239170631",
};

const SPECIAL_PING_LINK =
  "https://discord.com/channels/894383235063222313/1470272561106522304/1470820456444723375";

const COLORS = [
  0x5865f2, // Blurple
  0x57f287, // Green
  0xfee75c, // Yellow
  0xeb459e, // Pink
  0x3498db, // Blue
  0x9b59b6, // Purple
  0x1abc9c, // Teal
];

const WELCOME_MESSAGES = [
  "Welcome aboard! We're happy to have you here. 🎉",
  "We're glad to have you here! Enjoy your stay. ✨",
  "Hope you enjoy your stay with us! 🌟",
  "Thanks for joining our community! 💙",
  "A new trainer has joined the adventure! ⚡",
  "Great to have you with us! 🎊",
  "Welcome! We hope you have an amazing time here. 🚀",
  "Your adventure starts now. Welcome! 🎮",
  "Thanks for being part of our community! 🌈",
  "A warm welcome! Have fun and make new friends. 🔥",
  "Wishing you an awesome journey with us! 🍀",
];

const GOODBYE_MESSAGES = [
  "has left the server. Goodbye! 👋",
  "left the adventure. We'll miss you! 🌅",
  "has departed. Take care! 💙",
  "has left us. Hope to see you again! 🍃",
  "said goodbye. Best of luck! ✨",
  "has moved on to a new adventure! 🌟",
  "packed their bags and headed off. Safe travels! 🎒",
  "has left the community. Wishing you all the best! 🍀",
  "has signed off. Until next time! 💫",
  "quietly left the server. Farewell! 🚪",
];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildWelcomeEmbed(member) {
  const avatar = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
  });

  return new EmbedBuilder()
    .setColor(random(COLORS))
    .setAuthor({
      name: `Welcome to ${member.guild.name}`,
      iconURL: member.guild.iconURL({ dynamic: true }),
    })
    .setThumbnail(avatar)
    .setDescription(
      [
        random(WELCOME_MESSAGES),

        " ",

        "**Start here:**",
        `<#${CHANNELS.rules}> ➝ Read the server rules.`,
        `${SPECIAL_PING_LINK} ➝ Set your RPG notification roles.`,
        `<#${CHANNELS.epicEvents}> ➝ Join epic events.`,
        `<#${CHANNELS.announcements}> ➝ Stay updated with announcements.`,
        `<#${CHANNELS.colorRoles}> ➝ Look color role.`,

        "ㅤ",

        "**Community:**",
        `<#${CHANNELS.general}> ➝ Chat with everyone.`,
        `<#${CHANNELS.help}> ➝ Need help? Ask here.`,
        `<#${CHANNELS.suggestions}> ➝ Share your suggestions.`,
      ].join("\n"),
    )
    .setFooter({
      text: `Member #${member.guild.memberCount}`,
      iconURL: avatar,
    })
    .setTimestamp();
}

class WelcomeMessageFeature {
  constructor(client) {
    this.client = client;
  }

  initialize() {
    this.client.on("guildMemberAdd", (member) => {
      this.handleMemberJoin(member);
    });

    this.client.on("guildMemberRemove", (member) => {
      this.handleMemberLeave(member);
    });

    logger.info("✅ Welcome Message initialized");
  }

  async handleMemberJoin(member) {
    try {
      const channel = await this.client.channels.fetch(WELCOME_CHANNEL_ID);

      if (!channel) return;

      await channel.send({
        content: `## ✨ 𝐖𝐄𝐋𝐂𝐎𝐌𝐄  ${member}!`,
        embeds: [buildWelcomeEmbed(member)],
        allowedMentions: {
          users: [member.id],
        },
      });
    } catch (err) {
      logger.error("Error sending welcome message:", err);
    }
  }

  async handleMemberLeave(member) {
    try {
      const channel = await this.client.channels.fetch(WELCOME_CHANNEL_ID);

      if (!channel) return;

      await channel.send(
        `🏃 **${member.user.tag}** ${random(GOODBYE_MESSAGES)}`,
      );
    } catch (err) {
      logger.error("Error sending goodbye message:", err);
    }
  }
}

module.exports = WelcomeMessageFeature;
