const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("KillCommand");

module.exports = {
  name: "kill",
  description: "Kill someone (just for fun)!",

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.channel.send(
          "❌ Please mention someone! Usage: `eb kill @user`",
        );
      }

      if (user.id === message.author.id) {
        return await message.channel.send(
          "😵 You tried to kill yourself! That's illegal!",
        );
      }

      const killMessages = [
        `⚔️ ${message.author.username} eliminated ${user.username}!`,
        `💀 ${user.username} was taken out by ${message.author.username}!`,
        `🗡️ ${message.author.username} stabbed ${user.username} with a sword!`,
        `🔫 ${user.username} got eliminated! Game over!`,
        `💀 RIP ${user.username}... you fought well!`,
        `⚔️ ${message.author.username} used a critical hit on ${user.username}!`,
        `🗡️ ${user.username} has been slain by ${message.author.username}!`,
        `💀 ${user.username} was defeated in combat!`,
        `🔥 ${message.author.username} used a finisher on ${user.username}!`,
        `☠️ ${user.username} has been sent to the afterlife!`,
      ];

      const killGifs = [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTA5emNtMTBmZWU0cWluaGRsbnhkY3JmbW15dHRkd2g1YW5zN3AyNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1ludrxHRnUmT6/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTA5emNtMTBmZWU0cWluaGRsbnhkY3JmbW15dHRkd2g1YW5zN3AyNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lUedOXZaqNJoqHkmFP/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTA5emNtMTBmZWU0cWluaGRsbnhkY3JmbW15dHRkd2g1YW5zN3AyNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l925axfj7YFo68XH2v/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3amhkczk0bnJpdXU1eWNxOG0ycXpnZXFwaGZkMjg1ZTk0N2pqamR4NCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/0NMF33GNxcfXIj2ctW/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3Y2NtY203MjgxcWRqbDB6bzR3dWJ1bWdueXJzYmF5M2JuNHlqcWNvYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4Hff6Un3aBXWM/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZnQyZzhyb2ttbDU5cGRseHdudzVqdmNuN3RwbHJ6cjZnamhrdzI2NiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WWjwEkDOoruabIqqxU/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZnQyZzhyb2ttbDU5cGRseHdudzVqdmNuN3RwbHJ6cjZnamhrdzI2NiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yz6A4igMWaPwA/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3czM4dm1lbWt2Ymo4NWx5dTA2eGMwYWo0azE4ejRhN3d6dWJybzNxeiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WrygObkKCqXPIeixGB/giphy.gif",
      ];

      const randomMessage =
        killMessages[Math.floor(Math.random() * killMessages.length)];
      const randomGif = killGifs[Math.floor(Math.random() * killGifs.length)];

      const embed = new EmbedBuilder()
        .setColor("#8B0000")
        .setTitle("💀 KILL!")
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: "RIP 💀",
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });
      await message.react("💀");
      await message.react("⚔️");

      logger.info(`${message.author.tag} killed ${user.tag}`);
    } catch (error) {
      logger.error("Error in kill command:", error.message);
      await message.channel.send("❌ An error occurred!");
    }
  },
};
