const shopService = require('../database/services/shopService');
const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'shop',
  description: 'Browse and buy roles/colors with gold',

  async execute(message, args, client) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand === 'list') {
      return this.handleList(message, client);
    }

    if (subcommand === 'buy') {
      return this.handleBuy(message, args, client);
    }

    if (subcommand === 'inventory') {
      return this.handleInventory(message, client);
    }

    return this.handleList(message, client);
  },

  async handleList(message, client) {
    const items = await shopService.getItems(message.guild.id);

    if (!items || items.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('🏪 Shop')
        .setDescription('No items available right now! Check back later.')
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const balance = await economyService.getBalance(message.author.id);

    const colorItems = items.filter((i) => i.type === 'color');
    const roleItems = items.filter((i) => i.type === 'role');

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🏪 Epic Shop')
      .setDescription(`Your Balance: **${balance} 💰**`)
      .setFooter({ text: 'Use: eb shop buy <itemId>' })
      .setTimestamp();

    if (colorItems.length > 0) {
      embed.addFields({
        name: '🎨 Colors',
        value: colorItems
          .map((i) => `\`${i.itemId}\` — **${i.name}** — ${i.price} 💰\n> ${i.description || ''}`)
          .join('\n'),
      });
    }

    if (roleItems.length > 0) {
      embed.addFields({
        name: '👑 Roles',
        value: roleItems
          .map((i) => `\`${i.itemId}\` — **${i.name}** — ${i.price} 💰\n> ${i.description || ''}`)
          .join('\n'),
      });
    }

    message.channel.send({ embeds: [embed] });
  },

  async handleBuy(message, args, client) {
    const itemId = args[1];
    if (!itemId) return message.channel.send('❌ Usage: `eb shop buy <itemId>`');

    const userId = message.author.id;
    const username = message.author.username;

    await userService.getOrCreateUser(userId, username);

    const item = await shopService.getItem(itemId);
    if (!item) return message.channel.send('❌ Item not found! Use `eb shop list` to see items.');

    const balance = await economyService.getBalance(userId);
    if (balance < item.price) {
      return message.channel.send(
        `❌ Insufficient gold! Need **${item.price} 💰**, have **${balance} 💰**.`
      );
    }

    const result = await shopService.purchaseItem(
      userId,
      username,
      itemId,
      message.guild.id
    );

    if (!result.success) {
      const reasons = {
        already_purchased: '❌ You already own this item!',
        item_not_found: '❌ Item not found!',
      };
      return message.channel.send(reasons[result.reason] || '❌ Purchase failed.');
    }

    // Deduct coins
    await economyService.removeCoins(userId, item.price);

    // Apply role if applicable
    if (item.type === 'role' && item.roleId) {
      try {
        const member = await message.guild.members.fetch(userId);
        const role = await message.guild.roles.fetch(item.roleId);
        if (role) await member.roles.add(role);
      } catch (err) {
        console.error('Role apply error:', err.message);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('✅ Purchase Successful!')
      .setDescription(
        `You bought **${item.name}**!\n` +
        `**Cost:** ${item.price} 💰\n` +
        `**Remaining Balance:** ${balance - item.price} 💰`
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleInventory(message, client) {
    const purchases = await shopService.getUserPurchases(message.author.id);

    if (!purchases || purchases.length === 0) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#95A5A6')
            .setTitle('🎒 Your Inventory')
            .setDescription('No purchases yet! Visit `eb shop` to buy items.')
            .setTimestamp(),
        ],
      });
    }

    const itemList = purchases
      .map((p) => `• **${p.itemName}** — Purchased: ${new Date(p.purchasedAt).toLocaleDateString()}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎒 Your Inventory')
      .setDescription(itemList)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};