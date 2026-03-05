import ldapService from '../config/ldap.js';
import { User, Department } from '../models/index.js';
import { Op } from 'sequelize';

class UserSyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncStats = {
      usersCreated: 0,
      usersUpdated: 0,
      departmentsCreated: 0,
      departmentsUpdated: 0,
      errors: []
    };
  }

  async syncAllUsers() {
    if (this.syncInProgress) {
      throw new Error('User sync is already in progress');
    }

    this.syncInProgress = true;
    this.syncStats = {
      usersCreated: 0,
      usersUpdated: 0,
      departmentsCreated: 0,
      departmentsUpdated: 0,
      errors: []
    };

    try {
      console.log('🔄 Starting AD user synchronization...');

      // Get all users from AD
      const adUsers = await ldapService.getAllUsers();
      console.log(`📊 Found ${adUsers.length} users in Active Directory`);

      // Sync users
      await this.syncUsers(adUsers);

      // Mark inactive users who are no longer in AD
      await this.markInactiveUsers(adUsers);

      this.lastSyncTime = new Date();
      console.log('✅ AD user synchronization completed successfully');

      return {
        success: true,
        syncTime: this.lastSyncTime,
        stats: this.syncStats
      };

    } catch (error) {
      console.error('❌ AD user synchronization failed:', error);
      this.syncStats.errors.push(error.message);

      return {
        success: false,
        error: error.message,
        stats: this.syncStats
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncUsers(adUsers) {
    for (const adUser of adUsers) {
      try {
        // Skip users without required fields (need at least username OR email)
        if (!adUser.username && !adUser.email) {
          console.log(`⚠️ Skipping user with missing username AND email: ${JSON.stringify(adUser)}`);
          continue;
        }

        // Skip users with invalid email addresses (empty strings or invalid format)
        if (adUser.email && (adUser.email.trim() === '' || !adUser.email.includes('@'))) {
          console.log(`⚠️ Skipping user ${adUser.username} with invalid email: "${adUser.email}"`);
          continue;
        }

        // Skip users without email if they also don't have a valid username
        if (!adUser.email && (!adUser.username || adUser.username.trim() === '')) {
          console.log(`⚠️ Skipping user with no valid email or username: ${JSON.stringify(adUser)}`);
          continue;
        }

        // Find department using Department attribute only (not OU)
        // Department linking is bypassed - departments will be explicitly assigned by an administrator.

        // Use default role for new users (roles are managed manually in database)

        // Generate username from email if username is empty
        const username = adUser.username || (adUser.email ? adUser.email.split('@')[0] : '');

        // Generate a placeholder email if none exists (for users with only username)
        const email = adUser.email || `${username}@placeholder.local`;

        // Build search criteria (only include non-empty values)
        const searchCriteria = [];
        if (adUser.username) searchCriteria.push({ username: adUser.username });
        if (adUser.email) searchCriteria.push({ email: adUser.email });

        const [user, created] = await User.findOrCreate({
          where: {
            [Op.or]: searchCriteria
          },
          defaults: {
            username: username,
            email: email,
            first_name: adUser.firstName || '',
            last_name: adUser.lastName || '',
            title: adUser.title,
            phone: adUser.phone,
            role: 'requestor', // Default role - manually assigned by admin
            ad_groups: adUser.groups,
            last_ad_sync: new Date(),
            is_active: true
          }
        });

        if (created) {
          this.syncStats.usersCreated++;
          console.log(`➕ Created user: ${username} (${adUser.email})`);
        } else {
          // Update existing user (preserve existing role)
          await user.update({
            username: username,
            email: email,
            first_name: adUser.firstName || user.first_name,
            last_name: adUser.lastName || user.last_name,
            title: adUser.title || user.title,
            phone: adUser.phone || user.phone,
            // role: keep existing role - don't update from AD
            ad_groups: adUser.groups,
            last_ad_sync: new Date(),
            is_active: true
          });
          this.syncStats.usersUpdated++;
          console.log(`🔄 Updated user: ${username} (${email})`);
        }
      } catch (error) {
        console.error(`❌ Error syncing user ${adUser.username}:`, error.message);
        this.syncStats.errors.push(`User ${adUser.username}: ${error.message}`);
      }
    }
  }

  async markInactiveUsers(adUsers) {
    try {
      const adUsernames = adUsers.map(user => user.username).filter(Boolean);

      if (adUsernames.length === 0) {
        return;
      }

      // Find users in database that are not in AD anymore
      const inactiveUsers = await User.findAll({
        where: {
          username: {
            [Op.notIn]: adUsernames
          },
          is_active: true
        }
      });

      for (const user of inactiveUsers) {
        await user.update({
          is_active: false,
          last_ad_sync: new Date()
        });
        console.log(`🔒 Marked user as inactive: ${user.username}`);
      }

      if (inactiveUsers.length > 0) {
        console.log(`🔒 Marked ${inactiveUsers.length} users as inactive`);
      }
    } catch (error) {
      console.error('❌ Error marking inactive users:', error.message);
      this.syncStats.errors.push(`Mark inactive users: ${error.message}`);
    }
  }

  async syncSingleUser(username) {
    try {
      console.log(`🔄 Syncing single user: ${username}`);

      const adUser = await ldapService.getUserDetails(username);

      if (!adUser) {
        throw new Error('User not found in Active Directory');
      }

      // Department linking is bypassed - departments will be explicitly assigned by an administrator.

      // Use default role for new users (roles are managed manually in database)

      const [user, created] = await User.findOrCreate({
        where: {
          [Op.or]: [
            { username: adUser.username },
            { email: adUser.email }
          ]
        },
        defaults: {
          username: adUser.username,
          email: adUser.email,
          first_name: adUser.firstName || '',
          last_name: adUser.lastName || '',
          title: adUser.title,
          phone: adUser.phone,
          role: 'requestor', // Default role - manually assigned by admin
          ad_dn: adUser.dn,
          ad_groups: adUser.groups,
          last_ad_sync: new Date(),
          is_active: true
        }
      });

      if (!created) {
        await user.update({
          email: adUser.email,
          first_name: adUser.firstName || user.first_name,
          last_name: adUser.lastName || user.last_name,
          title: adUser.title || user.title,
          phone: adUser.phone || user.phone,
          // role: keep existing role - don't update from AD
          ad_dn: adUser.dn,
          ad_groups: adUser.groups,
          last_ad_sync: new Date(),
          is_active: true
        });
      }

      console.log(`✅ Successfully synced user: ${username}`);
      return { success: true, user, created };

    } catch (error) {
      console.error(`❌ Error syncing user ${username}:`, error.message);
      throw error;
    }
  }

  getSyncStatus() {
    return {
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      stats: this.syncStats
    };
  }

  // Schedule automatic sync (to be called from a cron job or scheduler)
  async scheduleSync(intervalHours = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const runSync = async () => {
      try {
        await this.syncAllUsers();
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    };

    // Run initial sync
    setTimeout(runSync, 5000); // 5 seconds after startup

    // Schedule recurring sync
    setInterval(runSync, intervalMs);

    console.log(`📅 Scheduled AD sync every ${intervalHours} hours`);
  }
}

// Export singleton instance
const userSyncService = new UserSyncService();
export default userSyncService;
