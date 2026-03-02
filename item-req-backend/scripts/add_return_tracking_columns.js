import { sequelize } from '../config/database.js';

async function migrate() {
    try {
        console.log('🔄 Adding return tracking columns to RequestItem...');

        // Add is_returned column
        await sequelize.query(`
      ALTER TABLE "request_items" 
      ADD COLUMN IF NOT EXISTS "is_returned" BOOLEAN DEFAULT false;
    `);
        console.log('✅ Added "is_returned" column.');

        // Add returned_at column
        await sequelize.query(`
      ALTER TABLE "request_items" 
      ADD COLUMN IF NOT EXISTS "returned_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
        console.log('✅ Added "returned_at" column.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
