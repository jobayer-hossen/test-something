const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['color', 'role', 'cosmetic'],
    required: true,
  },
  price: { type: Number, required: true },
  roleId: String,
  colorHex: String,
  guildId: String,
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ShopItem', shopItemSchema);