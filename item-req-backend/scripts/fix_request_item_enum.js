import { sequelize } from '../config/database.js';

async function migrate() {
    try {
        console.log('🔄 Migrating RequestItem category to STRING...');

        // Postgres requires explicit casting when converting ENUM to TEXT/VARCHAR
        await sequelize.query(`
      ALTER TABLE "request_items" 
      ALTER COLUMN "category" TYPE VARCHAR(255) 
      USING "category"::VARCHAR;
    `);

        console.log('✅ Column type changed to VARCHAR.');

        // Drop the old enum type if it exists to be clean
        await sequelize.query(`DROP TYPE IF EXISTS "enum_request_items_category";`);
        console.log('✅ Enum type dropped.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
