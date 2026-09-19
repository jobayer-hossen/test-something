module.exports = {
  name: 'guildMemberUpdate',

  async execute(oldMember, newMember, client) {
    try {
      if (client.features.roleManager) {
        await client.features.roleManager.handleRoleUpdate(oldMember, newMember);
      }
    } catch (error) {
      console.error('Error in guildMemberUpdate:', error);
    }
  },
};