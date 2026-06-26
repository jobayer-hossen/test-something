const haremService = require('../database/services/haremService');
const economyService = require('../database/services/economyService');
const userService = require('../database/services/userService');
const { EmbedBuilder } = require('discord.js');

const MIN_COST = 10000;
const MIN_MEMBERS = 3;

module.exports = {
  name: 'harem',
  description: 'Harem system commands',

  async execute(message, args, client) {
    const subcommand = args[0]?.toLowerCase();

    const subcommands = {
      create: () => this.handleCreate(message, args, client),
      info: () => this.handleInfo(message, args, client),
      deposit: () => this.handleDeposit(message, args, client),
      daily: () => this.handleDaily(message, args, client),
      return: () => this.handleReturn(message, args, client),
      invite: () => this.handleInvite(message, args, client),
    };

    if (!subcommand || !subcommands[subcommand]) {
      return this.showHelp(message);
    }

    await subcommands[subcommand]();
  },

  async handleCreate(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    const guildId = message.guild.id;

    await userService.getOrCreateUser(userId, username);
    const balance = await economyService.getBalance(userId);

    if (balance < MIN_COST) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🏰 Insufficient Gold')
        .setDescription(
          `Creating a harem costs **${MIN_COST.toLocaleString()} 💰 gold**.\n` +
          `Your balance: **${balance.toLocaleString()} 💰**\n` +
          `You need **${(MIN_COST - balance).toLocaleString()} 💰** more!`
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size < MIN_MEMBERS - 1) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🏰 Need More Members')
        .setDescription(
          `You need to mention at least **${MIN_MEMBERS - 1}** members to invite!\n` +
          `Usage: \`eb harem create <name> @user1 @user2\``
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const haremName = args.slice(1).find((a) => !a.startsWith('<@')) || `${username}'s Harem`;
    const members = mentionedUsers
      .filter((u) => !u.bot && u.id !== userId)
      .map((u) => ({ userId: u.id, username: u.username }));

    // Deduct cost
    const deducted = await economyService.removeCoins(userId, MIN_COST);
    if (!deducted) {
      return message.channel.send('❌ Failed to deduct gold. Check your balance!');
    }

    const result = await haremService.createHarem(userId, username, haremName, guildId, members);

    if (!result.success) {
      const reasons = {
        already_has_harem: '❌ You already own a harem!',
        need_3_members: `❌ Need at least ${MIN_MEMBERS} total members (you + 2)!`,
        error: '❌ Failed to create harem.',
      };

      await economyService.addCoins(userId, MIN_COST);
      return message.channel.send(reasons[result.reason] || '❌ Error');
    }

    const memberList = result.harem.members.map((m) => `• ${m.username}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#E91E8C')
      .setTitle(`🏰 Harem Created: ${haremName}`)
      .setDescription(
        `**${username}** has created a harem!\n\n` +
        `**Members:**\n${memberList}\n\n` +
        `**Creation Cost:** ${MIN_COST.toLocaleString()} 💰\n` +
        `**Daily Distribution:** ${result.harem.dailyDistribution} 💰 per member`
      )
      .addFields({
        name: '📋 Commands',
        value:
          '`eb harem deposit <amount>` — Fund treasury\n' +
          '`eb harem daily` — Distribute gold\n' +
          '`eb harem return <amount>` — Return gold to owner\n' +
          '`eb harem info` — View harem info',
      })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleInfo(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    let harem = await haremService.getHarem(userId, guildId);
    if (!harem) harem = await haremService.getHaremByMember(userId, guildId);

    if (!harem) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🏰 No Harem Found')
            .setDescription('You are not part of any harem!\nCreate one with `eb harem create <name> @user1 @user2`')
            .setTimestamp(),
        ],
      });
    }

    const memberList = harem.members
      .map((m) => {
        const isOwner = m.userId === harem.ownerId;
        return `${isOwner ? '👑' : '👤'} **${m.username}** — Received: ${m.totalReceived} 💰 | Returned: ${m.totalReturned} 💰`;
      })
      .join('\n');

    const lastDist = harem.lastDistribution
      ? new Date(harem.lastDistribution).toLocaleString()
      : 'Never';

    const embed = new EmbedBuilder()
      .setColor('#E91E8C')
      .setTitle(`🏰 ${harem.name}`)
      .addFields(
        { name: '👑 Owner', value: harem.ownerUsername, inline: true },
        { name: '💰 Treasury', value: `${harem.treasury} 💰`, inline: true },
        { name: '📊 Daily Per Member', value: `${harem.dailyDistribution} 💰`, inline: true },
        { name: '👥 Members', value: memberList || 'None' },
        { name: '📅 Last Distribution', value: lastDist, inline: true }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleDeposit(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const amount = parseInt(args[1]);

    if (!amount || amount <= 0) {
      return message.channel.send('❌ Usage: `eb harem deposit <amount>`');
    }

    const balance = await economyService.getBalance(userId);
    if (balance < amount) {
      return message.channel.send(`❌ Insufficient gold! Balance: **${balance} 💰**`);
    }

    await economyService.removeCoins(userId, amount);
    const result = await haremService.depositToTreasury(userId, guildId, amount);

    if (!result.success) {
      await economyService.addCoins(userId, amount);
      return message.channel.send('❌ You must be the harem owner to deposit!');
    }

    const embed = new EmbedBuilder()
      .setColor('#4CAF50')
      .setTitle('💰 Treasury Funded')
      .setDescription(
        `Deposited **${amount} 💰** to harem treasury!\n` +
        `**Treasury:** \`${result.treasury} 💰\``
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleDaily(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const harem = await haremService.getHarem(userId, guildId);
    if (!harem) {
      return message.channel.send('❌ You must be the harem owner to distribute daily gold!');
    }

    const result = await haremService.distributeDaily(harem._id);

    if (!result.success) {
      const reasons = {
        cooldown: '❌ Daily distribution already done! Come back in 24 hours.',
        insufficient_treasury: `❌ Not enough treasury gold! Need **${result.needed} 💰**, have **${result.treasury} 💰**.`,
        error: '❌ Error during distribution.',
      };
      return message.channel.send(reasons[result.reason] || '❌ Error');
    }

    // Give coins to members
    for (const member of result.members) {
      await economyService.addCoins(member.userId, result.perMember);
    }

    const memberList = result.members.map((m) => `• ${m.username}: +${result.perMember} 💰`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 Daily Distribution Complete!')
      .setDescription(
        `Gold distributed to all harem members!\n\n` +
        `**Per Member:** ${result.perMember} 💰\n\n` +
        `${memberList}\n\n` +
        `**Treasury Remaining:** ${result.remainingTreasury} 💰`
      )
      .setFooter({ text: 'Members should return gold with: eb harem return <amount>' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleReturn(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const amount = parseInt(args[1]);

    if (!amount || amount <= 0) {
      return message.channel.send('❌ Usage: `eb harem return <amount>`');
    }

    const balance = await economyService.getBalance(userId);
    if (balance < amount) {
      return message.channel.send(`❌ Insufficient gold! Balance: **${balance} 💰**`);
    }

    const harem = await haremService.getHaremByMember(userId, guildId);
    if (!harem) return message.channel.send('❌ You are not in a harem!');

    await economyService.removeCoins(userId, amount);
    const result = await haremService.returnGold(userId, harem._id, amount);

    if (!result.success) {
      await economyService.addCoins(userId, amount);
      return message.channel.send('❌ Failed to return gold!');
    }

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('💰 Gold Returned')
      .setDescription(
        `You returned **${amount} 💰** to \`${harem.name}\`!\n` +
        `**Treasury:** \`${result.treasury} 💰\``
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  async handleInvite(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const harem = await haremService.getHarem(userId, guildId);
    if (!harem) return message.channel.send('❌ You must be the harem owner to invite!');

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) return message.channel.send('❌ Mention a user: `eb harem invite @user`');

    const result = await haremService.addMember(harem._id, mentionedUser.id, mentionedUser.username);

    if (!result.success) {
      const reasons = {
        already_member: '❌ That user is already in your harem!',
        not_found: '❌ Harem not found!',
      };
      return message.channel.send(reasons[result.reason] || '❌ Error');
    }

    const embed = new EmbedBuilder()
      .setColor('#E91E8C')
      .setTitle('🏰 Member Added!')
      .setDescription(
        `**${mentionedUser.username}** has joined **${harem.name}**!\n` +
        `**Total Members:** ${result.harem.members.length}`
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },

  showHelp(message) {
    const embed = new EmbedBuilder()
      .setColor('#E91E8C')
      .setTitle('🏰 Harem Commands')
      .addFields(
        { name: '`eb harem create <name> @user1 @user2`', value: `Create a harem (costs ${MIN_COST.toLocaleString()} 💰, need 2+ members)` },
        { name: '`eb harem info`', value: 'View your harem details' },
        { name: '`eb harem deposit <amount>`', value: 'Owner: deposit gold to treasury' },
        { name: '`eb harem daily`', value: 'Owner: distribute daily gold to members' },
        { name: '`eb harem return <amount>`', value: 'Member: return gold to owner treasury' },
        { name: '`eb harem invite @user`', value: 'Owner: invite a new member' }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};