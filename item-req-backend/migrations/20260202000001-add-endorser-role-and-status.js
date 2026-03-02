const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add 'endorser' to User role enum
        await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'endorser';
    `);

        // Add 'checked_endorsed' and 'endorser_declined' to Request status enum
        await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Requests_status" ADD VALUE IF NOT EXISTS 'checked_endorsed';
    `);

        await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Requests_status" ADD VALUE IF NOT EXISTS 'endorser_declined';
    `);

        // Add 'endorser_approval' to Approval approval_type enum
        await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Approvals_approval_type" ADD VALUE IF NOT EXISTS 'endorser_approval';
    `);

        console.log('✅ Added endorser role and statuses to enums');
    },

    down: async (queryInterface, Sequelize) => {
        // Note: PostgreSQL does not support removing enum values directly
        // You would need to recreate the enum type to remove values
        console.log('⚠️ Rollback not supported for enum values in PostgreSQL');
        console.log('⚠️ Manual intervention required to remove enum values');
    }
};
