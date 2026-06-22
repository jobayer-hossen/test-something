// src/events/ready.js
const Logger = require('../logger');
const logger = new Logger('Ready');

module.exports = {
    name: 'clientReady', // ← CHANGE THIS
    once: true,
    execute(client) {
        console.log('=== READY EVENT FIRED ==='); // ← ADD THIS FIRST LINE
        logger.info(`✅ Bot logged in as ${client.user.tag}`);
        logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);

        try {
            client.user.setPresence({
                activities: [{ name: 'EPIC-BOTS | Vibing 🎮', type: 0 }],
                status: 'online',
            });
            logger.info('✅ Presence set successfully!');

            setInterval(() => {
                const activities = [
                    { name: 'EPIC-BOTS | Vibing 🎮', type: 0 },
                    { name: '🌧️ Coin Rains in EPIC-BOTS', type: 3 },
                    { name: '🎁 Lootbox Events in EPIC-BOTS', type: 3 },
                    { name: '🤝 Invite your friends to EPIC-BOTS', type: 3 },
                ];
                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                client.user.setPresence({
                    activities: [randomActivity],
                    status: 'online',
                });
            }, 20000);

            logger.info('✅ Status rotation started!');

            if (client.features?.amanTrumpetReminder) {
                try {
                    client.features.amanTrumpetReminder.initialize();
                    logger.info('🎺 Aman Trumpet Reminder initialized');
                } catch (error) {
                    logger.error('Error initializing Aman Trumpet Reminder:', error.message);
                }
            }
        } catch (error) {
            logger.error('Error in ready event:', error.message);
            console.error(error.stack);
        }
    },
};