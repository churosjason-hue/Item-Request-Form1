import { sequelize } from '../config/database.js';

async function migrate() {
    try {
        console.log('🔄 Starting migration to change approval_type column to VARCHAR...');

        // Check if we are using Postgres
        const dialect = sequelize.getDialect();
        if (dialect !== 'postgres') {
            console.log('⚠️ This script is intended for Postgres. Skipping.');
            return;
        }

        // 1. Alter the column to VARCHAR/TEXT
        console.log('1. Altering column type to VARCHAR(255)...');
        await sequelize.query(`
      ALTER TABLE "approvals" 
      ALTER COLUMN "approval_type" TYPE VARCHAR(255);
    `);

        // 2. Drop the enum type (it's separate in Postgres)
        // Note: The enum name is usually constructed from table_column or specified in model
        // Default sequelize enum name format: enum_approvals_approval_type
        console.log('2. Dropping old enum type...');
        try {
            await sequelize.query(`
        DROP TYPE IF EXISTS "enum_approvals_approval_type";
      `);
        } catch (e) {
            console.log('⚠️ Could not drop enum type (might not exist or be in use):', e.message);
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
