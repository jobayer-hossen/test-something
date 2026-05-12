const Logger = require('../logger');

const logger = new Logger('Ready');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    logger.info(`✅ Bot logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);

    // Set bot status
    client.user.setActivity('Epic RPG Game', { type: 'PLAYING' });
  },
};