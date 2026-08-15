// commands/moderation.js
const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const Logger = require("../logger");

const logger = new Logger("Moderation");

// ════════════════════════════════════════════
//              CONFIGURATION
// ════════════════════════════════════════════
const MOD_LOG_CHANNEL_ID  = "1537836420700442644";
const APPEAL_CHANNEL_LINK = "https://discord.com/channels/894383235063222313/1485295722403336293";

const ROLE_LEVELS = {
  "1348685917338210315": 3, // Mastermind
  "1472621955407548416": 3, // Core Command
  "1470791812733075637": 1, // Support Syndicate — warn + timeout only
};

const LEVEL_COMMANDS = {
  1: ["warn", "timeout", "modlogs", "case", "modhelp"],
  3: ["warn", "kick", "ban", "timeout", "unwarn", "modlogs", "case", "modhelp"],
};

const MOD_COMMANDS = [
  "warn", "kick", "ban", "timeout",
  "unwarn", "modlogs", "modhelp", "case",
];

// ════════════════════════════════════════════
//              DATABASE SCHEMAS
// ════════════════════════════════════════════
const moderationLogSchema = new mongoose.Schema(
  {
    caseId:            { type: Number, required: true },
    guildId:           { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["WARN", "KICK", "BAN", "TIMEOUT", "UNBAN", "UNWARN", "UNTIMEOUT"],
      required: true,
    },
    userId:            { type: String, required: true, index: true },
    username:          { type: String, required: true },
    userTag:           { type: String, required: true },
    moderatorId:       { type: String, required: true },
    moderatorUsername: { type: String, required: true },
    moderatorTag:      { type: String, required: true },
    reason:            { type: String, default: "No reason provided" },
    evidence: {
      messageContent: String,
      messageId:      String,
      channelId:      String,
      channelName:    String,
      attachments:    [String],
      editHistory:    [{ content: String, editedAt: Date }],
      timestamp:      Date,
    },
    duration:         { type: Number,  default: null },
    durationString:   { type: String,  default: null },
    expiresAt:        { type: Date,    default: null },
    logMessageId:     { type: String,  default: null },
    commandChannelId: { type: String,  default: null },
    commandMessageId: { type: String,  default: null },
    active:           { type: Boolean, default: true },
  },
  { timestamps: true }
);

moderationLogSchema.index({ guildId: 1, caseId: 1 }, { unique: true });

const messageSnapshotSchema = new mongoose.Schema(
  {
    messageId:        { type: String, required: true, unique: true, index: true },
    guildId:          { type: String, required: true, index: true },
    channelId:        { type: String, required: true },
    channelName:      { type: String },
    authorId:         { type: String, required: true, index: true },
    authorUsername:   { type: String },
    authorTag:        { type: String },
    content:          { type: String, default: "" },
    editHistory:      [{ content: String, editedAt: { type: Date, default: Date.now } }],
    attachments:      [{ url: String, name: String, contentType: String }],
    hasEmbeds:        { type: Boolean, default: false },
    deleted:          { type: Boolean, default: false },
    deletedAt:        { type: Date,    default: null },
    messageCreatedAt: { type: Date },
  },
  { timestamps: true }
);

messageSnapshotSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

function getModerationLog() {
  return mongoose.models.ModerationLog ||
    mongoose.model("ModerationLog", moderationLogSchema);
}

function getMessageSnapshot() {
  return mongoose.models.MessageSnapshot ||
    mongoose.model("MessageSnapshot", messageSnapshotSchema);
}

// ════════════════════════════════════════════
//              PERMISSION HELPERS
// ════════════════════════════════════════════
function getMemberLevel(member) {
  if (!member) return 0;
  if (member.guild.ownerId === member.id) return 3;
  if (member.permissions.has("Administrator")) return 3;

  let highest = 0;
  for (const [roleId, level] of Object.entries(ROLE_LEVELS)) {
    if (member.roles.cache.has(roleId) && level > highest) highest = level;
  }
  return highest;
}

function hasModPermission(member) {
  return getMemberLevel(member) > 0;
}

function canUseCommand(member, command) {
  const level = getMemberLevel(member);
  if (level === 0) return false;
  for (const [lvl, cmds] of Object.entries(LEVEL_COMMANDS)) {
    if (parseInt(lvl) <= level && cmds.includes(command)) return true;
  }
  return false;
}

function hierarchyOk(message, targetMember) {
  if (message.guild.ownerId === message.author.id) return true;
  return message.member.roles.highest.position > targetMember.roles.highest.position;
}

// ════════════════════════════════════════════
//              DURATION HELPERS
// ════════════════════════════════════════════
function parseDuration(str) {
  const match = str?.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit  = match[2].toLowerCase();
  const multipliers = {
    s: 1_000,
    m: 60 * 1_000,
    h: 60 * 60 * 1_000,
    d: 24 * 60 * 60 * 1_000,
    w: 7 * 24 * 60 * 60 * 1_000,
  };

  const ms = value * multipliers[unit];
  if (ms > 28 * 24 * 60 * 60 * 1_000 || ms < 1_000) return null;
  return ms;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1_000);
  const m = Math.floor(s  / 60);
  const h = Math.floor(m  / 60);
  const d = Math.floor(h  / 24);
  const w = Math.floor(d  / 7);

  if (w > 0) return `${w}w ${d % 7}d`;
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ════════════════════════════════════════════
//              DATABASE HELPERS
// ════════════════════════════════════════════
async function getNextCaseId(guildId) {
  const ModerationLog = getModerationLog();
  const last = await ModerationLog.findOne({ guildId }).sort({ caseId: -1 });
  return last ? last.caseId + 1 : 1;
}

async function createCase({
  guildId, action, targetUser, moderator, reason,
  duration, durationString, evidence,
  commandChannelId, commandMessageId,
}) {
  const ModerationLog = getModerationLog();
  const caseId    = await getNextCaseId(guildId);
  const expiresAt = duration ? new Date(Date.now() + duration) : null;

  const doc = new ModerationLog({
    caseId,
    guildId,
    action,
    userId:            targetUser.id,
    username:          targetUser.username,
    userTag:           targetUser.tag || targetUser.username,
    moderatorId:       moderator.id,
    moderatorUsername: moderator.username,
    moderatorTag:      moderator.tag || moderator.username,
    reason:            reason || "No reason provided",
    duration:          duration       || null,
    durationString:    durationString || null,
    expiresAt,
    evidence:          evidence       || {},
    commandChannelId:  commandChannelId || null,
    commandMessageId:  commandMessageId || null,
  });

  await doc.save();
  return doc;
}

async function getUserHistory(guildId, userId) {
  const ModerationLog = getModerationLog();
  return ModerationLog.find({ guildId, userId }).sort({ createdAt: -1 });
}

async function getCaseById(guildId, caseId) {
  const ModerationLog = getModerationLog();
  return ModerationLog.findOne({ guildId, caseId });
}

async function deactivateCase(guildId, caseId) {
  const ModerationLog = getModerationLog();
  return ModerationLog.findOneAndUpdate(
    { guildId, caseId },
    { active: false },
    { new: true }
  );
}

// ════════════════════════════════════════════
//              EVIDENCE HELPERS
// ════════════════════════════════════════════
async function getSnapshot(messageId) {
  const MessageSnapshot = getMessageSnapshot();
  return MessageSnapshot.findOne({ messageId }).catch(() => null);
}

async function extractEvidence(message) {
  if (!message.reference?.messageId) return {};

  const snap = await getSnapshot(message.reference.messageId);
  if (!snap) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId);
      return {
        messageId:      refMsg.id,
        messageContent: refMsg.content || "(no text content)",
        channelId:      refMsg.channel.id,
        channelName:    refMsg.channel.name,
        attachments:    [...refMsg.attachments.values()].map((a) => a.url),
        timestamp:      refMsg.createdAt,
      };
    } catch {
      return {};
    }
  }

  return {
    messageId:      snap.messageId,
    messageContent: snap.content,
    channelId:      snap.channelId,
    channelName:    snap.channelName,
    editHistory:    snap.editHistory,
    attachments:    snap.attachments?.map((a) => a.url),
    timestamp:      snap.messageCreatedAt,
  };
}

function parseReason(content, commandWord, hasMention) {
  let text = content
    .slice(content.toLowerCase().indexOf(commandWord) + commandWord.length)
    .trim();
  if (hasMention) text = text.replace(/^<@!?\d+>\s*/, "").trim();
  return text || "No reason provided";
}

function buildJumpLink(guildId, channelId, messageId) {
  if (!channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

// ════════════════════════════════════════════
//              ACTION CONFIG
// ════════════════════════════════════════════
const ACTION_META = {
  WARN:      { color: 0xFFAA00, emoji: "⚠️",  label: "Warning Issued",   dmTitle: "You Have Been Warned",     verb: "warned"     },
  KICK:      { color: 0xFF6B00, emoji: "👢",  label: "Member Kicked",    dmTitle: "You Have Been Kicked",     verb: "kicked"     },
  BAN:       { color: 0xFF0000, emoji: "🔨",  label: "Member Banned",    dmTitle: "You Have Been Banned",     verb: "banned"     },
  TIMEOUT:   { color: 0xFF8C00, emoji: "🔇",  label: "Member Timed Out", dmTitle: "You Have Been Timed Out",  verb: "timed out"  },
  UNBAN:     { color: 0x2ECC71, emoji: "✅",  label: "Member Unbanned",  dmTitle: "You Have Been Unbanned",   verb: "unbanned"   },
  UNWARN:    { color: 0x2ECC71, emoji: "✅",  label: "Warning Removed",  dmTitle: "A Warning Was Removed",    verb: "unwarned"   },
  UNTIMEOUT: { color: 0x2ECC71, emoji: "🔊",  label: "Timeout Removed",  dmTitle: "Your Timeout Was Removed", verb: "untimedout" },
};

// ════════════════════════════════════════════
//              EMBED BUILDERS
// ════════════════════════════════════════════

// ── DM Embed — sent directly to the user ──
function buildDMEmbed({ action, guild, moderator, reason, caseId, duration, totalWarns, evidence }) {
  const meta = ACTION_META[action];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.dmTitle}`)
    .setDescription(`You have been **${meta.verb}** in **${guild.name}**.`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: "Reason",    value: reason || "No reason provided", inline: false },
      { name: "Moderator", value: moderator.tag || moderator.username, inline: true },
      { name: "Server",    value: guild.name, inline: true },
    )
    .setFooter({ text: `Case #${caseId} • ${guild.name}` })
    .setTimestamp();

  if (duration) {
    embed.addFields({ name: "Duration", value: duration, inline: true });
  }

  if (totalWarns !== undefined && action === "WARN") {
    embed.addFields({ name: "Total Warnings", value: `${totalWarns}`, inline: true });
  }

  if (evidence?.messageContent) {
    embed.addFields({
      name:  "Related Message",
      value: `\`\`\`${evidence.messageContent.substring(0, 300)}${evidence.messageContent.length > 300 ? "..." : ""}\`\`\``,
      inline: false,
    });
  }

  const advice = {
    WARN:    "Please review the server rules to avoid further action.",
    KICK:    "You may rejoin the server if you agree to follow the rules.",
    BAN:     "If you believe this was a mistake, you may appeal using the link below.",
    TIMEOUT: "You will be able to chat again once your timeout expires.",
  };

  if (advice[action]) {
    embed.addFields({ name: "Note", value: advice[action], inline: false });
  }

  embed.addFields({
    name:  "Questions?",
    value: `[Open a support ticket](${APPEAL_CHANNEL_LINK})`,
    inline: false,
  });

  return embed;
}

// ── Log Embed — posted to mod-log channel ──
function buildLogEmbed({ action, caseId, targetUser, moderator, reason, duration, evidence, totalWarns, history, commandLink }) {
  const meta = ACTION_META[action];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.label} — Case #${caseId}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      {
        name:  "User",
        value: `${targetUser.tag || targetUser.username}\n<@${targetUser.id}>\n\`${targetUser.id}\``,
        inline: false,
      },
      {
        name:  "Moderator",
        value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`,
        inline: false,
      },
      {
        name:  "Reason",
        value: reason || "No reason provided",
        inline: false,
      }
    )
    .setFooter({ text: `Case #${caseId} • User ID: ${targetUser.id}` })
    .setTimestamp();

  if (duration) {
    embed.addFields({ name: "Duration", value: duration, inline: false });
  }

  if (totalWarns !== undefined) {
    embed.addFields({ name: "Total Active Warnings", value: `${totalWarns}`, inline: false });
  }

  if (commandLink) {
    embed.addFields({ name: "Command Used", value: `[Jump to message](${commandLink})`, inline: false });
  }

  if (evidence?.messageContent) {
    embed.addFields({
      name:  "Evidence",
      value: `\`\`\`${evidence.messageContent.substring(0, 500)}${evidence.messageContent.length > 500 ? "..." : ""}\`\`\``,
      inline: false,
    });
  }

  if (evidence?.editHistory?.length > 0) {
    const editLog = evidence.editHistory
      .slice(-3)
      .map((e, i) => `Edit ${i + 1}: ${e.content?.substring(0, 100) || "—"}`)
      .join("\n");
    embed.addFields({ name: "Edit History", value: `\`\`\`${editLog}\`\`\``, inline: false });
  }

  if (evidence?.channelId) {
    embed.addFields({ name: "Channel", value: `<#${evidence.channelId}>`, inline: false });
  }

  if (evidence?.attachments?.length > 0) {
    embed.addFields({
      name:  "Attachments",
      value: evidence.attachments.slice(0, 3).join("\n"),
      inline: false,
    });
  }

  if (history?.length > 1) {
    const prior = history
      .slice(0, 5)
      .map((h) => {
        const date    = new Date(h.createdAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        const removed = h.active ? "" : " (removed)";
        return `#${h.caseId} ${h.action}${removed} — ${date}\n${(h.reason || "No reason").substring(0, 50)}`;
      })
      .join("\n\n");

    embed.addFields({
      name:  `Prior Cases (${history.length} total)`,
      value: `\`\`\`${prior}\`\`\``,
      inline: false,
    });
  }

  return embed;
}

// ── Confirm Embed — shown in the command channel ──
function buildConfirmEmbed({ action, targetUser, reason, caseId, duration, totalWarns }) {
  const meta = ACTION_META[action];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(`**${targetUser.tag || targetUser.username}** has been **${meta.verb}**.`)
    .addFields(
      { name: "Case",   value: `#${caseId}`,               inline: false },
      { name: "Reason", value: reason || "No reason provided", inline: false },
    )
    .setTimestamp();

  if (duration) {
    embed.addFields({ name: "Duration", value: duration, inline: false });
  }

  if (totalWarns !== undefined) {
    embed.addFields({ name: "Total Warnings", value: `${totalWarns}`, inline: false });
  }

  return embed;
}

// ── History Embed ──
function buildHistoryEmbed({ targetUser, history, guild }) {
  const activeWarns   = history.filter((h) => h.action === "WARN"    && h.active).length;
  const totalBans     = history.filter((h) => h.action === "BAN"    ).length;
  const totalKicks    = history.filter((h) => h.action === "KICK"   ).length;
  const totalTimeouts = history.filter((h) => h.action === "TIMEOUT").length;

  const embed = new EmbedBuilder()
    .setColor(history.length > 0 ? 0xFF6B00 : 0x2ECC71)
    .setTitle(`📋 Moderation History — ${targetUser.tag || targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      { name: "User",            value: `<@${targetUser.id}>\n\`${targetUser.id}\``, inline: false },
      { name: "Active Warnings", value: `${activeWarns}`,   inline: true },
      { name: "Kicks",           value: `${totalKicks}`,    inline: true },
      { name: "Bans",            value: `${totalBans}`,     inline: true },
      { name: "Timeouts",        value: `${totalTimeouts}`, inline: true },
      { name: "Total Cases",     value: `${history.length}`,inline: true },
    )
    .setFooter({ text: guild.name })
    .setTimestamp();

  if (history.length === 0) {
    embed.setDescription("This user has a **clean record** — no moderation history found.");
    return embed;
  }

  const caseLines = history.slice(0, 10).map((h) => {
    const meta = ACTION_META[h.action];
    const date = new Date(h.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    const removed = h.active ? "" : " ~~(removed)~~";
    return (
      `${meta?.emoji ?? "•"} \`#${h.caseId}\` **${h.action}**${removed} — ${date}\n` +
      `↳ ${(h.reason || "No reason").substring(0, 60)}`
    );
  });

  embed.addFields({
    name:  `Cases (${Math.min(history.length, 10)} of ${history.length})`,
    value: caseLines.join("\n\n"),
    inline: false,
  });

  return embed;
}

// ════════════════════════════════════════════
//         MESSAGE SNAPSHOT LISTENERS
// ════════════════════════════════════════════
let snapshotListenersRegistered = false;

function registerSnapshotListeners(client) {
  if (snapshotListenersRegistered) return;
  snapshotListenersRegistered = true;

  const MessageSnapshot = getMessageSnapshot();

  client.on("messageCreate", async (message) => {
    if (!message.guild || !message.id) return;
    try {
      const attachments = [...(message.attachments?.values() ?? [])].map((a) => ({
        url: a.url, name: a.name, contentType: a.contentType,
      }));

      await MessageSnapshot.findOneAndUpdate(
        { messageId: message.id },
        {
          $setOnInsert: {
            messageId:        message.id,
            guildId:          message.guild.id,
            channelId:        message.channel.id,
            channelName:      message.channel.name || "unknown",
            authorId:         message.author?.id       || "unknown",
            authorUsername:   message.author?.username  || "unknown",
            authorTag:        message.author?.tag || message.author?.username || "unknown",
            content:          message.content || "",
            attachments,
            hasEmbeds:        (message.embeds?.length ?? 0) > 0,
            messageCreatedAt: message.createdAt,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      if (!err.message?.includes("duplicate key")) {
        logger.debug("Snapshot save error:", err.message);
      }
    }
  });

  client.on("messageUpdate", async (oldMsg, newMsg) => {
    if (!newMsg.guild || !newMsg.id) return;
    if ((oldMsg.content ?? "") === (newMsg.content ?? "")) return;
    try {
      await MessageSnapshot.findOneAndUpdate(
        { messageId: newMsg.id },
        {
          $set:  { content: newMsg.content || "" },
          $push: { editHistory: { content: oldMsg.content || "", editedAt: new Date() } },
          $setOnInsert: {
            messageId:        newMsg.id,
            guildId:          newMsg.guild.id,
            channelId:        newMsg.channel.id,
            channelName:      newMsg.channel.name || "unknown",
            authorId:         newMsg.author?.id   || "unknown",
            authorUsername:   newMsg.author?.username || "unknown",
            authorTag:        newMsg.author?.tag   || "unknown",
            messageCreatedAt: newMsg.createdAt,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.debug("Snapshot edit error:", err.message);
    }
  });

  client.on("messageDelete", async (message) => {
    if (!message.guild || !message.id) return;
    try {
      await MessageSnapshot.findOneAndUpdate(
        { messageId: message.id },
        { $set: { deleted: true, deletedAt: new Date() } }
      );
    } catch (err) {
      logger.debug("Snapshot delete error:", err.message);
    }
  });

  logger.info("Message snapshot listeners registered");
}

// ════════════════════════════════════════════
//              SMALL HELPERS
// ════════════════════════════════════════════
function errEmbed(title, desc) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`❌ ${title}`)
    .setDescription(desc);
}

function usageEmbed(lines, extraFields = []) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle("Usage")
    .addFields({ name: "Command", value: lines.join("\n"), inline: false });
  for (const f of extraFields) embed.addFields(f);
  return embed;
}

async function respond(message, embeds) {
  return message.channel.send({ embeds }).catch(() => {});
}

// ════════════════════════════════════════════
//              COMMAND HANDLERS
// ════════════════════════════════════════════

// ── WARN ──────────────────────────────────
async function handleWarn(message, args, client) {
  const targetMember =
    message.mentions.members?.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!targetMember) {
    return respond(message, [usageEmbed(
      ["eb warn @user", "eb warn @user <reason>"],
      [{ name: "Tip", value: "Reply to a message before warning to attach it as evidence." }]
    )]);
  }

  if (targetMember.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot warn yourself.")]);
  }
  if (targetMember.id === client.user.id) {
    return respond(message, [errEmbed("Error", "You cannot warn me.")]);
  }
  if (!hierarchyOk(message, targetMember)) {
    return respond(message, [errEmbed("Hierarchy Error", "You cannot action someone with equal or higher roles.")]);
  }

  const reason      = parseReason(message.content, "warn", !!message.mentions.members?.first());
  const evidence    = await extractEvidence(message);
  const history     = await getUserHistory(message.guild.id, targetMember.id);
  const activeWarns = history.filter((h) => h.action === "WARN" && h.active).length;
  const totalWarns  = activeWarns + 1;

  const modCase = await createCase({
    guildId:          message.guild.id,
    action:           "WARN",
    targetUser:       targetMember.user,
    moderator:        message.author,
    reason,
    evidence,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  // DM user
  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "WARN", guild: message.guild, moderator: message.author,
      reason, caseId: modCase.caseId, totalWarns, evidence,
    })] });
  } catch (_) {}

  // Log channel
  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logMsg = await logChannel.send({ embeds: [buildLogEmbed({
      action: "WARN", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, evidence, totalWarns, history, commandLink,
    })] }).catch(() => null);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  // Confirm
  await respond(message, [buildConfirmEmbed({
    action: "WARN", targetUser: targetMember.user,
    reason, caseId: modCase.caseId, totalWarns,
  })]);

  // Escalation alert
  if (totalWarns >= 3 && logChannel) {
    await logChannel.send({ embeds: [
      new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🚨 Escalation Alert")
        .setDescription(
          `<@${targetMember.id}> now has **${totalWarns}** active warnings.\n` +
          `Consider taking further action against **${targetMember.user.tag}** (\`${targetMember.id}\`).`
        )
        .setTimestamp(),
    ] }).catch(() => {});
  }
}

// ── KICK ──────────────────────────────────
async function handleKick(message, args, client) {
  if (!message.guild.members.me.permissions.has("KickMembers")) {
    return respond(message, [errEmbed("Missing Permission", "I don't have permission to kick members.")]);
  }

  const targetMember =
    message.mentions.members?.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!targetMember) {
    return respond(message, [usageEmbed(
      ["eb kick @user", "eb kick @user <reason>"],
      [{ name: "Tip", value: "Reply to a message before kicking to attach it as evidence." }]
    )]);
  }

  if (targetMember.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot kick yourself.")]);
  }
  if (!targetMember.kickable) {
    return respond(message, [errEmbed("Cannot Kick", "I cannot kick this member. They may have higher permissions than me.")]);
  }
  if (!hierarchyOk(message, targetMember)) {
    return respond(message, [errEmbed("Hierarchy Error", "You cannot action someone with equal or higher roles.")]);
  }

  const reason      = parseReason(message.content, "kick", !!message.mentions.members?.first());
  const evidence    = await extractEvidence(message);
  const history     = await getUserHistory(message.guild.id, targetMember.id);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  // DM before kick
  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "KICK", guild: message.guild, moderator: message.author,
      reason, caseId: "pending", evidence,
    })] });
  } catch (_) {}

  await targetMember.kick(`[${message.author.tag}] ${reason}`);

  const modCase = await createCase({
    guildId:          message.guild.id,
    action:           "KICK",
    targetUser:       targetMember.user,
    moderator:        message.author,
    reason,
    evidence,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    const logMsg = await logChannel.send({ embeds: [buildLogEmbed({
      action: "KICK", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, evidence, history, commandLink,
    })] }).catch(() => null);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  await respond(message, [buildConfirmEmbed({
    action: "KICK", targetUser: targetMember.user,
    reason, caseId: modCase.caseId,
  })]);
}

// ── BAN ───────────────────────────────────
async function handleBan(message, args, client) {
  if (!message.guild.members.me.permissions.has("BanMembers")) {
    return respond(message, [errEmbed("Missing Permission", "I don't have permission to ban members.")]);
  }

  const daysMatch         = message.content.match(/--days\s+(\d+)/i);
  const deleteMessageDays = daysMatch ? Math.min(parseInt(daysMatch[1]), 7) : 0;

  const targetUser =
    message.mentions.users?.first() ||
    (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

  if (!targetUser) {
    return respond(message, [usageEmbed(
      [
        "eb ban @user",
        "eb ban @user <reason>",
        "eb ban @user --days 7 <reason>",
      ],
      [{ name: "Options", value: "`--days <1-7>` — delete that many days of messages" }]
    )]);
  }

  if (targetUser.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot ban yourself.")]);
  }

  const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);

  if (targetMember) {
    if (!targetMember.bannable) {
      return respond(message, [errEmbed("Cannot Ban", "I cannot ban this member. They may have higher permissions than me.")]);
    }
    if (!hierarchyOk(message, targetMember)) {
      return respond(message, [errEmbed("Hierarchy Error", "You cannot action someone with equal or higher roles.")]);
    }
  }

  let reason = message.content
    .slice(message.content.toLowerCase().indexOf("ban") + 3)
    .replace(/^<@!?\d+>\s*/, "")
    .replace(/--days\s+\d+\s*/gi, "")
    .trim() || "No reason provided";

  const evidence    = await extractEvidence(message);
  const history     = await getUserHistory(message.guild.id, targetUser.id);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  // DM before ban
  if (targetMember) {
    try {
      await targetMember.send({ embeds: [buildDMEmbed({
        action: "BAN", guild: message.guild, moderator: message.author,
        reason, caseId: "pending", evidence,
      })] });
    } catch (_) {}
  }

  await message.guild.members.ban(targetUser.id, {
    deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
    reason: `[${message.author.tag}] ${reason}`,
  });

  const modCase = await createCase({
    guildId:          message.guild.id,
    action:           "BAN",
    targetUser,
    moderator:        message.author,
    reason,
    evidence,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "BAN", caseId: modCase.caseId, targetUser,
      moderator: message.author, reason, evidence, history, commandLink,
    });

    if (deleteMessageDays > 0) {
      logEmbed.addFields({
        name:  "Messages Purged",
        value: `Last ${deleteMessageDays} day(s) of messages deleted`,
        inline: false,
      });
    }

    const logMsg = await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  const confirmEmbed = buildConfirmEmbed({
    action: "BAN", targetUser, reason, caseId: modCase.caseId,
  });

  if (deleteMessageDays > 0) {
    confirmEmbed.addFields({
      name:  "Messages Purged",
      value: `Last ${deleteMessageDays} day(s) deleted`,
      inline: false,
    });
  }

  await respond(message, [confirmEmbed]);
}

// ── TIMEOUT ───────────────────────────────
async function handleTimeout(message, args, client) {
  if (!message.guild.members.me.permissions.has("ModerateMembers")) {
    return respond(message, [errEmbed("Missing Permission", "I don't have permission to timeout members.")]);
  }

  const targetMember =
    message.mentions.members?.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!targetMember) {
    return respond(message, [usageEmbed(
      [
        "eb timeout @user <duration> [reason]",
        "eb timeout @user 10m Spamming",
        "eb timeout @user 2h Excessive trolling",
        "eb timeout @user 1d Repeated violations",
      ],
      [{ name: "Duration Format", value: "`s` seconds · `m` minutes · `h` hours · `d` days · `w` weeks (max 28 days)" }]
    )]);
  }

  if (targetMember.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot timeout yourself.")]);
  }
  if (!targetMember.moderatable) {
    return respond(message, [errEmbed("Cannot Timeout", "I cannot timeout this member. They may have higher permissions than me.")]);
  }
  if (!hierarchyOk(message, targetMember)) {
    return respond(message, [errEmbed("Hierarchy Error", "You cannot action someone with equal or higher roles.")]);
  }

  const cleanArgs   = args.filter((a) => !a.match(/^<@!?\d+>$/) && a !== targetMember.id);
  const durationArg = cleanArgs.find((a) => /^\d+(s|m|h|d|w)$/i.test(a));

  if (!durationArg) {
    return respond(message, [usageEmbed(
      ["eb timeout @user 10m", "eb timeout @user 2h Spamming"],
      [{ name: "Duration Format", value: "`s` seconds · `m` minutes · `h` hours · `d` days · `w` weeks" }]
    )]);
  }

  const durationMs = parseDuration(durationArg);
  if (!durationMs) {
    return respond(message, [errEmbed("Invalid Duration", "Must be between 1 second and 28 days.\nExample: `10m`, `2h`, `1d`")]);
  }

  const durationFormatted = formatDuration(durationMs);
  const durationIdx       = cleanArgs.indexOf(durationArg);
  const reason            = cleanArgs.slice(durationIdx + 1).join(" ") || "No reason provided";
  const evidence          = await extractEvidence(message);
  const history           = await getUserHistory(message.guild.id, targetMember.id);
  const commandLink       = buildJumpLink(message.guild.id, message.channel.id, message.id);
  const expiresTs         = Math.floor((Date.now() + durationMs) / 1000);

  // DM before timeout
  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "TIMEOUT", guild: message.guild, moderator: message.author,
      reason, caseId: "pending", duration: durationFormatted, evidence,
    })] });
  } catch (_) {}

  await targetMember.timeout(durationMs, `[${message.author.tag}] ${reason}`);

  const modCase = await createCase({
    guildId:          message.guild.id,
    action:           "TIMEOUT",
    targetUser:       targetMember.user,
    moderator:        message.author,
    reason,
    duration:         durationMs,
    durationString:   durationFormatted,
    evidence,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "TIMEOUT", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, duration: durationFormatted, evidence, history, commandLink,
    });
    logEmbed.addFields({ name: "Expires", value: `<t:${expiresTs}:F>`, inline: false });

    const logMsg = await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  const confirmEmbed = buildConfirmEmbed({
    action: "TIMEOUT", targetUser: targetMember.user,
    reason, caseId: modCase.caseId, duration: durationFormatted,
  });
  confirmEmbed.addFields({ name: "Expires", value: `<t:${expiresTs}:F>`, inline: false });

  await respond(message, [confirmEmbed]);
}

// ── UNWARN ────────────────────────────────
async function handleUnwarn(message, args, client) {
  const caseId = parseInt(args[0]);

  if (isNaN(caseId) || caseId < 1) {
    return respond(message, [usageEmbed(
      ["eb unwarn <caseId>", "eb unwarn 5"],
      [{ name: "Tip", value: "Use `eb modlogs @user` to find case IDs" }]
    )]);
  }

  const modCase = await getCaseById(message.guild.id, caseId);

  if (!modCase) {
    return respond(message, [errEmbed("Not Found", `Case **#${caseId}** does not exist in this server.`)]);
  }
  if (modCase.action !== "WARN") {
    return respond(message, [errEmbed("Wrong Type", `Case **#${caseId}** is a **${modCase.action}**, not a warning.`)]);
  }
  if (!modCase.active) {
    return respond(message, [errEmbed("Already Removed", `Case **#${caseId}** has already been removed.`)]);
  }

  await deactivateCase(message.guild.id, caseId);

  const ModerationLog  = getModerationLog();
  const remainingWarns = await ModerationLog.countDocuments({
    guildId: message.guild.id,
    userId:  modCase.userId,
    action:  "WARN",
    active:  true,
  });

  const targetUser = await client.users.fetch(modCase.userId).catch(() => ({
    id: modCase.userId, username: modCase.username,
    tag: modCase.userTag, displayAvatarURL: () => null,
  }));

  const unwarnCase = await createCase({
    guildId:          message.guild.id,
    action:           "UNWARN",
    targetUser,
    moderator:        message.author,
    reason:           `Removed warning #${caseId}: ${modCase.reason?.substring(0, 80)}`,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "UNWARN", caseId: unwarnCase.caseId,
      targetUser, moderator: message.author,
      reason:     `Removed warning from case #${caseId}`,
      totalWarns: remainingWarns,
      commandLink,
    });
    logEmbed.addFields({
      name:  "Removed Case",
      value: `#${caseId} — ${(modCase.reason || "No reason").substring(0, 100)}`,
      inline: false,
    });
    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }

  // Confirm to moderator
  await respond(message, [
    new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("✅ Warning Removed")
      .setDescription(`Warning **#${caseId}** has been removed from **${targetUser.tag || targetUser.username}**.`)
      .addFields(
        { name: "User",               value: `<@${targetUser.id}>`,                  inline: false },
        { name: "Original Reason",    value: modCase.reason || "No reason provided", inline: false },
        { name: "Remaining Warnings", value: `${remainingWarns}`,                    inline: false },
      )
      .setTimestamp(),
  ]);

  // DM user
  try {
    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      await targetMember.send({ embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle("✅ Warning Removed")
          .setDescription(`A warning has been removed from your record in **${message.guild.name}**.`)
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .addFields(
            { name: "Case Removed",       value: `#${caseId}`,   inline: true  },
            { name: "Remaining Warnings", value: `${remainingWarns}`, inline: true },
            {
              name:  "Questions?",
              value: `[Open a support ticket](${APPEAL_CHANNEL_LINK})`,
              inline: false,
            },
          )
          .setFooter({ text: message.guild.name })
          .setTimestamp(),
      ] });
    }
  } catch (_) {}
}

// ── MODLOGS ───────────────────────────────
async function handleModlogs(message, args, client) {
  const caseMatch = message.content.match(/--case\s+(\d+)/i);
  if (caseMatch) return handleCase(message, [caseMatch[1]], client);

  const targetUser =
    message.mentions.users?.first() ||
    (args[0] && !args[0].startsWith("--")
      ? await client.users.fetch(args[0]).catch(() => null)
      : null);

  if (!targetUser) {
    return respond(message, [usageEmbed([
      "eb modlogs @user",
      "eb modlogs <userId>",
      "eb modlogs @user --case 5",
    ])]);
  }

  const history = await getUserHistory(message.guild.id, targetUser.id);
  await respond(message, [buildHistoryEmbed({ targetUser, history, guild: message.guild })]);
}

// ── CASE ──────────────────────────────────
async function handleCase(message, args, client) {
  const caseId = parseInt(args[0]);

  if (isNaN(caseId) || caseId < 1) {
    return respond(message, [usageEmbed(["eb case <caseId>", "eb case 5"])]);
  }

  const modCase = await getCaseById(message.guild.id, caseId);

  if (!modCase) {
    return respond(message, [errEmbed("Not Found", `Case **#${caseId}** does not exist in this server.`)]);
  }

  const meta = ACTION_META[modCase.action] ?? { emoji: "•", color: 0x5865F2, label: "Unknown" };

  const targetUser = await client.users.fetch(modCase.userId).catch(() => ({
    id: modCase.userId, username: modCase.username,
    tag: modCase.userTag, displayAvatarURL: () => null,
  }));

  const moderatorUser = await client.users.fetch(modCase.moderatorId).catch(() => ({
    id: modCase.moderatorId, username: modCase.moderatorUsername, tag: modCase.moderatorTag,
  }));

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.label} — Case #${modCase.caseId}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      {
        name:  "User",
        value: `${targetUser.tag || targetUser.username}\n<@${targetUser.id}>\n\`${targetUser.id}\``,
        inline: false,
      },
      {
        name:  "Moderator",
        value: `${moderatorUser.tag || moderatorUser.username} (<@${moderatorUser.id}>)`,
        inline: false,
      },
      { name: "Reason", value: modCase.reason || "No reason provided",                                            inline: false },
      { name: "Date",   value: `<t:${Math.floor(new Date(modCase.createdAt).getTime() / 1000)}:F>`,               inline: false },
      { name: "Status", value: modCase.active ? "Active" : "Removed",                                             inline: false },
    )
    .setFooter({ text: `${message.guild.name} • Case #${caseId}` })
    .setTimestamp();

  if (modCase.durationString) {
    embed.addFields({ name: "Duration", value: modCase.durationString, inline: false });
  }
  if (modCase.expiresAt) {
    embed.addFields({
      name:  "Expires",
      value: `<t:${Math.floor(new Date(modCase.expiresAt).getTime() / 1000)}:F>`,
      inline: false,
    });
  }

  const commandLink = buildJumpLink(message.guild.id, modCase.commandChannelId, modCase.commandMessageId);
  if (commandLink) {
    embed.addFields({ name: "Command Used", value: `[Jump to message](${commandLink})`, inline: false });
  }

  if (modCase.evidence?.messageContent) {
    embed.addFields({
      name:  "Evidence",
      value: `\`\`\`${modCase.evidence.messageContent.substring(0, 400)}${modCase.evidence.messageContent.length > 400 ? "..." : ""}\`\`\``,
      inline: false,
    });
  }

  if (modCase.evidence?.editHistory?.length > 0) {
    const editLog = modCase.evidence.editHistory
      .slice(-3)
      .map((e, i) => `Edit ${i + 1}: ${e.content?.substring(0, 100) || "—"}`)
      .join("\n");
    embed.addFields({ name: "Edit History", value: `\`\`\`${editLog}\`\`\``, inline: false });
  }

  if (modCase.evidence?.channelId) {
    embed.addFields({ name: "Channel", value: `<#${modCase.evidence.channelId}>`, inline: false });
  }

  await respond(message, [embed]);
}

// ── MODHELP ───────────────────────────────
async function handleModhelp(message) {
  const level = getMemberLevel(message.member);

  const allCommands = [
    { cmd: "eb warn @user [reason]",               desc: "Issue a warning to a user",                      level: 1 },
    { cmd: "eb timeout @user <duration> [reason]", desc: "Timeout a user (s / m / h / d / w, max 28d)",   level: 1 },
    { cmd: "eb kick @user [reason]",               desc: "Kick a user from the server",                    level: 3 },
    { cmd: "eb ban @user [--days N] [reason]",     desc: "Permanently ban a user (--days removes messages)",level: 3 },
    { cmd: "eb unwarn <caseId>",                   desc: "Remove a warning by its case ID",                level: 3 },
    { cmd: "eb modlogs @user",                     desc: "View full moderation history of a user",         level: 1 },
    { cmd: "eb case <caseId>",                     desc: "View full details of a specific case",           level: 1 },
  ];

  const available = allCommands.filter((c) => c.level <= level);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🛡️ Moderation Commands")
    .setDescription("Commands available to your role are listed below.")
    .addFields(
      available.map((c) => ({
        name:   c.cmd,
        value:  c.desc,
        inline: false,
      }))
    )
    .addFields({
      name:  "Evidence System",
      value: "Reply to any message before using a mod command to automatically attach it as evidence — content, edits, and attachments are all preserved even if the user deletes the message.",
      inline: false,
    })
    .setFooter({ text: "All actions are logged to the mod-log channel." })
    .setTimestamp();

  await respond(message, [embed]);
}

// ════════════════════════════════════════════
//              MAIN ROUTER
// ════════════════════════════════════════════
module.exports = {
  name: "moderation",
  commands: MOD_COMMANDS,

  init(client) {
    registerSnapshotListeners(client);
  },

  async execute(message, args, client, commandName) {
    if (!hasModPermission(message.member)) {
      return respond(message, [errEmbed("Access Denied", "You don't have permission to use moderation commands.")]);
    }

    if (!canUseCommand(message.member, commandName)) {
      return respond(message, [errEmbed("Access Denied", `Your role cannot use \`eb ${commandName}\`.`)]);
    }

    try {
      switch (commandName) {
        case "warn":    return await handleWarn   (message, args, client);
        case "kick":    return await handleKick   (message, args, client);
        case "ban":     return await handleBan    (message, args, client);
        case "timeout": return await handleTimeout(message, args, client);
        case "unwarn":  return await handleUnwarn (message, args, client);
        case "modlogs": return await handleModlogs(message, args, client);
        case "case":    return await handleCase   (message, args, client);
        case "modhelp": return await handleModhelp(message);
        default:
          return respond(message, [errEmbed("Unknown Command", "Use `eb modhelp` for a list of available commands.")]);
      }
    } catch (err) {
      logger.error(`Moderation error [${commandName}]: ${err.message}`);
      logger.error(err.stack);
      await respond(message, [errEmbed("Unexpected Error", "Something went wrong. Please try again.")]);
    }
  },
};