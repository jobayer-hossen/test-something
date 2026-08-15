// database/services/moderationService.js
const ModerationLog = require("../schemas/ModerationLog");
const MessageSnapshot = require("../schemas/MessageSnapshot");
const Logger = require("../../logger");

const logger = new Logger("ModerationService");

// ════════════════════════════════════════════
//         LOG CHANNEL CONFIGURATION
// ════════════════════════════════════════════
const MOD_LOG_CHANNEL_ID = "1537836420700442644";

// ════════════════════════════════════════════
//         AUTHORIZED ROLES & USERS
// ════════════════════════════════════════════
const AUTHORIZED_ROLES = [
  "1472621955407548416", // Admin role
  "969999863871832177",  // Moderator role
];

// ════════════════════════════════════════════
//         PARSE DURATION STRING
// ════════════════════════════════════════════
function parseDuration(durationStr) {
  const regex = /^(\d+)(s|m|h|d|w)$/i;
  const match = durationStr.match(regex);

  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const ms = value * multipliers[unit];

  // Discord timeout max is 28 days
  if (ms > 28 * 24 * 60 * 60 * 1000) return null;
  if (ms < 1000) return null;

  return ms;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w ${days % 7}d`;
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ════════════════════════════════════════════
//         PERMISSION CHECK
// ════════════════════════════════════════════
function hasModPermission(member) {
  if (!member) return false;

  // Guild owner always has permission
  if (member.guild.ownerId === member.id) return true;

  // Check for administrator permission
  if (member.permissions.has("Administrator")) return true;

  // Check for authorized roles
  return AUTHORIZED_ROLES.some((roleId) => member.roles.cache.has(roleId));
}

// ════════════════════════════════════════════
//         GET MESSAGE SNAPSHOT
// ════════════════════════════════════════════
async function getMessageSnapshot(messageId) {
  try {
    return await MessageSnapshot.findOne({ messageId });
  } catch (err) {
    logger.error("Error getting message snapshot:", err.message);
    return null;
  }
}

// ════════════════════════════════════════════
//         CREATE MODERATION CASE
// ════════════════════════════════════════════
async function createCase({
  guildId,
  action,
  targetUser,
  moderator,
  reason,
  duration,
  durationString,
  evidence,
}) {
  try {
    const caseId = await ModerationLog.getNextCaseId(guildId);
    const expiresAt =
      duration ? new Date(Date.now() + duration) : null;

    const modCase = new ModerationLog({
      caseId,
      guildId,
      action,
      userId: targetUser.id,
      username: targetUser.username,
      userTag: targetUser.tag || targetUser.username,
      moderatorId: moderator.id,
      moderatorUsername: moderator.username,
      moderatorTag: moderator.tag || moderator.username,
      reason: reason || "No reason provided",
      duration: duration || null,
      durationString: durationString || null,
      expiresAt,
      evidence: evidence || {},
    });

    await modCase.save();
    return modCase;
  } catch (err) {
    logger.error("Error creating moderation case:", err.message);
    throw err;
  }
}

// ════════════════════════════════════════════
//         GET USER HISTORY
// ════════════════════════════════════════════
async function getUserHistory(guildId, userId) {
  try {
    return await ModerationLog.getUserCases(guildId, userId);
  } catch (err) {
    logger.error("Error fetching user history:", err.message);
    return [];
  }
}

// ════════════════════════════════════════════
//         GET CASE BY ID
// ════════════════════════════════════════════
async function getCaseById(guildId, caseId) {
  try {
    return await ModerationLog.findOne({ guildId, caseId });
  } catch (err) {
    logger.error("Error fetching case:", err.message);
    return null;
  }
}

// ════════════════════════════════════════════
//         DEACTIVATE CASE
// ════════════════════════════════════════════
async function deactivateCase(guildId, caseId) {
  try {
    return await ModerationLog.findOneAndUpdate(
      { guildId, caseId },
      { active: false },
      { new: true }
    );
  } catch (err) {
    logger.error("Error deactivating case:", err.message);
    return null;
  }
}

module.exports = {
  MOD_LOG_CHANNEL_ID,
  AUTHORIZED_ROLES,
  parseDuration,
  formatDuration,
  hasModPermission,
  getMessageSnapshot,
  createCase,
  getUserHistory,
  getCaseById,
  deactivateCase,
};