const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  commandType: { type: String, required: true }, // e.g., "produce", "hunt", "adventure"
  endTime: { type: Date, required: true },
  reminded: { type: Boolean, default: false }
});

module.exports = mongoose.model("Reminder", reminderSchema);