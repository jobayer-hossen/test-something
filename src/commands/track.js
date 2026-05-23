const UserTRSettings = require("../database/schemas/UserTRSettings");

module.exports = {
  name: "track",
  description: "Enable/Disable RPG trackers",
  async execute(message, args, client) {
    const validCommands = ["produce", "hunt", "adventure", "training", "chop", "fish", "mine", "pickup"];
    
    if (args.length < 2) {
      return message.channel.send(`❓ Usage: \`eb track <command> <on/off>\` \nValid commands: ${validCommands.join(", ")}`);
    }

    const commandToTrack = args[0].toLowerCase();
    const status = args[1].toLowerCase();

    if (!validCommands.includes(commandToTrack)) {
      return message.channel.send("❌ Invalid command name.");
    }

    const isEnabled = status === "on";

    try {
      await UserTRSettings.findOneAndUpdate(
        { userId: message.author.id },
        { [`trackers.${commandToTrack}`]: isEnabled },
        { upsert: true, new: true }
      );

      message.channel.send(`✅ Tracker for **${commandToTrack}** is now turned **${isEnabled ? "ON" : "OFF"}**.`);
    } catch (error) {
      message.channel.send("❌ Database error while saving settings.");
    }
  },
};