const tournamentService = require("../database/services/tournamentService");
const { EmbedBuilder } = require("discord.js");

const JOIN_WORDS = ["lol", "fart", "cry", "bet", "run", "enchant"];

module.exports = {
  name: "tournament",
  description: "View current tournament info",

  async execute(message, args, client) {
    const guildId = message.guild.id;
    const tournament = await tournamentService.getActiveTournament(guildId);

    if (!tournament) {
      const embed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("🏟️ No Active Tournament")
        .setDescription(
          "No tournament is running right now!\n" +
            "Tournaments spawn automatically every hour.\n\n" +
            "**Join words:** `lol` • `fart` • `cry` • `bet` • `run` • `enchant`",
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const timeLeft = tournament.endsAt
      ? Math.max(0, Math.floor((tournament.endsAt - Date.now()) / 1000))
      : 0;

    const participantList =
      tournament.participants.length > 0
        ? tournament.participants
            .map((p, i) => `${i + 1}. ${p.username}`)
            .join("\n")
        : "No participants yet";

    const embed = new EmbedBuilder()
      .setColor("#F39C12")
      .setTitle("🏟️ Tournament Master Event")
      .addFields(
        {
          name: "📊 Status",
          value:
            tournament.phase === "waiting"
              ? "⏳ Waiting for players"
              : "⚔️ Battle in progress",
          inline: true,
        },
        {
          name: "👥 Participants",
          value: `${tournament.participants.length}`,
          inline: true,
        },
        {
          name: "⏰ Time Left",
          value: `${timeLeft}s`,
          inline: true,
        },
        {
          name: "🗡️ Fighters",
          value: participantList.substring(0, 1024),
        },
        {
          name: "📌 How to Join",
          value: JOIN_WORDS.map((w) => `\`${w}\``).join(" • "),
        },
      )
      .setFooter({ text: "Collect all 7 badges to become Tournament Master!" })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};
