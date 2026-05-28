const PersonalChannel = require("../database/schemas/PersonalChannel");
const Logger = require("../logger");
const logger = new Logger("BaseManager");

class BaseManager {
  constructor(client) {
    this.client = client;
    this.initiateRoleId = "1330560814536589433"; 
    this.ownerRoleId = "1509634371999502435";
    this.categoryIds = ["1479929670219858221"]; 
  }

  async createBase(member, customName) {
    const existing = await PersonalChannel.findOne({ userId: member.id });
    if (existing) return { success: false, message: "You already own a room!" };

    let targetCategory = null;
    for (const catId of this.categoryIds) {
      const cat = await this.client.channels.fetch(catId).catch(() => null);
      if (cat && cat.children.cache.size < 50) {
        targetCategory = cat;
        break;
      }
    }

    if (!targetCategory) return { success: false, message: "All sectors are full!" };

    try {
      // Add the role to the user
      await member.roles.add(this.ownerRoleId).catch(() => null);

      const channel = await targetCategory.guild.channels.create({
        name: customName,
        parent: targetCategory.id,
        permissionOverwrites: [
          { 
            id: targetCategory.guild.id, 
            deny: ['ViewChannel'] 
          }, 
          { 
            id: this.initiateRoleId, 
            deny: ['ViewChannel'] // Initially Hidden
          },
          { 
            id: member.id, 
            allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory', 'ManageMessages', 'ManageChannels'] 
          },
          { 
            id: this.client.user.id, 
            allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] 
          }
        ]
      });

      await PersonalChannel.create({
        userId: member.id,
        channelId: channel.id
      });

      // IMPORTANT: Send a message MENTIONING the user so the channel pops up for them!
      await channel.send(`🏠 Welcome <@${member.id}> to your new room! Your room is currently **Private**.\nUse \`eb room help\` to see how to invite friends or make it public.`);

      return { success: true, channel };
    } catch (err) {
      logger.error("Create error:", err.message);
      return { success: false, message: "Error creating channel." };
    }
  }
}

module.exports = BaseManager;