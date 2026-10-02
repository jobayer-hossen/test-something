const Logger = require('../logger');
const config = require('../config');
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionsBitField 
} = require('discord.js');

const logger = new Logger('EnchantmentWatcher');

const ENCHANTMENTS = [
  { name: 'Mega',          style: ButtonStyle.Secondary },
  { name: 'Epic',          style: ButtonStyle.Secondary },
  { name: 'Hyper',         style: ButtonStyle.Secondary },
  { name: 'Ultimate',      style: ButtonStyle.Secondary },
  { name: 'Perfect',       style: ButtonStyle.Secondary },
  { name: 'Edgy',          style: ButtonStyle.Secondary },
  { name: 'Ultra-Edgy',    style: ButtonStyle.Secondary },
  { name: 'Omega',         style: ButtonStyle.Secondary },
  { name: 'Ultra-Omega',   style: ButtonStyle.Secondary },
  { name: 'Godly',         style: ButtonStyle.Secondary },
  { name: 'Void',          style: ButtonStyle.Secondary },
  { name: 'Eternal',       style: ButtonStyle.Secondary },
];

const RPG_ENCHANT_COMMANDS = [
  'enchant',
  'transmute',
  'transcend',
  'ascend',
  'enhance',
  'upgrade',
  'fortify',
];

class EnchantmentWatcher {
  constructor(client) {
    this.client       = client;
    this.selections   = new Map(); // Map<userId, enchantName>
    this.handled      = new Set(); // prevent double-fire
    this.menuMessages = new Map(); // Map<userId, { messageId, channelId }>
    this.memberCache  = new Map(); // Map<userId, GuildMember> — pre-cached
  }

  initialize() {
    // Pre-fetch all members into cache so mute is instant
    this.client.once('clientReady', async () => {
      try {
        for (const guild of this.client.guilds.cache.values()) {
          await guild.members.fetch();
        }
        // logger.info(`✅ EnchantmentWatcher — member cache ready`);
      } catch (err) {
        logger.error('Failed to pre-fetch members:', err);
      }
    });

    // logger.info(`✅ EnchantmentWatcher initialized — watching channel ${config.ENCHANT_CHANNEL_ID}`);
  }

  // ─────────────────────────────────────────────
  // PUBLIC — called from messageCreate.js
  // ─────────────────────────────────────────────

  async handleUserMessage(message) {
    if (message.channelId !== config.ENCHANT_CHANNEL_ID) return;
    if (message.content.trim().toLowerCase() !== 'eb en') return;

    await this._deleteOldMenu(message.author.id, message.channel);

    const rows = this._buildButtons(null);

    const sent = await message.reply({
      content: [
        '## ✨ Enchantment Alarm',
        '> Select your **target enchantment** below.',
        '> I will **mute you for 5 seconds** if you get it!',
        '-# Your other choices will be disabled once you pick one.',
      ].join('\n'),
      components: rows,
      allowedMentions: { repliedUser: false },
    });

    this.menuMessages.set(message.author.id, {
      messageId: sent.id,
      channelId: sent.channelId,
    });

    // logger.info(`Enchant menu shown → ${message.author.username}`);
  }

  async handleBotMessage(message) {
    if (message.channelId !== config.ENCHANT_CHANNEL_ID) return;
    if (message.author.id !== config.EPIC_RPG_BOT_ID) return;
    if (this.handled.has(message.id)) return;

    const fullText = this._extractText(message);
    if (!fullText.toLowerCase().includes("you've enchanted")) return;

    // ── Extract username from embed author ────────────────────────────────
    let rpgUsername = null;
    for (const embed of message.embeds) {
      if (embed.author?.name) {
        const commandPattern = RPG_ENCHANT_COMMANDS.join('|');
        const authorMatch = embed.author.name.match(
          new RegExp(`^(.+?)\\s*[—–\\-]\\s*(?:${commandPattern})`, 'i')
        );
        if (authorMatch) {
          rpgUsername = authorMatch[1].trim();
          break;
        }
      }
    }
    if (!rpgUsername) return;

    // ── Extract enchantment from field name ───────────────────────────────
    let gotEnchant = null;
    for (const embed of message.embeds) {
      for (const field of embed.fields ?? []) {
        const cleanFieldName = field.name.replace(/\*\*/g, '');
        const enchantMatch = cleanFieldName.match(/~-~>\s*(.+?)\s*<~-~/);
        if (enchantMatch) {
          gotEnchant = enchantMatch[1].trim();
          break;
        }
      }
      if (gotEnchant) break;
    }
    if (!gotEnchant) return;

    // Mark handled immediately — before any async work
    this.handled.add(message.id);
    setTimeout(() => this.handled.delete(message.id), 30_000);

    // ✅ Mute first, announce after — fastest possible response
    await this._tryMute(message, rpgUsername, gotEnchant);
  }

  // PUBLIC — called from interactionCreate.js
  async handleButtonClick(interaction) {
    try {
      await interaction.deferUpdate();

      const enchantName = interaction.customId.replace('eb_enchant_', '');
      const userId      = interaction.user.id;

      if (!ENCHANTMENTS.find(e => e.name === enchantName)) return;

      this.selections.set(userId, enchantName);
    //   logger.info(`Selection saved — ${interaction.user.username} → ${enchantName}`);

      await interaction.message.edit({
        content: [
          '## ✨ Enchantment Alarm',
          `> ✅ Locked in: **${enchantName}**`,
          '> I\'ll mute you for **5 seconds** if that\'s what you get!',
          '-# Run `eb en` again to change your selection.',
        ].join('\n'),
        components: this._buildButtons(enchantName),
      });

    } catch (error) {
      logger.error('handleButtonClick error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  async _deleteOldMenu(userId, channel) {
    const old = this.menuMessages.get(userId);
    if (!old) return;
    try {
      const msg = await channel.messages.fetch(old.messageId);
      if (msg) await msg.delete();
    } catch { /* already gone */ }
    this.menuMessages.delete(userId);
  }

  async _tryMute(message, rpgUsername, gotEnchant) {
    const guild   = message.guild;
    const channel = message.channel;

    const matchedUsers = [];

    for (const [userId, selectedEnchant] of this.selections.entries()) {
      if (selectedEnchant.toLowerCase() !== gotEnchant.toLowerCase()) continue;

      // ✅ Use guild cache — no API call, instant
      const member = guild.members.cache.get(userId);
      if (!member) continue;

      const namesMatch = (
        member.user.username.toLowerCase()    === rpgUsername.toLowerCase() ||
        member.user.globalName?.toLowerCase() === rpgUsername.toLowerCase() ||
        member.displayName.toLowerCase()      === rpgUsername.toLowerCase()
      );

      if (!namesMatch) continue;

      matchedUsers.push({ userId, member });
    }

    if (matchedUsers.length === 0) return;

    // ✅ Fire ALL mutes simultaneously — no waiting one by one
    await Promise.all(
      matchedUsers.map(async ({ userId, member }) => {
        this.selections.delete(userId);
        this.menuMessages.delete(userId);

        try {
          // ✅ Mute and announce at the same time
          await Promise.all([
            this._channelMute(channel, member, 5_000),
            channel.send({
              content: `🔇 <@${userId}> got **${gotEnchant}**! Muted for **5 seconds**! ✨`,
              allowedMentions: { users: [userId] },
            }),
          ]);

        //   logger.info(`✅ Muted ${member.user.username} | enchant: ${gotEnchant}`);
        } catch (err) {
          logger.error(`Failed to mute ${member.user.username}:`, err);
        }
      })
    );
  }

  async _channelMute(channel, member, durationMs) {
    const existing = channel.permissionOverwrites.cache.get(member.id);

    // ✅ This works on admins too — direct channel overwrite bypasses admin perms
    await channel.permissionOverwrites.edit(member, {
      SendMessages:          false,
      AddReactions:          false,
      SendMessagesInThreads: false,
    }, { reason: 'EB Bot — enchantment mute (5s)' });

    setTimeout(async () => {
      try {
        if (existing) {
          await channel.permissionOverwrites.edit(member, {
            SendMessages: existing.allow.has(PermissionsBitField.Flags.SendMessages)
              ? true : null,
            AddReactions: existing.allow.has(PermissionsBitField.Flags.AddReactions)
              ? true : null,
            SendMessagesInThreads: existing.allow.has(PermissionsBitField.Flags.SendMessagesInThreads)
              ? true : null,
          });
        } else {
          await channel.permissionOverwrites.delete(
            member,
            'EB Bot — enchantment mute lifted'
          );
        }
      } catch (err) {
        logger.error(`Failed to lift mute for ${member.user.username}:`, err);
      }
    }, durationMs);
  }

  _buildButtons(selectedName) {
    const rows = [];

    for (let i = 0; i < ENCHANTMENTS.length; i += 5) {
      const chunk = ENCHANTMENTS.slice(i, i + 5);

      const row = new ActionRowBuilder().addComponents(
        chunk.map(e => {
          const isSelected = selectedName !== null && e.name === selectedName;
          const isOther    = selectedName !== null && e.name !== selectedName;

          return new ButtonBuilder()
            .setCustomId(`eb_enchant_${e.name}`)
            .setLabel(e.name)
            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(isOther);
        })
      );

      rows.push(row);
    }

    return rows;
  }

  _extractText(message) {
    const parts = [];
    if (message.content) parts.push(message.content);
    for (const embed of message.embeds) {
      if (embed.author?.name) parts.push(embed.author.name);
      if (embed.title)        parts.push(embed.title);
      if (embed.description)  parts.push(embed.description);
      embed.fields?.forEach(f => {
        parts.push(f.name);
        parts.push(f.value);
      });
      if (embed.footer?.text) parts.push(embed.footer.text);
    }
    return parts.join('\n');
  }
}

module.exports = EnchantmentWatcher;