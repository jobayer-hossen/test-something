const { EmbedBuilder } = require("discord.js");
const Logger = require("../logger");

const logger = new Logger("PokeCommand");

module.exports = {
  name: "poke",
  description: "Poke someone!",

  async execute(message, args, client) {
    try {
      const user = message.mentions.users.first();

      if (!user) {
        return await message.channel.send(
          "❌ Please mention someone! Usage: `eb poke @user`",
        );
      }

      if (user.id === message.author.id) {
        return await message.channel.send("👉 You poked yourself! That's annoying!");
      }

      const pokeMessages = [
        `👉 *poke poke* ${message.author.username} pokes ${user.username}!`,
        `💢 ${user.username} got poked by ${message.author.username}!`,
        `👉 Stop it! ${user.username} keeps getting poked!`,
        `😤 ${message.author.username} keeps poking ${user.username}!`,
        `👉 Poke poke! ${user.username} is annoyed!`,
        `😠 Why do you keep poking ${user.username}?!`,
        `💢 POKE! ${user.username} is mad now!`,
        `👉 Another poke for ${user.username}! Stop it!`,
      ];

      // UNIQUE POKE GIFS ONLY
      const pokeGifs = [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXFsOXd5a2Z5dXhxdnkwZHgzOWZvNHM0ODFxYnJpMzV4dmV1cXVjZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/PkR8gPgc2mDlrMSgtu/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXFsOXd5a2Z5dXhxdnkwZHgzOWZvNHM0ODFxYnJpMzV4dmV1cXVjZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/RMl2RIcGjdv4GSH1G8/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXFsOXd5a2Z5dXhxdnkwZHgzOWZvNHM0ODFxYnJpMzV4dmV1cXVjZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/dY09qTUsPzks5zCtND/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3eDB1MjJ1a29kZW9zMzBkcXc2ZXF0N3psM252ZmN0aDR6ZjNwMGZyMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/FXl1pSZh49lPW/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3M2NmbnFpanlxMmI3b3JkajM1Nm9jcXd6cTFrOW90dDNpZGU0MThvaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LXTQN2kRbaqAw/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXFsOXd5a2Z5dXhxdnkwZHgzOWZvNHM0ODFxYnJpMzV4dmV1cXVjZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/CK0Eg2ymtfzTO2yVJD/giphy.gif",
      ];

      const randomMessage =
        pokeMessages[Math.floor(Math.random() * pokeMessages.length)];
      const randomGif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];

      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("👉 Poke!")
        .setDescription(randomMessage)
        .setImage(randomGif)
        .setTimestamp()
        .setFooter({
          text: "Stop poking me! 😒",
          iconURL: client.user.avatarURL(),
        });

      await message.channel.send({ embeds: [embed] });
      await message.react("👉");
      await message.react("💢");

      logger.info(`${message.author.tag} poked ${user.tag}`);
    } catch (error) {
      logger.error("Error in poke command:", error.message);
      await message.channel.send("❌ An error occurred!");
    }
  },
};