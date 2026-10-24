// commands/moderation.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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

const JAIL_ROLE_ID     = "1498459449227083916"; // Jail role
const INITIATE_ROLE_ID = "1330560814536589433"; // role removed on jail, restored on unjail/pardon

// Auto-Jail escalation
const AUTO_JAIL_WARN_THRESHOLD = 3;    // auto-jail when a member hits exactly this many ACTIVE warnings
const AUTO_JAIL_DURATION       = "2h"; // duration string parsed via parseDuration()

const LEVEL_COMMANDS = {
  1: ["warn", "timeout", "modlogs", "case", "modhelp", "warnings", "rfstatus", "rfhistory"],
  3: [
    "warn", "kick", "ban", "timeout", "unwarn", "modlogs", "case", "modhelp",
    "warnings", "jail", "unjail", "pardon", "redflag", "unredflag", "rfstatus", "rfhistory",
  ],
};

const MOD_COMMANDS = [
  "warn", "kick", "ban", "timeout", "unwarn", "modlogs", "modhelp",
  "case", "warnings", "mh", "jail", "unjail", "pardon",
  "redflag", "unredflag", "rfstatus", "rfhistory",
];

const COMMAND_ALIASES = {
  mh: "modhelp",
  rfstatus: "redflagstatus",
  rfs: "redflagstatus",
  rfhistory: "redflaghistory",
  rfh: "redflaghistory",
};

// ════════════════════════════════════════════
//         DATABASE SCHEMAS
// ════════════════════════════════════════════

// MODERATION LOG SCHEMA
const moderationLogSchema = new mongoose.Schema(
  {
    caseId:            { type: Number, required: true },
    guildId:           { type: String, required: true, index: true },
    action: {
      type: String,
      enum: [
        "WARN", "KICK", "BAN", "TIMEOUT", "UNBAN", "UNWARN", "UNTIMEOUT",
        "JAIL", "UNJAIL",
      ],
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
    },
    duration:         { type: Number,  default: null },
    durationString:   { type: String,  default: null },
    expiresAt:        { type: Date,    default: null },
    logMessageId:     { type: String,  default: null },
    commandChannelId: { type: String,  default: null },
    commandMessageId: { type: String,  default: null },
    active:           { type: Boolean, default: true },

    // Removal tracking (UNWARN / UNTIMEOUT / UNBAN / UNJAIL / pardons)
    removedAt:        { type: Date,    default: null },
    removedBy:        { type: String,  default: null },
    removedByTag:     { type: String,  default: null },
    removalReason:    { type: String,  default: null },
    relatedCaseId:    { type: Number,  default: null },
  },
  { timestamps: true }
);

moderationLogSchema.index({ guildId: 1, caseId: 1 }, { unique: true });

function getModerationLog() {
  return mongoose.models.ModerationLog ||
    mongoose.model("ModerationLog", moderationLogSchema);
}

// RED FLAG SCHEMA
const redFlagSchema = new mongoose.Schema(
  {
    guildId:           { type: String, required: true, index: true },
    userId:            { type: String, required: true, index: true },
    username:          { type: String, required: true },
    userTag:           { type: String, required: true },
    flaggedBy:         { type: String, required: true },
    flaggedByTag:      { type: String, required: true },
    reason:            { type: String, default: "No reason provided" },
    active:            { type: Boolean, default: true },
    logMessageId:      { type: String, default: null },
    commandChannelId:  { type: String, default: null },
    commandMessageId:  { type: String, default: null },

    // Removal tracking
    removedAt:         { type: Date, default: null },
    removedBy:         { type: String, default: null },
    removedByTag:      { type: String, default: null },
    removalReason:     { type: String, default: null },
  },
  { timestamps: true }
);

redFlagSchema.index({ guildId: 1, userId: 1 }, { unique: false });

function getRedFlagModel() {
  return mongoose.models.RedFlag ||
    mongoose.model("RedFlag", redFlagSchema);
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

function parseJailDuration(str) {
  return parseDuration(str);
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

async function deactivateCase(guildId, caseId, removalInfo = {}) {
  const ModerationLog = getModerationLog();
  const { removedBy, removedByTag, removalReason } = removalInfo;

  return ModerationLog.findOneAndUpdate(
    { guildId, caseId },
    {
      active:        false,
      removedAt:     new Date(),
      removedBy:     removedBy     || null,
      removedByTag:  removedByTag  || null,
      removalReason: removalReason || null,
    },
    { new: true }
  );
}

// ════════════════════════════════════════════
//    RED FLAG DATABASE HELPERS
// ════════════════════════════════════════════
async function getActiveRedFlag(guildId, userId) {
  const RedFlag = getRedFlagModel();
  return RedFlag.findOne({ guildId, userId, active: true });
}

async function getUserRedFlags(guildId, userId) {
  const RedFlag = getRedFlagModel();
  return RedFlag.find({ guildId, userId }).sort({ createdAt: -1 });
}

async function getAllActiveRedFlags(guildId) {
  const RedFlag = getRedFlagModel();
  return RedFlag.find({ guildId, active: true }).sort({ createdAt: -1 });
}

async function createRedFlag({
  guildId, targetUser, flaggedBy, reason,
  commandChannelId, commandMessageId,
}) {
  const RedFlag = getRedFlagModel();

  // Check if already flagged
  const existing = await getActiveRedFlag(guildId, targetUser.id);
  if (existing) return null;

  const doc = new RedFlag({
    guildId,
    userId:           targetUser.id,
    username:         targetUser.username,
    userTag:          targetUser.tag || targetUser.username,
    flaggedBy:        flaggedBy.id,
    flaggedByTag:     flaggedBy.tag || flaggedBy.username,
    reason:           reason || "No reason provided",
    commandChannelId: commandChannelId || null,
    commandMessageId: commandMessageId || null,
  });

  await doc.save();
  return doc;
}

async function removeRedFlag(guildId, userId, removalInfo = {}) {
  const RedFlag = getRedFlagModel();
  const { removedBy, removedByTag, removalReason } = removalInfo;

  return RedFlag.findOneAndUpdate(
    { guildId, userId, active: true },
    {
      active:         false,
      removedAt:      new Date(),
      removedBy:      removedBy     || null,
      removedByTag:   removedByTag  || null,
      removalReason:  removalReason || null,
    },
    { new: true }
  );
}

// ════════════════════════════════════════════
//    EVIDENCE — only from replied message
// ════════════════════════════════════════════
async function extractEvidence(message) {
  if (!message.reference?.messageId) return null;

  try {
    const refMsg = await message.channel.messages.fetch(
      message.reference.messageId
    );

    return {
      messageId:      refMsg.id,
      messageContent: refMsg.content || null,
      channelId:      refMsg.channel.id,
      channelName:    refMsg.channel.name,
      attachments:    [...refMsg.attachments.values()].map((a) => a.url),
    };
  } catch {
    return null;
  }
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
  WARN:      { color: 0xFFAA00, emoji: "⚠️", label: "Warning Issued",            dmTitle: "You Have Been Warned",      verb: "warned"            },
  KICK:      { color: 0xFF6B00, emoji: "👢", label: "Member Kicked",             dmTitle: "You Have Been Kicked",      verb: "kicked"            },
  BAN:       { color: 0xFF0000, emoji: "🔨", label: "Member Banned",             dmTitle: "You Have Been Banned",      verb: "banned"            },
  TIMEOUT:   { color: 0xFF8C00, emoji: "🔇", label: "Member Timed Out",          dmTitle: "You Have Been Timed Out",   verb: "timed out"         },
  UNBAN:     { color: 0x2ECC71, emoji: "✅", label: "Member Unbanned",           dmTitle: "You Have Been Unbanned",    verb: "unbanned"          },
  UNWARN:    { color: 0x2ECC71, emoji: "✅", label: "Warning Removed",           dmTitle: "A Warning Was Removed",     verb: "unwarned"          },
  UNTIMEOUT: { color: 0x2ECC71, emoji: "🔊", label: "Timeout Removed",           dmTitle: "Your Timeout Was Removed",  verb: "untimedout"        },
  JAIL:      { color: 0x8B0000, emoji: "⛓️", label: "Member Jailed",             dmTitle: "You Have Been Jailed",      verb: "jailed"            },
  UNJAIL:    { color: 0x2ECC71, emoji: "🔓", label: "Member Released From Jail", dmTitle: "You Have Been Released",    verb: "released from Jail"},
};

// ════════════════════════════════════════════
//              EMBED BUILDERS
// ════════════════════════════════════════════
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
    embed.addFields({ name: "Duration", value: duration, inline: false });
  }

  if (totalWarns !== undefined && action === "WARN") {
    embed.addFields({ name: "Total Warnings", value: `${totalWarns}`, inline: false });
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
    JAIL:    "You will be released automatically once your sentence ends, or sooner if pardoned.",
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
      { name: "Reason", value: reason || "No reason provided", inline: false },
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

  if (evidence?.channelId) {
    embed.addFields({ name: "Message Channel", value: `<#${evidence.channelId}>`, inline: false });
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

function buildConfirmEmbed({ action, targetUser, reason, caseId, duration, totalWarns }) {
  const meta = ACTION_META[action];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(`**${targetUser.tag || targetUser.username}** has been **${meta.verb}**.`)
    .addFields(
      { name: "Case",   value: `#${caseId}`,                    inline: false },
      { name: "Reason", value: reason || "No reason provided",  inline: false },
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

function buildHistoryEmbed({ targetUser, history, guild }) {
  const activeWarns   = history.filter((h) => h.action === "WARN"    && h.active).length;
  const totalBans     = history.filter((h) => h.action === "BAN"    ).length;
  const totalKicks    = history.filter((h) => h.action === "KICK"   ).length;
  const totalTimeouts = history.filter((h) => h.action === "TIMEOUT").length;
  const totalJails    = history.filter((h) => h.action === "JAIL"   ).length;

  const embed = new EmbedBuilder()
    .setColor(history.length > 0 ? 0xFF6B00 : 0x2ECC71)
    .setTitle(`📋 Moderation History — ${targetUser.tag || targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      { name: "User",            value: `<@${targetUser.id}>\n\`${targetUser.id}\``, inline: false },
      { name: "Active Warnings", value: `${activeWarns}`,    inline: true },
      { name: "Kicks",           value: `${totalKicks}`,     inline: true },
      { name: "Bans",            value: `${totalBans}`,      inline: true },
      { name: "Timeouts",        value: `${totalTimeouts}`,  inline: true },
      { name: "Jails",           value: `${totalJails}`,     inline: true },
      { name: "Total Cases",     value: `${history.length}`, inline: true },
    )
    .setFooter({ text: `${guild.name} • Use "eb warnings @user" for full warning details` })
    .setTimestamp();

  if (history.length === 0) {
    embed.setDescription("This user has a **clean record** — no moderation history found.");
    return embed;
  }

  const caseLines = history.slice(0, 10).map((h) => {
    const meta    = ACTION_META[h.action];
    const date    = new Date(h.createdAt).toLocaleDateString("en-US", {
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
//    RED FLAG EMBED BUILDERS
// ════════════════════════════════════════════
function buildRedFlagLogEmbed({
  action, targetUser, flaggedBy, reason, commandLink,
}) {
  const isRaised = action === "REDFLAG";
  const color = isRaised ? 0xFF6B00 : 0x2ECC71;
  const emoji = isRaised ? "🚩" : "✅";
  const title = isRaised ? "Red Flag Raised" : "Red Flag Removed";

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ${title}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      {
        name:  "User",
        value: `${targetUser.tag || targetUser.username}\n<@${targetUser.id}>\n\`${targetUser.id}\``,
        inline: false,
      },
      {
        name:  "Actioned By",
        value: `${flaggedBy.tag || flaggedBy.username} (<@${flaggedBy.id}>)`,
        inline: false,
      },
      { name: "Reason", value: reason || "No reason provided", inline: false },
    )
    .setFooter({ text: `User ID: ${targetUser.id}` })
    .setTimestamp();

  if (commandLink) {
    embed.addFields({ name: "Command Used", value: `[Jump to message](${commandLink})`, inline: false });
  }

  return embed;
}

function buildRedFlagConfirmEmbed({ action, targetUser, reason }) {
  const isRaised = action === "REDFLAG";
  const color = isRaised ? 0xFF6B00 : 0x2ECC71;
  const emoji = isRaised ? "🚩" : "✅";
  const title = isRaised ? "Red Flag Raised" : "Red Flag Removed";
  const desc = isRaised
    ? `**${targetUser.tag || targetUser.username}** has been **placed under monitoring**.`
    : `**${targetUser.tag || targetUser.username}** has been **removed from monitoring**.`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ${title}`)
    .setDescription(desc)
    .addFields(
      { name: "User",   value: `<@${targetUser.id}>`, inline: false },
      { name: "Reason", value: reason || "No reason provided", inline: false },
    )
    .setTimestamp();

  return embed;
}

function buildRedFlagStatusEmbed({ targetUser, flags, guild }) {
  if (flags.length === 0) {
    return new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("🚩 Red Flag Status")
      .setDescription(`**${targetUser.tag || targetUser.username}** has **no active red flags**.`)
      .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
      .setTimestamp();
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle("🚩 Red Flag Status")
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      { name: "User", value: `<@${targetUser.id}>\n\`${targetUser.id}\``, inline: false },
      { name: "Active Flags", value: `${flags.filter((f) => f.active).length}`, inline: true },
      { name: "Total Flags", value: `${flags.length}`, inline: true },
    )
    .setFooter({ text: `${guild.name}` })
    .setTimestamp();

  const activeFlags = flags.filter((f) => f.active);
  if (activeFlags.length > 0) {
    const latest = activeFlags[0];
    const flaggedTs = Math.floor(new Date(latest.createdAt).getTime() / 1000);

    embed.addFields({
      name:  "Current Flag",
      value:
        `**Flagged By:** <@${latest.flaggedBy}>\n` +
        `**Date:** <t:${flaggedTs}:F>\n` +
        `**Reason:** ${(latest.reason || "No reason").substring(0, 200)}`,
      inline: false,
    });
  }

  return embed;
}

// ════════════════════════════════════════════
//              SMALL HELPERS
// ════════════════════════════════════════════
const NO_PING = { parse: [], repliedUser: false };

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

async function respond(message, embeds, extra = {}) {
  return message.channel.send({ embeds, allowedMentions: NO_PING, ...extra }).catch(() => {});
}

async function logSend(channel, embeds, extra = {}) {
  if (!channel) return null;
  return channel.send({ embeds, allowedMentions: NO_PING, ...extra }).catch(() => null);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendPaginated(message, totalPages, buildEmbed) {
  let pageIndex = 0;

  const buildRow = (idx) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("modpage_prev")
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx === 0),
    new ButtonBuilder()
      .setCustomId("modpage_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx === totalPages - 1),
  );

  const sent = await message.channel.send({
    embeds: [buildEmbed(pageIndex)],
    components: totalPages > 1 ? [buildRow(pageIndex)] : [],
    allowedMentions: NO_PING,
  }).catch(() => null);

  if (!sent || totalPages <= 1) return sent;

  const collector = sent.createMessageComponentCollector({
    filter: (i) => i.user.id === message.author.id,
    time: 120_000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "modpage_prev") pageIndex = Math.max(0, pageIndex - 1);
    if (interaction.customId === "modpage_next") pageIndex = Math.min(totalPages - 1, pageIndex + 1);

    await interaction.update({
      embeds: [buildEmbed(pageIndex)],
      components: [buildRow(pageIndex)],
      allowedMentions: NO_PING,
    }).catch(() => {});
  });

  collector.on("end", () => {
    sent.edit({ components: [] }).catch(() => {});
  });

  return sent;
}

// ════════════════════════════════════════════
//         JAIL — AUTO-RELEASE SCHEDULER
// ════════════════════════════════════════════
const activeJailTimers = new Map();

function jailTimerKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function clearJailTimer(guildId, userId) {
  const key = jailTimerKey(guildId, userId);
  if (activeJailTimers.has(key)) {
    clearTimeout(activeJailTimers.get(key));
    activeJailTimers.delete(key);
  }
}

function scheduleJailRelease(client, guildId, userId, caseId, ms) {
  clearJailTimer(guildId, userId);
  const safeMs = Math.min(ms, 2_147_000_000);
  const timer = setTimeout(() => {
    releaseJail(client, guildId, userId, caseId, "Jail sentence expired");
  }, safeMs);
  activeJailTimers.set(jailTimerKey(guildId, userId), timer);
}

async function releaseJail(client, guildId, userId, caseId, reason = "Jail sentence expired") {
  try {
    const modCase = await getCaseById(guildId, caseId);
    if (!modCase || !modCase.active) {
      clearJailTimer(guildId, userId);
      return;
    }

    const guild  = await client.guilds.fetch(guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;

    await deactivateCase(guildId, caseId, {
      removedBy:     client.user.id,
      removedByTag:  client.user.tag,
      removalReason: reason,
    });

    if (member) {
      await member.roles.remove(JAIL_ROLE_ID).catch(() => {});
      if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE") {
        await member.roles.add(INITIATE_ROLE_ID).catch(() => {});
      }
    }

    const targetUser = member?.user ?? { id: userId, username: modCase.username, tag: modCase.userTag };

    const releaseCase = await createCase({
      guildId, action: "UNJAIL", targetUser, moderator: client.user, reason,
    });
    await releaseCase.updateOne({ relatedCaseId: caseId });

    if (guild) {
      const logChannel = guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
      await logSend(logChannel, [buildLogEmbed({
        action: "UNJAIL", caseId: releaseCase.caseId, targetUser,
        moderator: client.user, reason,
      })]);
    }

    if (member) {
      try {
        await member.send({ embeds: [buildDMEmbed({
          action: "UNJAIL", guild, moderator: client.user, reason, caseId: releaseCase.caseId,
        })] });
      } catch (_) {}
    }
  } catch (err) {
    logger.error(`Failed to auto-release jail (${guildId}/${userId}): ${err.message}`);
  } finally {
    clearJailTimer(guildId, userId);
  }
}

async function sweepExpiredJails(client) {
  try {
    const ModerationLog = getModerationLog();

    const expired = await ModerationLog.find({
      action: "JAIL", active: true, expiresAt: { $lte: new Date() },
    });
    for (const j of expired) {
      await releaseJail(client, j.guildId, j.userId, j.caseId, "Jail sentence expired");
    }

    const stillActive = await ModerationLog.find({ action: "JAIL", active: true });
    for (const j of stillActive) {
      const key = jailTimerKey(j.guildId, j.userId);
      if (activeJailTimers.has(key)) continue;
      const msLeft = new Date(j.expiresAt).getTime() - Date.now();
      if (msLeft > 0) scheduleJailRelease(client, j.guildId, j.userId, j.caseId, msLeft);
    }
  } catch (err) {
    logger.error(`Jail sweep failed: ${err.message}`);
  }
}

// ════════════════════════════════════════════
//              COMMAND HANDLERS
// ════════════════════════════════════════════

// ── WARN ──────────────────────────────────
async function autoJailOnWarnThreshold(message, targetMember, totalWarns, client) {
  if (totalWarns !== AUTO_JAIL_WARN_THRESHOLD) return;

  const ModerationLog = getModerationLog();
  const alreadyJailed = await ModerationLog.findOne({
    guildId: message.guild.id, userId: targetMember.id, action: "JAIL", active: true,
  });
  if (alreadyJailed) return;

  if (!message.guild.members.me.permissions.has("ManageRoles")) {
    logger.error("Auto-jail skipped: bot lacks ManageRoles permission.");
    return;
  }

  const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
  if (!jailRole || jailRole.position >= message.guild.members.me.roles.highest.position) {
    logger.error("Auto-jail skipped: Jail role missing or positioned above bot's highest role.");
    return;
  }

  const durationMs        = parseDuration(AUTO_JAIL_DURATION);
  const durationFormatted = formatDuration(durationMs);
  const reason            = `Automatic Jail — reached ${totalWarns} active warnings`;

  try {
    if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE" &&
        targetMember.roles.cache.has(INITIATE_ROLE_ID)) {
      await targetMember.roles.remove(INITIATE_ROLE_ID).catch(() => {});
    }
    await targetMember.roles.add(JAIL_ROLE_ID);
  } catch (err) {
    logger.error(`Auto-jail role update failed: ${err.message}`);
    return;
  }

  const modCase = await createCase({
    guildId: message.guild.id, action: "JAIL", targetUser: targetMember.user,
    moderator: client.user, reason, duration: durationMs, durationString: durationFormatted,
  });

  scheduleJailRelease(client, message.guild.id, targetMember.id, modCase.caseId, durationMs);

  const expiresTs  = Math.floor((Date.now() + durationMs) / 1000);
  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);

  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "JAIL", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: client.user, reason, duration: durationFormatted,
    });
    logEmbed.addFields(
      { name: "Expires", value: `<t:${expiresTs}:F>`, inline: false },
      { name: "Trigger", value: `Automatically triggered at ${totalWarns} active warnings`, inline: false },
    );
    await logSend(logChannel, [logEmbed]);
  }

  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "JAIL", guild: message.guild, moderator: client.user,
      reason, caseId: modCase.caseId, duration: durationFormatted,
    })] });
  } catch (_) {}
}

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

  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "WARN", guild: message.guild, moderator: message.author,
      reason, caseId: modCase.caseId, totalWarns, evidence,
    })] });
  } catch (_) {}

  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logMsg = await logSend(logChannel, [buildLogEmbed({
      action: "WARN", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, evidence, totalWarns, history, commandLink,
    })]);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  await respond(message, [buildConfirmEmbed({
    action: "WARN", targetUser: targetMember.user,
    reason, caseId: modCase.caseId, totalWarns,
  })]);

  if (totalWarns >= 3 && logChannel) {
    await logSend(logChannel, [
      new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🚨 Escalation Alert")
        .setDescription(
          `<@${targetMember.id}> now has **${totalWarns}** active warnings.\n` +
          `Consider taking further action against **${targetMember.user.tag}** (\`${targetMember.id}\`).`
        )
        .setTimestamp(),
    ]);
  }

  await autoJailOnWarnThreshold(message, targetMember, totalWarns, client);
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
    const logMsg = await logSend(logChannel, [buildLogEmbed({
      action: "KICK", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, evidence, history, commandLink,
    })]);
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

    const logMsg = await logSend(logChannel, [logEmbed]);
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
        "eb timeout @user 2h Trolling",
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
      moderator: message.author, reason, duration: durationFormatted,
      evidence, history, commandLink,
    });
    logEmbed.addFields({ name: "Expires", value: `<t:${expiresTs}:F>`, inline: false });

    const logMsg = await logSend(logChannel, [logEmbed]);
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
  const caseId        = parseInt(args[0]);
  const removalReason = args.slice(1).join(" ").trim() || null;

  if (isNaN(caseId) || caseId < 1) {
    return respond(message, [usageEmbed(
      ["eb unwarn <caseId> [reason]", "eb unwarn 5", "eb unwarn 5 Appealed successfully"],
      [{ name: "Tip", value: "Use `eb warnings @user` or `eb modlogs @user` to find case IDs" }]
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

  await deactivateCase(message.guild.id, caseId, {
    removedBy:    message.author.id,
    removedByTag: message.author.tag,
    removalReason,
  });

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
    reason:           removalReason || `Removed warning #${caseId}: ${modCase.reason?.substring(0, 80)}`,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });
  await unwarnCase.updateOne({ relatedCaseId: caseId });

  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "UNWARN", caseId: unwarnCase.caseId,
      targetUser, moderator: message.author,
      reason:     removalReason || `Removed warning from case #${caseId}`,
      totalWarns: remainingWarns,
      commandLink,
    });
    logEmbed.addFields({
      name:  "Removed Case",
      value: `#${caseId} — ${(modCase.reason || "No reason").substring(0, 100)}`,
      inline: false,
    });
    await logSend(logChannel, [logEmbed]);
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle("✅ Warning Removed")
    .setDescription(`Warning **#${caseId}** has been removed from **${targetUser.tag || targetUser.username}**.`)
    .addFields(
      { name: "User",               value: `<@${targetUser.id}>`,                  inline: false },
      { name: "Original Reason",    value: modCase.reason || "No reason provided", inline: false },
      { name: "Remaining Warnings", value: `${remainingWarns}`,                    inline: false },
    )
    .setTimestamp();

  if (removalReason) {
    confirmEmbed.addFields({ name: "Removal Reason", value: removalReason, inline: false });
  }

  await respond(message, [confirmEmbed]);

  try {
    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("✅ Warning Removed")
        .setDescription(`A warning has been removed from your record in **${message.guild.name}**.`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: "Case Removed",       value: `#${caseId}`,       inline: false },
          { name: "Remaining Warnings", value: `${remainingWarns}`, inline: false },
          { name: "Questions?",         value: `[Open a support ticket](${APPEAL_CHANNEL_LINK})`, inline: false },
        )
        .setFooter({ text: message.guild.name })
        .setTimestamp();

      if (removalReason) {
        dmEmbed.spliceFields(1, 0, { name: "Reason", value: removalReason, inline: false });
      }

      await targetMember.send({ embeds: [dmEmbed] });
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
      { name: "Reason", value: modCase.reason || "No reason provided",                                     inline: false },
      { name: "Date",   value: `<t:${Math.floor(new Date(modCase.createdAt).getTime() / 1000)}:F>`,        inline: false },
      { name: "Status", value: modCase.active ? "Active" : "Removed",                                      inline: false },
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

  if (!modCase.active && modCase.removedAt) {
    embed.addFields({
      name:  "Removed",
      value:
        `<t:${Math.floor(new Date(modCase.removedAt).getTime() / 1000)}:F>` +
        (modCase.removedBy ? `\nBy: <@${modCase.removedBy}>` : "") +
        (modCase.removalReason ? `\nReason: ${modCase.removalReason}` : ""),
      inline: false,
    });
  }

  if (modCase.relatedCaseId) {
    embed.addFields({
      name:  "Related Case",
      value: `This closed case **#${modCase.relatedCaseId}**. Use \`eb case ${modCase.relatedCaseId}\` to view it.`,
      inline: false,
    });
  }

  const commandLink = buildJumpLink(message.guild.id, modCase.commandChannelId, modCase.commandMessageId);
  if (commandLink) {
    embed.addFields({ name: "Command Used", value: `[Jump to message](${commandLink})`, inline: false });
  }

  if (modCase.logMessageId) {
    const logLink = buildJumpLink(message.guild.id, MOD_LOG_CHANNEL_ID, modCase.logMessageId);
    if (logLink) {
      embed.addFields({ name: "Log Entry", value: `[Jump to log](${logLink})`, inline: false });
    }
  }

  if (modCase.evidence?.messageContent) {
    embed.addFields({
      name:  "Evidence",
      value: `\`\`\`${modCase.evidence.messageContent.substring(0, 400)}${modCase.evidence.messageContent.length > 400 ? "..." : ""}\`\`\``,
      inline: false,
    });
  }

  if (modCase.evidence?.channelId) {
    embed.addFields({ name: "Message Channel", value: `<#${modCase.evidence.channelId}>`, inline: false });
  }

  await respond(message, [embed]);
}

// ── WARNINGS ──────────────────────────────
async function handleWarnings(message, args, client) {
  const caseMatch = message.content.match(/--case\s+(\d+)/i);
  if (caseMatch) return handleCase(message, [caseMatch[1]], client);

  const targetUser =
    message.mentions.users?.first() ||
    (args[0] && !args[0].startsWith("--")
      ? await client.users.fetch(args[0]).catch(() => null)
      : null);

  if (!targetUser) {
    if (getMemberLevel(message.member) < 3) {
      return respond(message, [errEmbed(
        "Access Denied",
        "Only **Mastermind** or **Core Command** can view the server-wide warning overview.\n" +
        "Use `eb warnings @user` to view a specific member's warning history."
      )]);
    }
    return showGuildWarnings(message, client);
  }

  return showUserWarnings(message, targetUser, client);
}

async function showUserWarnings(message, targetUser, client) {
  const ModerationLog = getModerationLog();
  const warnings = await ModerationLog.find({
    guildId: message.guild.id,
    userId:  targetUser.id,
    action:  "WARN",
  }).sort({ createdAt: -1 });

  if (warnings.length === 0) {
    return respond(message, [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("📋 Warning History")
        .setDescription(`**${targetUser.tag || targetUser.username}** has no warnings on record.`)
        .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
        .setTimestamp(),
    ]);
  }

  const activeCount  = warnings.filter((w) => w.active).length;
  const removedCount = warnings.length - activeCount;
  const pages        = chunk(warnings, 5);

  const buildEmbed = (idx) => {
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle(`⚠️ Warning History — ${targetUser.tag || targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
      .addFields(
        { name: "User",    value: `<@${targetUser.id}>\n\`${targetUser.id}\``, inline: true },
        { name: "Active",  value: `${activeCount}`,  inline: true },
        { name: "Removed", value: `${removedCount}`, inline: true },
      )
      .setFooter({ text: `Page ${idx + 1}/${pages.length} • ${warnings.length} total warning(s)` })
      .setTimestamp();

    for (const w of pages[idx]) {
      const issuedTs = Math.floor(new Date(w.createdAt).getTime() / 1000);

      const statusLine = w.active
        ? "🟡 **Active**"
        : `🟢 **Removed** — <t:${Math.floor(new Date(w.removedAt ?? w.updatedAt).getTime() / 1000)}:R>`;

      const jumpLink = w.logMessageId
        ? buildJumpLink(message.guild.id, MOD_LOG_CHANNEL_ID, w.logMessageId)
        : buildJumpLink(message.guild.id, w.commandChannelId, w.commandMessageId);

      let value =
        `**Status:** ${statusLine}\n` +
        `**Issued:** <t:${issuedTs}:F>\n` +
        `**Moderator:** <@${w.moderatorId}>\n` +
        `**Reason:** ${(w.reason || "No reason provided").substring(0, 200)}`;

      if (!w.active) {
        if (w.removedBy)     value += `\n**Removed By:** <@${w.removedBy}>`;
        if (w.removalReason) value += `\n**Removal Reason:** ${w.removalReason.substring(0, 150)}`;
      }

      if (jumpLink) value += `\n[Jump to Case](${jumpLink})`;

      embed.addFields({ name: `Case #${w.caseId}`, value, inline: false });
    }

    return embed;
  };

  await sendPaginated(message, pages.length, buildEmbed);
}

async function showGuildWarnings(message, client) {
  const ModerationLog = getModerationLog();

  const activeWarns = await ModerationLog.find({
    guildId: message.guild.id,
    action:  "WARN",
    active:  true,
  }).sort({ createdAt: -1 });

  if (activeWarns.length === 0) {
    return respond(message, [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("📋 Server Warnings")
        .setDescription("No active warnings found in this server.")
        .setTimestamp(),
    ]);
  }

  const grouped = new Map();
  for (const w of activeWarns) {
    if (!grouped.has(w.userId)) grouped.set(w.userId, []);
    grouped.get(w.userId).push(w);
  }

  const sortedUsers = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
  const pages        = chunk(sortedUsers, 8);

  const buildEmbed = (idx) => {
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle("📋 Server Warnings Overview")
      .setDescription("Members with **active** warnings, sorted by warning count.")
      .setFooter({
        text: `Page ${idx + 1}/${pages.length} • ${sortedUsers.length} member(s) • ${activeWarns.length} active warning(s)`,
      })
      .setTimestamp();

    const lines = pages[idx].map(([userId, warns]) => {
      const latest   = warns[0];
      const latestTs = Math.floor(new Date(latest.createdAt).getTime() / 1000);
      const caseIds  = warns.map((w) => `#${w.caseId}`).join(", ");
      return (
        `<@${userId}> — **${warns.length}** active warning(s)\n` +
        `↳ Cases: ${caseIds}\n` +
        `↳ Latest: Case #${latest.caseId} <t:${latestTs}:R>`
      );
    });

    embed.addFields({ name: "Members", value: lines.join("\n\n") || "None", inline: false });
    return embed;
  };

  await sendPaginated(message, pages.length, buildEmbed);
}

// ── JAIL ──────────────────────────────────
async function handleJail(message, args, client) {
  if (args[0]?.toLowerCase() === "status") {
    return handleJailStatus(message, client);
  }

  if (!message.guild.members.me.permissions.has("ManageRoles")) {
    return respond(message, [errEmbed("Missing Permission", "I don't have permission to manage roles.")]);
  }

  const targetMember =
    message.mentions.members?.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!targetMember) {
    return respond(message, [usageEmbed(
      [
        "eb jail @user <duration> <reason>",
        "eb jail @user 2h Spamming",
        "eb jail @user 1d Rule violation",
        "eb jail status",
      ],
      [{ name: "Duration Examples", value: "30m, 2h, 1d, 5d, 7d, 14d (max 28d)" }]
    )]);
  }

  if (targetMember.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot jail yourself.")]);
  }
  if (targetMember.id === client.user.id) {
    return respond(message, [errEmbed("Error", "You cannot jail me.")]);
  }
  if (!hierarchyOk(message, targetMember)) {
    return respond(message, [errEmbed("Hierarchy Error", "You cannot action someone with equal or higher roles.")]);
  }

  const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
  if (!jailRole) {
    return respond(message, [errEmbed("Configuration Error", "Jail role not found. Contact a developer.")]);
  }
  if (jailRole.position >= message.guild.members.me.roles.highest.position) {
    return respond(message, [errEmbed("Role Hierarchy Error", "My highest role must be above the Jail role to assign it.")]);
  }

  const ModerationLog = getModerationLog();
  const existingJail = await ModerationLog.findOne({
    guildId: message.guild.id, userId: targetMember.id, action: "JAIL", active: true,
  });
  if (existingJail) {
    return respond(message, [errEmbed("Already Jailed", `This member is already jailed under case **#${existingJail.caseId}**.`)]);
  }

  const cleanArgs   = args.filter((a) => !a.match(/^<@!?\d+>$/) && a !== targetMember.id);
  const durationArg = cleanArgs.find((a) => /^\d+(s|m|h|d|w)$/i.test(a));

  if (!durationArg) {
    return respond(message, [usageEmbed(
      ["eb jail @user 2h Spamming", "eb jail @user 1d Repeated violations"],
      [{ name: "Duration Format", value: "`s` seconds · `m` minutes · `h` hours · `d` days · `w` weeks (max 28 days)" }]
    )]);
  }

  const durationMs = parseJailDuration(durationArg);
  if (!durationMs) {
    return respond(message, [errEmbed("Invalid Duration", "Must be between 1 second and 28 days.\nExample: `2h`, `1d`, `5d`, `14d`")]);
  }

  const durationFormatted = formatDuration(durationMs);
  const durationIdx       = cleanArgs.indexOf(durationArg);
  const reason            = cleanArgs.slice(durationIdx + 1).join(" ") || "No reason provided";
  const evidence          = await extractEvidence(message);
  const commandLink       = buildJumpLink(message.guild.id, message.channel.id, message.id);
  const expiresTs         = Math.floor((Date.now() + durationMs) / 1000);

  try {
    if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE" &&
        targetMember.roles.cache.has(INITIATE_ROLE_ID)) {
      await targetMember.roles.remove(INITIATE_ROLE_ID);
    }
    await targetMember.roles.add(JAIL_ROLE_ID);
  } catch (err) {
    return respond(message, [errEmbed("Role Error", "Failed to update roles. Check my permissions and role position.")]);
  }

  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "JAIL", guild: message.guild, moderator: message.author,
      reason, caseId: "pending", duration: durationFormatted, evidence,
    })] });
  } catch (_) {}

  const modCase = await createCase({
    guildId: message.guild.id, action: "JAIL", targetUser: targetMember.user,
    moderator: message.author, reason, duration: durationMs, durationString: durationFormatted,
    evidence, commandChannelId: message.channel.id, commandMessageId: message.id,
  });

  scheduleJailRelease(client, message.guild.id, targetMember.id, modCase.caseId, durationMs);

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "JAIL", caseId: modCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, duration: durationFormatted, evidence, commandLink,
    });
    logEmbed.addFields({ name: "Expires", value: `<t:${expiresTs}:F>`, inline: false });
    const logMsg = await logSend(logChannel, [logEmbed]);
    if (logMsg) await modCase.updateOne({ logMessageId: logMsg.id });
  }

  const confirmEmbed = buildConfirmEmbed({
    action: "JAIL", targetUser: targetMember.user, reason, caseId: modCase.caseId, duration: durationFormatted,
  });
  confirmEmbed.addFields({ name: "Expires", value: `<t:${expiresTs}:F>`, inline: false });

  await respond(message, [confirmEmbed]);
}

async function handleJailStatus(message, client) {
  const ModerationLog = getModerationLog();
  const isStaff = hasModPermission(message.member);

  if (!isStaff) {
    const activeJail = await ModerationLog.findOne({
      guildId: message.guild.id, userId: message.author.id, action: "JAIL", active: true,
    });

    if (!activeJail) {
      return respond(message, [errEmbed("Not Jailed", "You are not currently in Jail.")]);
    }

    const expiresTs = Math.floor(new Date(activeJail.expiresAt).getTime() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle("⛓️ Your Jail Status")
      .addFields(
        { name: "Reason",         value: activeJail.reason || "No reason provided", inline: false },
        { name: "Remaining Time", value: `<t:${expiresTs}:R>`, inline: true },
        { name: "Release Date",   value: `<t:${expiresTs}:F>`, inline: true },
        { name: "Case",           value: `#${activeJail.caseId}`, inline: true },
      )
      .setTimestamp();

    return respond(message, [embed]);
  }

  const activeJails = await ModerationLog.find({
    guildId: message.guild.id, action: "JAIL", active: true,
  }).sort({ expiresAt: 1 });

  if (activeJails.length === 0) {
    return respond(message, [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("⛓️ Jail Status")
        .setDescription("No members are currently jailed.")
        .setTimestamp(),
    ]);
  }

  const pages = chunk(activeJails, 8);

  const buildEmbed = (idx) => {
    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle("⛓️ Active Jail Sentences")
      .setFooter({ text: `Page ${idx + 1}/${pages.length} • ${activeJails.length} jailed member(s)` })
      .setTimestamp();

    const lines = pages[idx].map((j) => {
      const expiresTs = Math.floor(new Date(j.expiresAt).getTime() / 1000);
      return (
        `<@${j.userId}> — Case #${j.caseId}\n` +
        `↳ Expires: <t:${expiresTs}:R> (<t:${expiresTs}:F>)\n` +
        `↳ Reason: ${(j.reason || "No reason").substring(0, 80)}`
      );
    });

    embed.addFields({ name: "Members", value: lines.join("\n\n"), inline: false });
    return embed;
  };

  await sendPaginated(message, pages.length, buildEmbed);
}

// ── UNJAIL ────────────────────────────────
async function handleUnjail(message, args, client) {
  if (!message.guild.members.me.permissions.has("ManageRoles")) {
    return respond(message, [errEmbed("Missing Permission", "I don't have permission to manage roles.")]);
  }

  const targetMember =
    message.mentions.members?.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!targetMember) {
    return respond(message, [usageEmbed(["eb unjail @user <reason>", "eb unjail @user Appeal accepted"])]);
  }

  const ModerationLog = getModerationLog();
  const activeJail = await ModerationLog.findOne({
    guildId: message.guild.id, userId: targetMember.id, action: "JAIL", active: true,
  });

  if (!activeJail) {
    return respond(message, [errEmbed("Not Jailed", "This member does not have an active Jail sentence.")]);
  }

  const reason = parseReason(message.content, "unjail", !!message.mentions.members?.first());

  clearJailTimer(message.guild.id, targetMember.id);

  try {
    await targetMember.roles.remove(JAIL_ROLE_ID).catch(() => {});
    if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE") {
      await targetMember.roles.add(INITIATE_ROLE_ID).catch(() => {});
    }
  } catch (_) {}

  await deactivateCase(message.guild.id, activeJail.caseId, {
    removedBy: message.author.id, removedByTag: message.author.tag, removalReason: reason,
  });

  const unjailCase = await createCase({
    guildId: message.guild.id, action: "UNJAIL", targetUser: targetMember.user,
    moderator: message.author, reason, commandChannelId: message.channel.id, commandMessageId: message.id,
  });
  await unjailCase.updateOne({ relatedCaseId: activeJail.caseId });

  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: "UNJAIL", caseId: unjailCase.caseId, targetUser: targetMember.user,
      moderator: message.author, reason, commandLink,
    });
    logEmbed.addFields({ name: "Released From", value: `Case #${activeJail.caseId}`, inline: false });
    await logSend(logChannel, [logEmbed]);
  }

  try {
    await targetMember.send({ embeds: [buildDMEmbed({
      action: "UNJAIL", guild: message.guild, moderator: message.author, reason, caseId: unjailCase.caseId,
    })] });
  } catch (_) {}

  await respond(message, [buildConfirmEmbed({
    action: "UNJAIL", targetUser: targetMember.user, reason, caseId: unjailCase.caseId,
  })]);
}

// ── PARDON ────────────────────────────────
const PARDON_TYPES = {
  jail:    { action: "JAIL",    resultAction: "UNJAIL",    label: "Jail"    },
  timeout: { action: "TIMEOUT", resultAction: "UNTIMEOUT", label: "Timeout" },
  ban:     { action: "BAN",     resultAction: "UNBAN",     label: "Ban"     },
};

async function handlePardon(message, args, client) {
  const targetUser =
    message.mentions.users?.first() ||
    (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

  const mentionStripped = args.filter((a) => !a.match(/^<@!?\d+>$/) && a !== targetUser?.id);
  const typeIdx = mentionStripped.findIndex((a) => Object.keys(PARDON_TYPES).includes(a.toLowerCase()));

  if (!targetUser || typeIdx === -1) {
    return respond(message, [usageEmbed(
      [
        "eb pardon @user <jail|timeout|ban> <reason>",
        "eb pardon @user jail Appeal accepted",
        "eb pardon @user ban Mistaken identity",
      ],
      [{ name: "Note", value: "Use `eb unwarn` for warnings. Red flags are not handled by this command." }]
    )]);
  }

  const type   = mentionStripped[typeIdx].toLowerCase();
  const meta   = PARDON_TYPES[type];
  const reason = mentionStripped.slice(typeIdx + 1).join(" ") || "No reason provided";

  const ModerationLog = getModerationLog();
  const activeCase = await ModerationLog.findOne({
    guildId: message.guild.id, userId: targetUser.id, action: meta.action, active: true,
  }).sort({ createdAt: -1 });

  if (!activeCase) {
    return respond(message, [errEmbed("Not Found", `No active **${meta.label}** punishment found for **${targetUser.tag || targetUser.username}**.`)]);
  }

  const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);

  if (type === "jail") {
    clearJailTimer(message.guild.id, targetUser.id);
    if (targetMember) {
      await targetMember.roles.remove(JAIL_ROLE_ID).catch(() => {});
      if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE") {
        await targetMember.roles.add(INITIATE_ROLE_ID).catch(() => {});
      }
    }
  } else if (type === "timeout") {
    if (targetMember) {
      await targetMember.timeout(null, `[${message.author.tag}] Pardoned: ${reason}`).catch(() => {});
    }
  } else if (type === "ban") {
    await message.guild.members.unban(targetUser.id, `[${message.author.tag}] Pardoned: ${reason}`).catch(() => {});
  }

  await deactivateCase(message.guild.id, activeCase.caseId, {
    removedBy: message.author.id, removedByTag: message.author.tag, removalReason: reason,
  });

  const pardonCase = await createCase({
    guildId: message.guild.id, action: meta.resultAction, targetUser,
    moderator: message.author, reason,
    commandChannelId: message.channel.id, commandMessageId: message.id,
  });
  await pardonCase.updateOne({ relatedCaseId: activeCase.caseId });

  const logChannel  = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  if (logChannel) {
    const logEmbed = buildLogEmbed({
      action: meta.resultAction, caseId: pardonCase.caseId, targetUser,
      moderator: message.author, reason, commandLink,
    });
    logEmbed.addFields({ name: "Pardoned Case", value: `#${activeCase.caseId} (${meta.label})`, inline: false });
    await logSend(logChannel, [logEmbed]);
  }

  if (targetMember) {
    try {
      await targetMember.send({ embeds: [buildDMEmbed({
        action: meta.resultAction, guild: message.guild, moderator: message.author,
        reason, caseId: pardonCase.caseId,
      })] });
    } catch (_) {}
  }

  await respond(message, [
    new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`🕊️ Pardon Granted — ${meta.label}`)
      .setDescription(`**${targetUser.tag || targetUser.username}** has been pardoned.`)
      .addFields(
        { name: "Pardoned Case", value: `#${activeCase.caseId}`, inline: true },
        { name: "New Case",      value: `#${pardonCase.caseId}`, inline: true },
        { name: "Reason",        value: reason,                  inline: false },
      )
      .setTimestamp(),
  ]);
}

// ── REDFLAG ───────────────────────────────
async function handleRedFlag(message, args, client) {
  const targetUser =
    message.mentions.users?.first() ||
    (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

  if (!targetUser) {
    return respond(message, [usageEmbed(
      [
        "eb redflag @user <reason>",
        "eb redflag @user Suspicious activity detected",
        "eb redflag 123456789 Potential scammer",
      ],
      [{ name: "Note", value: "Red flags are monitoring alerts. Only one per user can be active." }]
    )]);
  }

  if (targetUser.id === message.author.id) {
    return respond(message, [errEmbed("Error", "You cannot red flag yourself.")]);
  }
  if (targetUser.id === client.user.id) {
    return respond(message, [errEmbed("Error", "You cannot red flag me.")]);
  }

  // Check if already flagged
  const existingFlag = await getActiveRedFlag(message.guild.id, targetUser.id);
  if (existingFlag) {
    return respond(message, [errEmbed(
      "Already Flagged",
      `**${targetUser.tag || targetUser.username}** is already under monitoring.\n\n` +
      `Flagged by: <@${existingFlag.flaggedBy}>\n` +
      `Reason: ${(existingFlag.reason || "No reason").substring(0, 150)}`
    )]);
  }

  const reason = parseReason(message.content, "redflag", !!message.mentions.users?.first());
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  const redFlag = await createRedFlag({
    guildId: message.guild.id,
    targetUser,
    flaggedBy: message.author,
    reason,
    commandChannelId: message.channel.id,
    commandMessageId: message.id,
  });

  if (!redFlag) {
    return respond(message, [errEmbed("Failed", "Could not create red flag. Try again.")]);
  }

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    const logMsg = await logSend(logChannel, [buildRedFlagLogEmbed({
      action: "REDFLAG",
      targetUser,
      flaggedBy: message.author,
      reason,
      commandLink,
    })]);
    if (logMsg) await redFlag.updateOne({ logMessageId: logMsg.id });
  }

  await respond(message, [buildRedFlagConfirmEmbed({
    action: "REDFLAG",
    targetUser,
    reason,
  })]);
}

// ── UNREDFLAG ─────────────────────────────
async function handleUnredFlag(message, args, client) {
  const targetUser =
    message.mentions.users?.first() ||
    (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

  if (!targetUser) {
    return respond(message, [usageEmbed(
      [
        "eb unredflag @user <reason>",
        "eb unredflag @user False alarm",
        "eb unredflag @user Behavior resolved",
      ]
    )]);
  }

  const activeFlag = await getActiveRedFlag(message.guild.id, targetUser.id);
  if (!activeFlag) {
    return respond(message, [errEmbed(
      "Not Flagged",
      `**${targetUser.tag || targetUser.username}** does not have an active red flag.`
    )]);
  }

  const removalReason = args.slice(1).join(" ").trim() || "No reason provided";
  const commandLink = buildJumpLink(message.guild.id, message.channel.id, message.id);

  await removeRedFlag(message.guild.id, targetUser.id, {
    removedBy: message.author.id,
    removedByTag: message.author.tag,
    removalReason,
  });

  const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logChannel) {
    await logSend(logChannel, [buildRedFlagLogEmbed({
      action: "UNREDFLAG",
      targetUser,
      flaggedBy: message.author,
      reason: removalReason,
      commandLink,
    })]);
  }

  await respond(message, [buildRedFlagConfirmEmbed({
    action: "UNREDFLAG",
    targetUser,
    reason: removalReason,
  })]);
}

// ── REDFLAG STATUS ────────────────────────
async function handleRedFlagStatus(message, args, client) {
  const targetUser =
    message.mentions.users?.first() ||
    (args[0] && !args[0].startsWith("--")
      ? await client.users.fetch(args[0]).catch(() => null)
      : null);

  if (!targetUser) {
    // Show all flagged users (staff only)
    if (getMemberLevel(message.member) < 3) {
      return respond(message, [errEmbed(
        "Access Denied",
        "Only **Mastermind** or **Core Command** can view the server-wide red flag overview.\n" +
        "Use `eb rfstatus @user` to check a specific member."
      )]);
    }
    return showGuildRedFlags(message, client);
  }

  const flags = await getUserRedFlags(message.guild.id, targetUser.id);
  await respond(message, [buildRedFlagStatusEmbed({
    targetUser,
    flags,
    guild: message.guild,
  })]);
}

async function showGuildRedFlags(message, client) {
  const allFlags = await getAllActiveRedFlags(message.guild.id);

  if (allFlags.length === 0) {
    return respond(message, [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🚩 Red Flag Status")
        .setDescription("No members are currently under monitoring.")
        .setTimestamp(),
    ]);
  }

  const pages = chunk(allFlags, 10);

  const buildEmbed = (idx) => {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B00)
      .setTitle("🚩 Active Red Flags — Server Overview")
      .setDescription("Members currently under special monitoring.")
      .setFooter({ text: `Page ${idx + 1}/${pages.length} • ${allFlags.length} flagged member(s)` })
      .setTimestamp();

    const lines = pages[idx].map((flag) => {
      const flaggedTs = Math.floor(new Date(flag.createdAt).getTime() / 1000);
      return (
        `<@${flag.userId}> — \`${flag.userTag}\`\n` +
        `↳ **Flagged By:** <@${flag.flaggedBy}>\n` +
        `↳ **Date:** <t:${flaggedTs}:F>\n` +
        `↳ **Reason:** ${(flag.reason || "No reason").substring(0, 100)}`
      );
    });

    embed.addFields({ name: "Flagged Members", value: lines.join("\n\n") || "None", inline: false });
    return embed;
  };

  await sendPaginated(message, pages.length, buildEmbed);
}

// ── REDFLAG HISTORY ───────────────────────
async function handleRedFlagHistory(message, args, client) {
  const targetUser =
    message.mentions.users?.first() ||
    (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

  if (!targetUser) {
    return respond(message, [usageEmbed(
      [
        "eb rfhistory @user",
        "eb rfhistory <userId>",
      ],
      [{ name: "Note", value: "Shows all red flags (active and removed) for a member." }]
    )]);
  }

  const allFlags = await getUserRedFlags(message.guild.id, targetUser.id);

  if (allFlags.length === 0) {
    return respond(message, [
      new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🚩 Red Flag History")
        .setDescription(`**${targetUser.tag || targetUser.username}** has no red flag history.`)
        .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
        .setTimestamp(),
    ]);
  }

  const activeCount = allFlags.filter((f) => f.active).length;
  const removedCount = allFlags.length - activeCount;
  const pages = chunk(allFlags, 5);

  const buildEmbed = (idx) => {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B00)
      .setTitle(`🚩 Red Flag History — ${targetUser.tag || targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) ?? null)
      .addFields(
        { name: "User",    value: `<@${targetUser.id}>\n\`${targetUser.id}\``, inline: true },
        { name: "Active",  value: `${activeCount}`, inline: true },
        { name: "Removed", value: `${removedCount}`, inline: true },
      )
      .setFooter({ text: `Page ${idx + 1}/${pages.length} • ${allFlags.length} total flag(s)` })
      .setTimestamp();

    for (const flag of pages[idx]) {
      const flaggedTs = Math.floor(new Date(flag.createdAt).getTime() / 1000);

      const statusLine = flag.active
        ? "🟡 **Active**"
        : `🟢 **Removed** — <t:${Math.floor(new Date(flag.removedAt ?? flag.updatedAt).getTime() / 1000)}:R>`;

      const jumpLink = flag.logMessageId
        ? buildJumpLink(message.guild.id, MOD_LOG_CHANNEL_ID, flag.logMessageId)
        : buildJumpLink(message.guild.id, flag.commandChannelId, flag.commandMessageId);

      let value =
        `**Status:** ${statusLine}\n` +
        `**Flagged:** <t:${flaggedTs}:F>\n` +
        `**Flagged By:** <@${flag.flaggedBy}>\n` +
        `**Reason:** ${(flag.reason || "No reason").substring(0, 200)}`;

      if (!flag.active) {
        if (flag.removedBy)     value += `\n**Removed By:** <@${flag.removedBy}>`;
        if (flag.removalReason) value += `\n**Removal Reason:** ${flag.removalReason.substring(0, 150)}`;
      }

      if (jumpLink) value += `\n[Jump to Action](${jumpLink})`;

      embed.addFields({ name: `Flag #${allFlags.indexOf(flag) + 1}`, value, inline: false });
    }

    return embed;
  };

  await sendPaginated(message, pages.length, buildEmbed);
}

// ── MODHELP ───────────────────────────────
async function handleModhelp(message) {
  const level = getMemberLevel(message.member);

  const categories = [
    {
      name:     "⚠️ Warning Commands",
      minLevel: 1,
      commands: [
        { cmd: "eb warn @user [reason]",      desc: "Issue a warning. Reply to a message to attach it as evidence.",        level: 1 },
        { cmd: "eb unwarn <caseId> [reason]", desc: "Remove a warning by case ID. Reason is logged as the removal reason.", level: 3 },
        { cmd: "eb warnings @user",           desc: "Full warning timeline for one member — issued, removed, by whom, why, with jump links.", level: 1 },
        { cmd: "eb warnings",                 desc: "Server-wide overview of every member with active warnings.",          level: 3 },
      ],
    },
    {
      name:     "🔇 Timeouts",
      minLevel: 1,
      commands: [
        { cmd: "eb timeout @user <duration> [reason]", desc: "Timeout a member. Duration: `s/m/h/d/w` (max 28 days).", level: 1 },
      ],
    },
    {
      name:     "🔒 Jail",
      minLevel: 3,
      commands: [
        { cmd: "eb jail @user <time> <reason>", desc: "Remove Initiate, apply Jail, create a timed case. Examples: `30m`, `2h`, `1d`, `5d`, `7d`, `14d`.", level: 3 },
        { cmd: "eb jail status",                desc: "Jailed members see only their own sentence; staff see every active Jail sentence.", level: 1 },
        { cmd: "eb unjail @user <reason>",      desc: "End an active Jail sentence and restore Initiate.", level: 3 },
      ],
    },
    {
      name:     "🕊️ Pardons",
      minLevel: 3,
      commands: [
        { cmd: "eb pardon @user <jail|timeout|ban> <reason>", desc: "Close the latest matching active punishment. Jail pardons restore roles. Use `eb unwarn` for warnings.", level: 3 },
      ],
    },
    {
      name:     "👢🔨 Kicks & Bans",
      minLevel: 3,
      commands: [
        { cmd: "eb kick @user [reason]",           desc: "Kick a member from the server.", level: 3 },
        { cmd: "eb ban @user [--days N] [reason]", desc: "Permanently ban a member. `--days` deletes N days of messages (max 7).", level: 3 },
      ],
    },
    {
      name:     "🚩 Red Flags (Monitoring)",
      minLevel: 3,
      commands: [
        { cmd: "eb redflag @user <reason>",       desc: "Place a member under monitoring. Only one active flag per member.", level: 3 },
        { cmd: "eb unredflag @user <reason>",     desc: "Remove an active red flag and log the reason.",                    level: 3 },
        { cmd: "eb rfstatus @user",                desc: "View red flag status for a specific member.",                      level: 1 },
        { cmd: "eb rfstatus  (staff only)",        desc: "View all members currently under monitoring.",                      level: 3 },
        { cmd: "eb rfhistory @user",               desc: "View complete red flag history (active and removed).",             level: 1 },
      ],
    },
    {
      name:     "🗂️ Cases & History",
      minLevel: 1,
      commands: [
        { cmd: "eb case <caseId>",                  desc: "Full details of one case — evidence, jump links, removal info, related case.", level: 1 },
        { cmd: "eb modlogs @user",                  desc: "Summarized moderation history (all action types) for a member.",               level: 1 },
        { cmd: "eb modlogs @user --case <caseId>",  desc: "Jump directly to a specific case.",                                            level: 1 },
        { cmd: "eb warnings @user --case <caseId>", desc: "Jump directly to a specific warning case.",                                     level: 1 },
      ],
    },
    {
      name:     "🛠️ General",
      minLevel: 1,
      commands: [
        { cmd: "eb modhelp  /  eb mh", desc: "Show this help menu.", level: 1 },
      ],
    },
  ];

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🛡️ Moderation Command Guide")
    .setDescription(
      "Complete reference for AvaBot's moderation cases, Jail and warning system.\n" +
      `Your permission level: **${level}**\n\n` +
      "_Reply to any message before using a mod command to automatically attach it as evidence._"
    )
    .setFooter({ text: "All moderation actions are logged to the mod-log channel." })
    .setTimestamp();

  for (const cat of categories) {
    if (cat.minLevel > level) continue;
    const availableCmds = cat.commands.filter((c) => c.level <= level);
    if (availableCmds.length === 0) continue;

    const value = availableCmds.map((c) => `\`${c.cmd}\`\n↳ ${c.desc}`).join("\n\n");
    embed.addFields({ name: cat.name, value, inline: false });
  }

  embed.addFields(
    {
      name:  "🚨 Warning Escalation",
      value:
        `• Warnings remain **active** until removed with \`eb unwarn\`.\n` +
        `• At **3+ active warnings**, an escalation alert is posted in the mod-log channel.\n` +
        `• At exactly **${AUTO_JAIL_WARN_THRESHOLD} active warnings**, the member is **automatically jailed** for \`${AUTO_JAIL_DURATION}\`.`,
      inline: false,
    },
    {
      name:  "🔒 Jail Notes",
      value:
        "• Expired Jail sentences are released automatically — including after a bot restart.\n" +
        "• Use `eb pardon @user jail <reason>` or `eb unjail @user <reason>` to release early.",
      inline: false,
    },
    {
      name:  "🚩 Red Flag Notes",
      value:
        "• Red flags are **monitoring alerts** — they appear only in the mod-log channel.\n" +
        "• Users are **not** notified when flagged or unflagged.\n" +
        "• Only **one active flag** can exist per user at a time.",
      inline: false,
    },
  );

  await respond(message, [embed]);
}

// ════════════════════════════════════════════
//              MAIN ROUTER
// ════════════════════════════════════════════
module.exports = {
  name: "moderation",
  commands: MOD_COMMANDS,

  init(client) {
    sweepExpiredJails(client);
    setInterval(() => sweepExpiredJails(client), 5 * 60 * 1000);
  },

  async execute(message, args, client, commandName) {
    commandName = COMMAND_ALIASES[commandName] || commandName;

    try {
      if (commandName === "jail" && args[0]?.toLowerCase() === "status") {
        return await handleJailStatus(message, client);
      }

      if (commandName === "redflagstatus" && args[0]?.toLowerCase() === "status") {
        return await handleRedFlagStatus(message, args.slice(1), client);
      }

      if (!hasModPermission(message.member)) {
        return respond(message, [errEmbed("Access Denied", "You don't have permission to use moderation commands.")]);
      }
      if (!canUseCommand(message.member, commandName)) {
        return respond(message, [errEmbed("Access Denied", `Your role cannot use \`eb ${commandName}\`.`)]);
      }

      switch (commandName) {
        case "warn":          return await handleWarn         (message, args, client);
        case "kick":          return await handleKick         (message, args, client);
        case "ban":           return await handleBan          (message, args, client);
        case "timeout":       return await handleTimeout      (message, args, client);
        case "unwarn":        return await handleUnwarn       (message, args, client);
        case "modlogs":       return await handleModlogs      (message, args, client);
        case "case":          return await handleCase         (message, args, client);
        case "warnings":      return await handleWarnings     (message, args, client);
        case "jail":          return await handleJail         (message, args, client);
        case "unjail":        return await handleUnjail       (message, args, client);
        case "pardon":        return await handlePardon       (message, args, client);
        case "redflag":       return await handleRedFlag      (message, args, client);
        case "unredflag":     return await handleUnredFlag    (message, args, client);
        case "redflagstatus": return await handleRedFlagStatus(message, args, client);
        case "redflaghistory":return await handleRedFlagHistory(message, args, client);
        case "modhelp":       return await handleModhelp      (message);
        default:
          return respond(message, [errEmbed("Unknown Command", "Use `eb modhelp` for a list of commands.")]);
      }
    } catch (err) {
      logger.error(`Moderation error [${commandName}]: ${err.message}`);
      logger.error(err.stack);
      await respond(message, [errEmbed("Unexpected Error", "Something went wrong. Please try again.")]);
    }
  },
};