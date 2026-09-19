const mongoose = require('mongoose');
const User = require('../database/schemas/User');
const config = require('../config');

async function migrateExistingUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Starting user migration...');

    const result = await User.updateMany(
      {
        $or: [
          { lastMessageDate: { $exists: false } },
          { currentRoles: { $exists: false } },
          { inactivityExempt: { $exists: false } },
        ],
      },
      {
        $set: {
          lastMessageDate: new Date(),
          currentRoles: [],
          rolesLastUpdated: new Date(),
          protectedRoles: [],
          inactivityExempt: false,
          summonerManualOverride: false,
          summonerAwardedDate: null,
          summonerAwardedInPeriod: null,
        },
      }
    );

    console.log(`Migration completed. ${result.modifiedCount} users updated.`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateExistingUsers();