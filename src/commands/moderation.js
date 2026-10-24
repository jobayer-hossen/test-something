// commands/moderation.js
const {
  EmbedBuilder,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const mongoose = require("mongoose");

// ========================= CONFIG =========================
const MOD_LOG_CHANNEL_ID   = "1537836420700442644"; // staff-facing, shows moderator identity
const USER_LOGS_CHANNEL_ID = "1537836420700442644"; // #🗄️-user-logs — red flags only, staff-only
const APPEAL_CHANNEL_LINK  = "https://discord.com/channels/894383235063222313/1485295722403336293";

const ROLE_LEVELS = {
  "1348685917338210315": 3, // Mastermind
  "1472621955407548416": 3, // Core Command
  "1470791812733075637": 1, // Support Syndicate — warn + timeout only
};

const JAIL_ROLE_ID     = "1498459449227083916";
const INITIATE_ROLE_ID = "1330560814536589433"; // needs real ID for jail/unjail role-swap

const AUTO_JAIL_WARN_THRESHOLD = 3;
const AUTO_JAIL_DURATION       = "2h";

const NO_PING = { parse: [], repliedUser: false };

// Commands whose RESULT is sent privately (DM to the acting mod) instead of
// posted in the channel. These can be run in ANY channel now — no restriction.
const PRIVATE_REPLY_COMMANDS = [
  "warn", "kick", "ban", "timeout", "unwarn",
  "jail", "unjail", "pardon", "redflag", "unredflag",
];

const MOD_COMMANDS = [
  "warn", "kick", "ban", "timeout", "unwarn",
  "modlogs", "modhelp", "case", "warnings", "mh",
  "jail", "unjail", "pardon", "redflag", "unredflag",
];

const COMMAND_ALIASES = { mh: "modhelp" };

const LEVEL_COMMANDS = {
  1: ["warn", "timeout", "modlogs", "case", "modhelp", "warnings"],
  3: [
    "warn", "kick", "ban", "timeout", "unwarn",
    "modlogs", "case", "modhelp", "warnings",
    "jail", "unjail", "pardon", "redflag", "unredflag",
  ],
};

// ========================= SCHEMA =========================
const moderationLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  caseId: { type: Number, required: true },
  userId: { type: String, required: true },
  userTag: { type: String },
  moderatorId: { type: String, required: true },
  moderatorTag: { type: String },
  action: {
    type: String,
    enum: [
      "WARN", "KICK", "BAN", "TIMEOUT", "UNBAN", "UNWARN", "UNTIMEOUT",
      "JAIL", "UNJAIL", "REDFLAG", "UNREDFLAG",
    ],
    required: true,
  },
  reason: { type: String, default: "No reason provided" },
  duration: { type: String },
  expiresAt: { type: Date },
  active: { type: Boolean, default: true },
  evidenceUrl: { type: String },
  createdAt: { type: Date, default: Date.now },

  removedAt: { type: Date },
  removedBy: { type: String },
  removedByTag: { type: String },
  removalReason: { type: String },
  relatedCaseId: { type: Number },
});

const ModerationLog =
  mongoose.models.ModerationLog || mongoose.model("ModerationLog", moderationLogSchema);

// ========================= HELPERS =========================
function getStaffLevel(member) {
  let level = 0;
  for (const [roleId, lvl] of Object.entries(ROLE_LEVELS)) {
    if (member.roles.cache.has(roleId) && lvl > level) level = lvl;
  }
  return level;
}

function hasModPermission(member) {
  return getStaffLevel(member) > 0;
}

function canUseCommand(member, commandName) {
  const level = getStaffLevel(member);
  if (level === 0) return false;
  return (LEVEL_COMMANDS[level] || []).includes(commandName);
}

function hierarchyOk(message, targetMember) {
  if (!targetMember) return true;
  if (targetMember.id === message.guild.ownerId) return false;
  if (targetMember.id === message.author.id) return false;
  if (targetMember.id === message.client.user.id) return false;
  return message.member.roles.highest.position > targetMember.roles.highest.position;
}

function parseDuration(input) {
  if (!input) return null;
  const match = /^(\d+)(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const ms = amount * unitMs[unit];
  const maxMs = 28 * 86400000;
  if (ms <= 0 || ms > maxMs) return null;
  return ms;
}

function formatDuration(ms) {
  const units = [["d", 86400000], ["h", 3600000], ["m", 60000], ["s", 1000]];
  let remaining = ms;
  const parts = [];
  for (const [label, unitMs] of units) {
    const val = Math.floor(remaining / unitMs);
    if (val > 0) {
      parts.push(`${val}${label}`);
      remaining -= val * unitMs;
    }
  }
  return parts.length ? parts.join(" ") : "0s";
}

async function getNextCaseId(guildId) {
  const last = await ModerationLog.findOne({ guildId }).sort({ caseId: -1 }).lean();
  return last ? last.caseId + 1 : 1;
}

async function getEvidenceUrl(message) {
  if (message.reference) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId);
      const attachment = refMsg.attachments.first();
      if (attachment) return attachment.url;
      if (refMsg.embeds.length && refMsg.embeds[0].image) return refMsg.embeds[0].image.url;
    } catch {}
  }
  const attachment = message.attachments.first();
  return attachment ? attachment.url : null;
}

function isSecretAction(action) {
  return action === "REDFLAG" || action === "UNREDFLAG";
}

function errorEmbed(description) {
  return new EmbedBuilder().setTitle("❌ Error").setDescription(description).setColor(0xe74c3c);
}

// ========================= EMBED BUILDERS =========================
function buildDMEmbed({ title, color, guildName, reason, caseId, extraFields = [] }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Server", value: guildName, inline: true },
      { name: "Issued By", value: "Epic Bot Moderation System", inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Reason", value: reason || "No reason provided" },
      ...extraFields
    )
    .setFooter({ text: "If you believe this was a mistake, use the appeal channel." })
    .setTimestamp();
}

function buildLogEmbed({
  title, color, member, moderator, reason, caseId, evidenceUrl,
  extraFields = [], priorCases = [],
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Member", value: `${member} (${member.id})`, inline: true },
      { name: "Moderator", value: `${moderator.tag} (<@${moderator.id}>)`, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Reason", value: reason || "No reason provided" },
      ...extraFields
    )
    .setTimestamp();
  if (evidenceUrl) embed.setImage(evidenceUrl);

  const visiblePrior = priorCases.filter((c) => !isSecretAction(c.action));
  if (visiblePrior.length) {
    embed.addFields({
      name: "Prior Cases",
      value: visiblePrior
        .slice(0, 5)
        .map((c) => `#${c.caseId} — ${c.action} (${new Date(c.createdAt).toLocaleDateString()})`)
        .join("\n"),
    });
  }
  return embed;
}

function buildSecretLogEmbed({ action, member, moderator, reason, caseId }) {
  const isAdd = action === "REDFLAG";
  return new EmbedBuilder()
    .setTitle(isAdd ? "🚩 Member Flagged for Monitoring" : "✅ Red Flag Removed")
    .setColor(isAdd ? 0xff0000 : 0x00b300)
    .addFields(
      { name: "Member", value: `${member} (${member.id})`, inline: true },
      { name: "Moderator", value: `${moderator.tag} (<@${moderator.id}>)`, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Reason", value: reason || "No reason provided" }
    )
    .setFooter({ text: "CONFIDENTIAL — staff eyes only. Never shown to the member or in case/modlogs/warnings." })
    .setTimestamp();
}

// ========================= SEND HELPERS =========================
async function logSend(client, channelId, embed) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed], allowedMentions: NO_PING });
  } catch (err) {
    console.error(`Failed to send log to channel ${channelId}:`, err.message);
  }
}

async function respond(message, embed) {
  return message.channel.send({ embeds: [embed], allowedMentions: NO_PING });
}

// Sends the command RESULT privately to the acting moderator via DM so it's
// never visible to anyone else, regardless of which channel the command ran in.
async function sendResult(message, embed, commandName) {
  if (!PRIVATE_REPLY_COMMANDS.includes(commandName)) {
    return respond(message, embed);
  }
  try {
    await message.author.send({ embeds: [embed], allowedMentions: NO_PING });
    try { await message.react("✅"); } catch {}
  } catch {
    try { await message.react("⚠️"); } catch {}
    try {
      await message.author.send(
        "⚠️ I couldn't DM you the result of your last moderation action because your DMs are closed. " +
        "The action was still carried out and logged normally — open your DMs to receive future confirmations."
      );
    } catch {}
  }
}

async function sendPaginated(message, totalPages, buildEmbed) {
  let page = 0;
  const firstEmbed = await buildEmbed(page);

  if (totalPages <= 1) {
    return message.channel.send({ embeds: [firstEmbed], allowedMentions: NO_PING });
  }

  const makeRow = (p) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
      new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1)
    );

  const sent = await message.channel.send({
    embeds: [firstEmbed],
    components: [makeRow(page)],
    allowedMentions: NO_PING,
  });

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000,
    filter: (i) => i.user.id === message.author.id,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "prev") page = Math.max(0, page - 1);
    if (interaction.customId === "next") page = Math.min(totalPages - 1, page + 1);
    const newEmbed = await buildEmbed(page);
    await interaction.update({ embeds: [newEmbed], components: [makeRow(page)], allowedMentions: NO_PING });
  });

  collector.on("end", async () => {
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await sent.edit({ components: [disabledRow] });
    } catch {}
  });
}

// ========================= JAIL SCHEDULER =========================
const activeJailTimers = new Map();
const MAX_TIMEOUT_MS = 2147000000;

function scheduleJailRelease(client, guildId, userId, expiresAt) {
  const key = `${guildId}:${userId}`;
  if (activeJailTimers.has(key)) clearTimeout(activeJailTimers.get(key));

  const delay = expiresAt.getTime() - Date.now();
  if (delay <= 0) {
    releaseJail(client, guildId, userId).catch(console.error);
    return;
  }
  if (delay > MAX_TIMEOUT_MS) {
    const timer = setTimeout(() => scheduleJailRelease(client, guildId, userId, expiresAt), MAX_TIMEOUT_MS);
    activeJailTimers.set(key, timer);
    return;
  }
  const timer = setTimeout(() => {
    activeJailTimers.delete(key);
    releaseJail(client, guildId, userId).catch(console.error);
  }, delay);
  activeJailTimers.set(key, timer);
}

async function releaseJail(client, guildId, userId, { manual = false, moderator = null, reason = "Sentence served" } = {}) {
  const jailCase = await ModerationLog.findOne({ guildId, userId, action: "JAIL", active: true }).sort({ caseId: -1 });
  if (!jailCase) return null;

  jailCase.active = false;
  jailCase.removedAt = new Date();
  jailCase.removedBy = moderator ? moderator.id : "SYSTEM";
  jailCase.removedByTag = moderator ? moderator.tag : "Automatic Release";
  jailCase.removalReason = reason;
  await jailCase.save();

  const key = `${guildId}:${userId}`;
  if (activeJailTimers.has(key)) {
    clearTimeout(activeJailTimers.get(key));
    activeJailTimers.delete(key);
  }

  let member = null;
  try {
    const guild = await client.guilds.fetch(guildId);
    member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      if (member.roles.cache.has(JAIL_ROLE_ID)) await member.roles.remove(JAIL_ROLE_ID).catch(() => {});
      if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE") {
        await member.roles.add(INITIATE_ROLE_ID).catch(() => {});
      }
    }
  } catch (err) {
    console.error("releaseJail: failed to fetch guild/member", err.message);
  }

  const newCaseId = await getNextCaseId(guildId);
  const unjailCase = await ModerationLog.create({
    guildId,
    caseId: newCaseId,
    userId,
    userTag: member ? member.user.tag : "Unknown",
    moderatorId: moderator ? moderator.id : client.user.id,
    moderatorTag: moderator ? moderator.tag : "Epic Bot (Automatic)",
    action: "UNJAIL",
    reason,
    active: false,
    relatedCaseId: jailCase.caseId,
  });

  const logEmbed = new EmbedBuilder()
    .setTitle(manual ? "🔓 Member Unjailed" : "🔓 Jail Sentence Expired — Auto-Released")
    .setColor(0x2ecc71)
    .addFields(
      { name: "Member", value: member ? `${member} (${userId})` : `\`${userId}\``, inline: true },
      { name: "Moderator", value: moderator ? `${moderator.tag} (<@${moderator.id}>)` : "System (Automatic)", inline: true },
      { name: "Case ID", value: `#${unjailCase.caseId}`, inline: true },
      { name: "Original Case", value: `#${jailCase.caseId}` },
      { name: "Reason", value: reason }
    )
    .setTimestamp();
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  if (member) {
    const dmEmbed = buildDMEmbed({
      title: "🔓 You Have Been Released From Jail",
      color: 0x2ecc71,
      guildName: member.guild.name,
      reason,
      caseId: unjailCase.caseId,
    });
    await member.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});
  }

  return unjailCase;
}

async function sweepExpiredJails(client) {
  try {
    const expired = await ModerationLog.find({ action: "JAIL", active: true, expiresAt: { $lte: new Date() } });
    for (const c of expired) {
      await releaseJail(client, c.guildId, c.userId, { manual: false, reason: "Sentence served" });
    }
    const stillActive = await ModerationLog.find({ action: "JAIL", active: true, expiresAt: { $gt: new Date() } });
    for (const c of stillActive) {
      const key = `${c.guildId}:${c.userId}`;
      if (!activeJailTimers.has(key)) scheduleJailRelease(client, c.guildId, c.userId, c.expiresAt);
    }
  } catch (err) {
    console.error("sweepExpiredJails error:", err.message);
  }
}

// ========================= AUTO-JAIL ON WARN THRESHOLD =========================
async function autoJailOnWarnThreshold(message, targetMember, totalWarns, client) {
  if (totalWarns !== AUTO_JAIL_WARN_THRESHOLD) return;

  const guildId = message.guild.id;
  const userId = targetMember.id;

  const existingJail = await ModerationLog.findOne({ guildId, userId, action: "JAIL", active: true });
  if (existingJail) return;

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

  const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
  if (!jailRole) return;
  if (jailRole.position >= message.guild.members.me.roles.highest.position) return;

  const durationMs = parseDuration(AUTO_JAIL_DURATION);
  const expiresAt = new Date(Date.now() + durationMs);

  if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE" && targetMember.roles.cache.has(INITIATE_ROLE_ID)) {
    await targetMember.roles.remove(INITIATE_ROLE_ID).catch(() => {});
  }
  await targetMember.roles.add(JAIL_ROLE_ID).catch(() => {});

  const caseId = await getNextCaseId(guildId);
  await ModerationLog.create({
    guildId,
    caseId,
    userId,
    userTag: targetMember.user.tag,
    moderatorId: client.user.id,
    moderatorTag: "Epic Bot (Automatic)",
    action: "JAIL",
    reason: `Automatic: reached ${AUTO_JAIL_WARN_THRESHOLD} active warnings`,
    duration: AUTO_JAIL_DURATION,
    expiresAt,
    active: true,
  });

  scheduleJailRelease(client, guildId, userId, expiresAt);

  const logEmbed = new EmbedBuilder()
    .setTitle("🚨 Auto-Jail Triggered")
    .setColor(0xe67e22)
    .addFields(
      { name: "Member", value: `${targetMember} (${userId})`, inline: true },
      { name: "Trigger", value: `Reached ${AUTO_JAIL_WARN_THRESHOLD} active warnings (automatic)`, inline: true },
      { name: "Case ID", value: `#${caseId}`, inline: true },
      { name: "Duration", value: AUTO_JAIL_DURATION },
      { name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` }
    )
    .setTimestamp();
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  const dmEmbed = buildDMEmbed({
    title: "⛓️ You Have Been Jailed",
    color: 0xe67e22,
    guildName: message.guild.name,
    reason: `You reached ${AUTO_JAIL_WARN_THRESHOLD} active warnings.`,
    caseId,
    extraFields: [
      { name: "Duration", value: AUTO_JAIL_DURATION, inline: true },
      { name: "Release", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
    ],
  });
  await targetMember.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});
}

// ========================= ACTION HANDLERS =========================
async function handleWarn(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to warn."));
  if (!hierarchyOk(message, target)) return respond(message, errorEmbed("You cannot moderate this member."));

  const reason = args.slice(1).join(" ") || "No reason provided";
  const evidenceUrl = await getEvidenceUrl(message);
  const caseId = await getNextCaseId(message.guild.id);

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "WARN", reason, evidenceUrl, active: true,
  });

  const totalWarns = await ModerationLog.countDocuments({
    guildId: message.guild.id, userId: target.id, action: "WARN", active: true,
  });
  const priorCases = await ModerationLog.find({ guildId: message.guild.id, userId: target.id })
    .sort({ caseId: -1 }).limit(6).lean();

  const logEmbed = buildLogEmbed({
    title: "⚠️ Member Warned", color: 0xf1c40f,
    member: target, moderator: message.author, reason, caseId, evidenceUrl,
    extraFields: [{ name: "Active Warnings", value: `${totalWarns}`, inline: true }],
    priorCases,
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  const dmEmbed = buildDMEmbed({
    title: "⚠️ You Have Received a Warning", color: 0xf1c40f,
    guildName: message.guild.name, reason, caseId,
    extraFields: [{ name: "Active Warnings", value: `${totalWarns}`, inline: true }],
  });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await sendResult(message, logEmbed, "warn");
  await autoJailOnWarnThreshold(message, target, totalWarns, client);
}

async function handleKick(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to kick."));
  if (!hierarchyOk(message, target)) return respond(message, errorEmbed("You cannot moderate this member."));
  if (!target.kickable) return respond(message, errorEmbed("I cannot kick this member (role hierarchy)."));

  const reason = args.slice(1).join(" ") || "No reason provided";
  const evidenceUrl = await getEvidenceUrl(message);
  const caseId = await getNextCaseId(message.guild.id);

  const dmEmbed = buildDMEmbed({ title: "👢 You Have Been Kicked", color: 0xe67e22, guildName: message.guild.name, reason, caseId });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await target.kick(reason);

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "KICK", reason, evidenceUrl, active: false,
  });

  const logEmbed = buildLogEmbed({
    title: "👢 Member Kicked", color: 0xe67e22,
    member: target, moderator: message.author, reason, caseId, evidenceUrl,
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);
  await sendResult(message, logEmbed, "kick");
}

async function handleBan(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to ban."));
  if (!hierarchyOk(message, target)) return respond(message, errorEmbed("You cannot moderate this member."));
  if (!target.bannable) return respond(message, errorEmbed("I cannot ban this member (role hierarchy)."));

  const reason = args.slice(1).join(" ") || "No reason provided";
  const evidenceUrl = await getEvidenceUrl(message);
  const caseId = await getNextCaseId(message.guild.id);

  const dmEmbed = buildDMEmbed({
    title: "🔨 You Have Been Banned", color: 0xc0392b, guildName: message.guild.name, reason, caseId,
    extraFields: [{ name: "Appeal", value: APPEAL_CHANNEL_LINK }],
  });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await target.ban({ reason });

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "BAN", reason, evidenceUrl, active: true,
  });

  const logEmbed = buildLogEmbed({
    title: "🔨 Member Banned", color: 0xc0392b,
    member: target, moderator: message.author, reason, caseId, evidenceUrl,
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);
  await sendResult(message, logEmbed, "ban");
}

async function handleTimeout(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to timeout."));
  if (!hierarchyOk(message, target)) return respond(message, errorEmbed("You cannot moderate this member."));
  if (!target.moderatable) return respond(message, errorEmbed("I cannot timeout this member (role hierarchy)."));

  const durationMs = parseDuration(args[1]);
  if (!durationMs) return respond(message, errorEmbed("Invalid duration. Use format like 30m, 2h, 1d (max 28d)."));

  const reason = args.slice(2).join(" ") || "No reason provided";
  const evidenceUrl = await getEvidenceUrl(message);
  const caseId = await getNextCaseId(message.guild.id);
  const expiresAt = new Date(Date.now() + durationMs);

  await target.timeout(durationMs, reason);

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "TIMEOUT", reason, duration: formatDuration(durationMs), expiresAt, evidenceUrl, active: true,
  });

  const logEmbed = buildLogEmbed({
    title: "🔇 Member Timed Out", color: 0x9b59b6,
    member: target, moderator: message.author, reason, caseId, evidenceUrl,
    extraFields: [
      { name: "Duration", value: formatDuration(durationMs), inline: true },
      { name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
    ],
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  const dmEmbed = buildDMEmbed({
    title: "🔇 You Have Been Timed Out", color: 0x9b59b6, guildName: message.guild.name, reason, caseId,
    extraFields: [{ name: "Duration", value: formatDuration(durationMs), inline: true }],
  });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await sendResult(message, logEmbed, "timeout");
}

async function handleUnwarn(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member."));

  let warnCase;
  const caseArgIdx = args.findIndex((a) => a === "--case");
  if (caseArgIdx !== -1 && args[caseArgIdx + 1]) {
    const caseId = parseInt(args[caseArgIdx + 1], 10);
    warnCase = await ModerationLog.findOne({ guildId: message.guild.id, caseId, action: "WARN", active: true });
    if (!warnCase || warnCase.userId !== target.id) {
      return respond(message, errorEmbed("That case ID doesn't match an active warning for this member."));
    }
  } else {
    warnCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: target.id, action: "WARN", active: true })
      .sort({ caseId: -1 });
  }
  if (!warnCase) return respond(message, errorEmbed("This member has no active warnings."));

  const reasonParts = args
    .filter((a, i) => !(a === "--case" || args[i - 1] === "--case"))
    .slice(1);
  const reason = reasonParts.join(" ") || "No reason provided";

  warnCase.active = false;
  warnCase.removedAt = new Date();
  warnCase.removedBy = message.author.id;
  warnCase.removedByTag = message.author.tag;
  warnCase.removalReason = reason;
  await warnCase.save();

  const caseId = await getNextCaseId(message.guild.id);
  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "UNWARN", reason, active: false, relatedCaseId: warnCase.caseId,
  });

  const logEmbed = buildLogEmbed({
    title: "✅ Warning Removed", color: 0x2ecc71,
    member: target, moderator: message.author, reason, caseId,
    extraFields: [{ name: "Original Case", value: `#${warnCase.caseId}` }],
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  const dmEmbed = buildDMEmbed({ title: "✅ A Warning Has Been Removed", color: 0x2ecc71, guildName: message.guild.name, reason, caseId });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await sendResult(message, logEmbed, "unwarn");
}

// ---- Jail ----
async function handleJail(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to jail."));
  if (!hierarchyOk(message, target)) return respond(message, errorEmbed("You cannot moderate this member."));

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return respond(message, errorEmbed("I need the Manage Roles permission to jail members."));
  }
  const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
  if (!jailRole) return respond(message, errorEmbed("Jail role not found. Check JAIL_ROLE_ID configuration."));
  if (jailRole.position >= message.guild.members.me.roles.highest.position) {
    return respond(message, errorEmbed("My highest role must be above the Jail role to assign it."));
  }

  const existing = await ModerationLog.findOne({ guildId: message.guild.id, userId: target.id, action: "JAIL", active: true });
  if (existing) return respond(message, errorEmbed(`This member is already jailed (case #${existing.caseId}).`));

  const durationMs = parseDuration(args[1]);
  if (!durationMs) return respond(message, errorEmbed("Invalid duration. Use format like 30m, 2h, 1d, 5d, 7d, 14d (max 28d)."));

  const reason = args.slice(2).join(" ") || "No reason provided";
  const evidenceUrl = await getEvidenceUrl(message);
  const caseId = await getNextCaseId(message.guild.id);
  const expiresAt = new Date(Date.now() + durationMs);

  if (INITIATE_ROLE_ID && INITIATE_ROLE_ID !== "PUT_INITIATE_ROLE_ID_HERE" && target.roles.cache.has(INITIATE_ROLE_ID)) {
    await target.roles.remove(INITIATE_ROLE_ID).catch(() => {});
  }
  await target.roles.add(JAIL_ROLE_ID);

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "JAIL", reason, duration: formatDuration(durationMs), expiresAt, evidenceUrl, active: true,
  });

  scheduleJailRelease(client, message.guild.id, target.id, expiresAt);

  const logEmbed = buildLogEmbed({
    title: "⛓️ Member Jailed", color: 0x8e44ad,
    member: target, moderator: message.author, reason, caseId, evidenceUrl,
    extraFields: [
      { name: "Duration", value: formatDuration(durationMs), inline: true },
      { name: "Release", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
    ],
  });
  await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);

  const dmEmbed = buildDMEmbed({
    title: "⛓️ You Have Been Jailed", color: 0x8e44ad, guildName: message.guild.name, reason, caseId,
    extraFields: [
      { name: "Duration", value: formatDuration(durationMs), inline: true },
      { name: "Release", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
    ],
  });
  await target.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});

  await sendResult(message, logEmbed, "jail");
}

async function handleUnjail(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to unjail."));

  const reason = args.slice(1).join(" ") || "Released by staff";
  const jailCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: target.id, action: "JAIL", active: true });
  if (!jailCase) return respond(message, errorEmbed("This member has no active Jail sentence."));

  const unjailCase = await releaseJail(client, message.guild.id, target.id, { manual: true, moderator: message.author, reason });

  const logEmbed = new EmbedBuilder()
    .setTitle("🔓 Member Unjailed")
    .setColor(0x2ecc71)
    .addFields(
      { name: "Member", value: `${target} (${target.id})`, inline: true },
      { name: "Moderator", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
      { name: "Case ID", value: `#${unjailCase.caseId}`, inline: true },
      { name: "Original Case", value: `#${jailCase.caseId}` },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  await sendResult(message, logEmbed, "unjail");
}

async function handleJailStatus(message, client) {
  const member = message.member;
  const isStaff = hasModPermission(member);

  if (!isStaff) {
    const jailCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: member.id, action: "JAIL", active: true });
    if (!jailCase) {
      return respond(message, new EmbedBuilder().setTitle("🔓 Not Jailed").setDescription("You are not currently jailed.").setColor(0x2ecc71));
    }
    const embed = new EmbedBuilder()
      .setTitle("⛓️ Your Jail Status")
      .setColor(0x8e44ad)
      .addFields(
        { name: "Reason", value: jailCase.reason },
        { name: "Release", value: `<t:${Math.floor(jailCase.expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(jailCase.expiresAt.getTime() / 1000)}:R>)` },
        { name: "Case ID", value: `#${jailCase.caseId}` }
      );
    return respond(message, embed);
  }

  const activeJails = await ModerationLog.find({ guildId: message.guild.id, action: "JAIL", active: true }).sort({ expiresAt: 1 }).lean();
  if (!activeJails.length) {
    return respond(message, new EmbedBuilder().setTitle("🔓 No Active Jail Sentences").setColor(0x2ecc71));
  }

  const perPage = 5;
  const totalPages = Math.ceil(activeJails.length / perPage);
  await sendPaginated(message, totalPages, async (page) => {
    const pageItems = activeJails.slice(page * perPage, page * perPage + perPage);
    const embed = new EmbedBuilder()
      .setTitle("⛓️ Active Jail Sentences")
      .setColor(0x8e44ad)
      .setFooter({ text: `Page ${page + 1}/${totalPages}` });
    for (const c of pageItems) {
      embed.addFields({
        name: `Case #${c.caseId} — ${c.userTag}`,
        value: `<@${c.userId}>\nReason: ${c.reason}\nRelease: <t:${Math.floor(new Date(c.expiresAt).getTime() / 1000)}:R>`,
      });
    }
    return embed;
  });
}

// ---- Pardon ----
const PARDON_TYPES = {
  jail:    { action: "JAIL",    label: "Jail" },
  timeout: { action: "TIMEOUT", label: "Timeout" },
  ban:     { action: "BAN",     label: "Ban" },
};

async function handlePardon(message, args, client) {
  const target = message.mentions.members.first() || null;
  const targetId = target ? target.id : args.find((a) => /^\d{15,20}$/.test(a));
  if (!targetId) return respond(message, errorEmbed("Please mention a member (or provide their ID for bans)."));

  const punishmentArg = args.find((a) => Object.keys(PARDON_TYPES).includes(a.toLowerCase()));
  if (!punishmentArg) return respond(message, errorEmbed("Please specify a punishment type: `jail`, `timeout`, or `ban`."));
  const pardonInfo = PARDON_TYPES[punishmentArg.toLowerCase()];

  const reasonStartIdx = args.indexOf(punishmentArg) + 1;
  const reason = args.slice(reasonStartIdx).join(" ") || "No reason provided";

  if (pardonInfo.action === "JAIL") {
    const jailCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: targetId, action: "JAIL", active: true });
    if (!jailCase) return respond(message, errorEmbed("No active Jail sentence found for this member."));
    const unjailCase = await releaseJail(client, message.guild.id, targetId, { manual: true, moderator: message.author, reason });
    const logEmbed = new EmbedBuilder()
      .setTitle("🕊️ Pardon Granted — Jail").setColor(0x2ecc71)
      .addFields(
        { name: "Member", value: `<@${targetId}>`, inline: true },
        { name: "Moderator", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "Case ID", value: `#${unjailCase.caseId}`, inline: true },
        { name: "Original Case", value: `#${jailCase.caseId}` },
        { name: "Reason", value: reason }
      ).setTimestamp();
    return sendResult(message, logEmbed, "pardon");
  }

  if (pardonInfo.action === "TIMEOUT") {
    const timeoutCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: targetId, action: "TIMEOUT", active: true }).sort({ caseId: -1 });
    if (!timeoutCase) return respond(message, errorEmbed("No active Timeout found for this member."));
    const member = await message.guild.members.fetch(targetId).catch(() => null);
    if (member) await member.timeout(null, reason).catch(() => {});

    timeoutCase.active = false;
    timeoutCase.removedAt = new Date();
    timeoutCase.removedBy = message.author.id;
    timeoutCase.removedByTag = message.author.tag;
    timeoutCase.removalReason = reason;
    await timeoutCase.save();

    const caseId = await getNextCaseId(message.guild.id);
    await ModerationLog.create({
      guildId: message.guild.id, caseId, userId: targetId, userTag: member ? member.user.tag : "Unknown",
      moderatorId: message.author.id, moderatorTag: message.author.tag,
      action: "UNTIMEOUT", reason, active: false, relatedCaseId: timeoutCase.caseId,
    });

    if (member) {
      const dmEmbed = buildDMEmbed({ title: "🕊️ Your Timeout Has Been Lifted", color: 0x2ecc71, guildName: message.guild.name, reason, caseId });
      await member.send({ embeds: [dmEmbed], allowedMentions: NO_PING }).catch(() => {});
    }

    const logEmbed = new EmbedBuilder()
      .setTitle("🕊️ Pardon Granted — Timeout").setColor(0x2ecc71)
      .addFields(
        { name: "Member", value: `<@${targetId}>`, inline: true },
        { name: "Moderator", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "Case ID", value: `#${caseId}`, inline: true },
        { name: "Original Case", value: `#${timeoutCase.caseId}` },
        { name: "Reason", value: reason }
      ).setTimestamp();
    await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);
    return sendResult(message, logEmbed, "pardon");
  }

  if (pardonInfo.action === "BAN") {
    const banCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: targetId, action: "BAN", active: true }).sort({ caseId: -1 });
    if (!banCase) return respond(message, errorEmbed("No active Ban found for this member."));

    await message.guild.bans.remove(targetId, reason).catch(() => {});

    banCase.active = false;
    banCase.removedAt = new Date();
    banCase.removedBy = message.author.id;
    banCase.removedByTag = message.author.tag;
    banCase.removalReason = reason;
    await banCase.save();

    const caseId = await getNextCaseId(message.guild.id);
    await ModerationLog.create({
      guildId: message.guild.id, caseId, userId: targetId, userTag: banCase.userTag,
      moderatorId: message.author.id, moderatorTag: message.author.tag,
      action: "UNBAN", reason, active: false, relatedCaseId: banCase.caseId,
    });

    const logEmbed = new EmbedBuilder()
      .setTitle("🕊️ Pardon Granted — Ban").setColor(0x2ecc71)
      .addFields(
        { name: "Member", value: `<@${targetId}>`, inline: true },
        { name: "Moderator", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "Case ID", value: `#${caseId}`, inline: true },
        { name: "Original Case", value: `#${banCase.caseId}` },
        { name: "Reason", value: reason }
      ).setTimestamp();
    await logSend(client, MOD_LOG_CHANNEL_ID, logEmbed);
    return sendResult(message, logEmbed, "pardon");
  }
}

// ---- Red Flags ----
async function handleRedFlag(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to flag."));

  const reason = args.slice(1).join(" ") || "No reason provided";
  const caseId = await getNextCaseId(message.guild.id);

  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "REDFLAG", reason, active: true,
  });

  const secretEmbed = buildSecretLogEmbed({ action: "REDFLAG", member: target, moderator: message.author, reason, caseId });
  await logSend(client, USER_LOGS_CHANNEL_ID, secretEmbed);

  await sendResult(message, secretEmbed, "redflag");
}

async function handleUnRedFlag(message, args, client) {
  const target = message.mentions.members.first();
  if (!target) return respond(message, errorEmbed("Please mention a member to unflag."));

  const reason = args.slice(1).join(" ") || "No reason provided";
  const flagCase = await ModerationLog.findOne({ guildId: message.guild.id, userId: target.id, action: "REDFLAG", active: true }).sort({ caseId: -1 });
  if (!flagCase) return respond(message, errorEmbed("This member has no active red flag."));

  flagCase.active = false;
  flagCase.removedAt = new Date();
  flagCase.removedBy = message.author.id;
  flagCase.removedByTag = message.author.tag;
  flagCase.removalReason = reason;
  await flagCase.save();

  const caseId = await getNextCaseId(message.guild.id);
  await ModerationLog.create({
    guildId: message.guild.id, caseId, userId: target.id, userTag: target.user.tag,
    moderatorId: message.author.id, moderatorTag: message.author.tag,
    action: "UNREDFLAG", reason, active: false, relatedCaseId: flagCase.caseId,
  });

  const secretEmbed = buildSecretLogEmbed({ action: "UNREDFLAG", member: target, moderator: message.author, reason, caseId });
  await logSend(client, USER_LOGS_CHANNEL_ID, secretEmbed);

  await sendResult(message, secretEmbed, "unredflag");
}

// ---- Warnings ----
async function handleWarnings(message, args, client) {
  const caseArgIdx = args.findIndex((a) => a === "--case");
  if (caseArgIdx !== -1 && args[caseArgIdx + 1]) {
    return handleCase(message, [args[caseArgIdx + 1]], client);
  }
  const target = message.mentions.members.first();
  if (target) return showUserWarnings(message, target);
  return showGuildWarnings(message);
}

async function showUserWarnings(message, target) {
  const warns = await ModerationLog.find({ guildId: message.guild.id, userId: target.id, action: "WARN" }).sort({ caseId: -1 }).lean();
  if (!warns.length) {
    return respond(message, new EmbedBuilder().setTitle("No Warnings").setDescription(`${target} has no warning history.`).setColor(0x2ecc71));
  }

  const perPage = 4;
  const totalPages = Math.ceil(warns.length / perPage);
  await sendPaginated(message, totalPages, async (page) => {
    const pageItems = warns.slice(page * perPage, page * perPage + perPage);
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warning History — ${target.user.tag}`)
      .setColor(0xf1c40f)
      .setFooter({ text: `Page ${page + 1}/${totalPages} • ${warns.length} total warning(s)` });

    for (const w of pageItems) {
      const status = w.active ? "🟡 Active" : "✅ Removed";
      let value = `**Status:** ${status}\n**Issued:** <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:F>\n**Reason:** ${w.reason}\n**Moderator:** ${w.moderatorTag}`;
      if (!w.active && w.removedAt) {
        value += `\n**Removed:** <t:${Math.floor(new Date(w.removedAt).getTime() / 1000)}:F> by ${w.removedByTag}\n**Removal Reason:** ${w.removalReason || "N/A"}`;
      }
      embed.addFields({ name: `Case #${w.caseId}`, value });
    }
    return embed;
  });
}

async function showGuildWarnings(message) {
  const activeWarns = await ModerationLog.aggregate([
    { $match: { guildId: message.guild.id, action: "WARN", active: true } },
    { $group: { _id: "$userId", count: { $sum: 1 }, userTag: { $first: "$userTag" } } },
    { $sort: { count: -1 } },
  ]);

  if (!activeWarns.length) {
    return respond(message, new EmbedBuilder().setTitle("No Active Warnings").setDescription("No members currently have active warnings.").setColor(0x2ecc71));
  }

  const perPage = 10;
  const totalPages = Math.ceil(activeWarns.length / perPage);
  await sendPaginated(message, totalPages, async (page) => {
    const pageItems = activeWarns.slice(page * perPage, page * perPage + perPage);
    return new EmbedBuilder()
      .setTitle("⚠️ Guild Warning Overview")
      .setColor(0xf1c40f)
      .setDescription(pageItems.map((w, i) => `**${page * perPage + i + 1}.** <@${w._id}> (${w.userTag}) — **${w.count}** active warning(s)`).join("\n"))
      .setFooter({ text: `Page ${page + 1}/${totalPages} • ${activeWarns.length} member(s) with active warnings` });
  });
}

// ---- Case / Modlogs / Help ----
async function handleCase(message, args, client) {
  const caseId = parseInt(args[0], 10);
  if (!caseId) return respond(message, errorEmbed("Please provide a valid case ID. Usage: `eb case <id>`"));

  const foundCase = await ModerationLog.findOne({ guildId: message.guild.id, caseId }).lean();
  if (!foundCase || isSecretAction(foundCase.action)) {
    return respond(message, errorEmbed(`Case #${caseId} was not found.`));
  }

  const embed = new EmbedBuilder()
    .setTitle(`📁 Case #${foundCase.caseId}`)
    .setColor(0x3498db)
    .addFields(
      { name: "Action", value: foundCase.action, inline: true },
      { name: "Member", value: `<@${foundCase.userId}> (${foundCase.userTag})`, inline: true },
      { name: "Moderator", value: `${foundCase.moderatorTag}`, inline: true },
      { name: "Reason", value: foundCase.reason || "No reason provided" },
      { name: "Issued", value: `<t:${Math.floor(new Date(foundCase.createdAt).getTime() / 1000)}:F>`, inline: true },
      { name: "Status", value: foundCase.active ? "🟡 Active" : "✅ Closed", inline: true }
    );

  if (foundCase.duration) embed.addFields({ name: "Duration", value: foundCase.duration, inline: true });
  if (foundCase.expiresAt) embed.addFields({ name: "Expires", value: `<t:${Math.floor(new Date(foundCase.expiresAt).getTime() / 1000)}:F>`, inline: true });
  if (foundCase.evidenceUrl) embed.setImage(foundCase.evidenceUrl);
  if (foundCase.relatedCaseId) embed.addFields({ name: "Related Case", value: `#${foundCase.relatedCaseId}` });
  if (!foundCase.active && foundCase.removedAt) {
    embed.addFields({
      name: "Removed",
      value: `<t:${Math.floor(new Date(foundCase.removedAt).getTime() / 1000)}:F> by ${foundCase.removedByTag}\nReason: ${foundCase.removalReason || "N/A"}`,
    });
  }

  return respond(message, embed);
}

async function handleModLogs(message, args, client) {
  const target = message.mentions.members.first();
  const filter = { guildId: message.guild.id, action: { $nin: ["REDFLAG", "UNREDFLAG"] } };
  if (target) filter.userId = target.id;

  const logs = await ModerationLog.find(filter).sort({ caseId: -1 }).limit(50).lean();
  if (!logs.length) return respond(message, new EmbedBuilder().setTitle("No Logs Found").setColor(0x2ecc71));

  const perPage = 6;
  const totalPages = Math.ceil(logs.length / perPage);
  await sendPaginated(message, totalPages, async (page) => {
    const pageItems = logs.slice(page * perPage, page * perPage + perPage);
    const embed = new EmbedBuilder()
      .setTitle(target ? `📜 Mod Logs — ${target.user.tag}` : "📜 Server Mod Logs")
      .setColor(0x3498db)
      .setFooter({ text: `Page ${page + 1}/${totalPages}` });
    for (const l of pageItems) {
      embed.addFields({
        name: `#${l.caseId} — ${l.action}`,
        value: `Member: <@${l.userId}>\nModerator: ${l.moderatorTag}\nReason: ${l.reason}\n<t:${Math.floor(new Date(l.createdAt).getTime() / 1000)}:R>`,
      });
    }
    return embed;
  });
}

async function handleModHelp(message, args, client) {
  const level = getStaffLevel(message.member);
  if (level === 0) return respond(message, errorEmbed("You do not have access to moderation commands."));

  const allowed = LEVEL_COMMANDS[level] || [];
  const embed = new EmbedBuilder()
    .setTitle("🛡️ Epic Bot — Moderation Command Guide")
    .setColor(0x2c3e50)
    .setDescription(`Showing commands available to your permission level (**Level ${level}**).`);

  const categories = [
    {
      name: "⚠️ Warning Commands",
      commands: ["warn", "unwarn", "warnings"],
      lines: {
        warn: "`eb warn @member <reason>` — Issue a formal warning. Reply to a message to auto-attach evidence.",
        unwarn: "`eb unwarn @member <reason>` [--case <id>] — Remove the latest (or a specific) active warning.",
        warnings: "`eb warnings @member` — Full warning history. `eb warnings` — guild-wide overview. `--case <id>` jumps directly to a case.",
      },
    },
    {
      name: "🚨 Warning Escalation",
      custom: `Reaching **${AUTO_JAIL_WARN_THRESHOLD} active warnings** automatically triggers a **${AUTO_JAIL_DURATION} Jail sentence** — no manual action required.`,
    },
    {
      name: "👢 Standard Enforcement",
      commands: ["kick", "ban", "timeout"],
      lines: {
        kick: "`eb kick @member <reason>` — Remove a member from the server.",
        ban: "`eb ban @member <reason>` — Permanently ban a member.",
        timeout: "`eb timeout @member <duration> <reason>` — Mute via Discord timeout (max 28d).",
      },
    },
    {
      name: "⛓️ Jail System",
      commands: ["jail", "unjail"],
      lines: {
        jail: "`eb jail @member <duration> <reason>` — Apply the Jail role for a set time (30m–28d). `eb jail status` — check active sentences (your own if non-staff, all if staff).",
        unjail: "`eb unjail @member <reason>` — End an active Jail sentence early.",
      },
    },
    {
      name: "🕊️ Pardons",
      commands: ["pardon"],
      lines: {
        pardon: "`eb pardon @member <jail|timeout|ban> <reason>` — Reverse the latest matching active punishment. Does **not** cover warnings (`eb unwarn`) or red flags (`eb unredflag`).",
      },
    },
    {
      name: "🚩 Confidential Monitoring",
      commands: ["redflag", "unredflag"],
      lines: {
        redflag: "`eb redflag @member <reason>` — Silently flag a member for staff-only monitoring. No DM, never appears in case/modlogs/warnings.",
        unredflag: "`eb unredflag @member <reason>` — Remove an active red flag.",
      },
    },
    {
      name: "📁 Cases & History",
      commands: ["case", "modlogs"],
      lines: {
        case: "`eb case <id>` — Look up full details of any case by ID.",
        modlogs: "`eb modlogs [@member]` — Paginated action history, server-wide or for one member.",
      },
    },
  ];

  for (const cat of categories) {
    if (cat.custom) {
      if (level >= 1) embed.addFields({ name: cat.name, value: cat.custom });
      continue;
    }
    const visibleCmds = cat.commands.filter((c) => allowed.includes(c));
    if (!visibleCmds.length) continue;
    embed.addFields({ name: cat.name, value: visibleCmds.map((c) => cat.lines[c]).join("\n\n") });
  }

  embed.addFields(
    {
      name: "🤫 Privacy Notes",
      value:
        "Punished members only ever see **\"Epic Bot Moderation System\"** as the issuer — never the acting moderator's name.\n" +
        "Your command's reply is sent to **your DMs only** — nothing is posted publicly, no matter which channel you run the command in.\n" +
        "Red flags are fully confidential: no DM, no appearance in `case`/`modlogs`/`warnings` — staff-only via the user-logs channel.",
    },
    {
      name: "🔒 Jail Notes",
      value: "Jail sentences auto-release on expiry, even across bot restarts. Use `eb pardon @member jail <reason>` or `eb unjail @member <reason>` to release early.",
    }
  );

  embed.setFooter({ text: "Epic Bot Moderation System" }).setTimestamp();
  return respond(message, embed);
}

// ========================= INIT =========================
async function init(client) {
  await sweepExpiredJails(client);
  setInterval(() => sweepExpiredJails(client), 5 * 60 * 1000);
}

// ========================= EXPORT =========================
module.exports = {
  name: "moderation",
  commands: MOD_COMMANDS,
  init,
  async execute(message, args, client) {
    if (!message.guild || message.author.bot || !args.length) return;

    let commandName = args[0].toLowerCase();
    args = args.slice(1);

    if (!MOD_COMMANDS.includes(commandName)) return;
    if (COMMAND_ALIASES[commandName]) commandName = COMMAND_ALIASES[commandName];

    // `eb jail status` bypasses normal gating — any member can check their own status
    if (commandName === "jail" && args[0]?.toLowerCase() === "status") {
      return handleJailStatus(message, client);
    }

    if (!hasModPermission(message.member)) {
      return respond(message, errorEmbed("You do not have permission to use moderation commands."));
    }
    if (!canUseCommand(message.member, commandName)) {
      return respond(message, errorEmbed("Your permission level does not allow this command."));
    }

    try {
      switch (commandName) {
        case "warn":      return await handleWarn(message, args, client);
        case "kick":      return await handleKick(message, args, client);
        case "ban":       return await handleBan(message, args, client);
        case "timeout":   return await handleTimeout(message, args, client);
        case "unwarn":    return await handleUnwarn(message, args, client);
        case "modlogs":   return await handleModLogs(message, args, client);
        case "modhelp":   return await handleModHelp(message, args, client);
        case "case":      return await handleCase(message, args, client);
        case "warnings":  return await handleWarnings(message, args, client);
        case "jail":      return await handleJail(message, args, client);
        case "unjail":    return await handleUnjail(message, args, client);
        case "pardon":    return await handlePardon(message, args, client);
        case "redflag":   return await handleRedFlag(message, args, client);
        case "unredflag": return await handleUnRedFlag(message, args, client);
      }
    } catch (err) {
      console.error(`moderation command "${commandName}" error:`, err);
      return respond(message, errorEmbed("An unexpected error occurred while processing this command."));
    }
  },
};