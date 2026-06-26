const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: String,
  itemId: { type: String, required: true },
  itemName: String,
  price: Number,
  purchasedAt: { type: Date, default: Date.now },
  guildId: String,
});

module.exports = mongoose.model('Purchase', purchaseSchema);