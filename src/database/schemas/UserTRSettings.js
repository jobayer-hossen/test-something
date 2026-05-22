const mongoose = require("mongoose");

const userTRSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  trackers: {
    produce: { type: Boolean, default: true },
    hunt: { type: Boolean, default: true },
    adventure: { type: Boolean, default: true },
    training: { type: Boolean, default: true },
    chop: { type: Boolean, default: true },
    fish: { type: Boolean, default: true },
    pickup: { type: Boolean, default: true },
    mine: { type: Boolean, default: true },
  }
});

module.exports = mongoose.model("UserTRSettings", userTRSettingsSchema);