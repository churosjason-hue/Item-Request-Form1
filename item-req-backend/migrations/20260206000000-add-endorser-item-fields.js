import { sequelize } from '../config/database.js';

async function addEndorserFields() {
    try {
        console.log('📝 Adding endorser fields to request_items table...');

        // Add endorser_status enum type
        await sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE enum_request_items_endorser_status AS ENUM ('pending', 'in_stock', 'needs_pr');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Add endorser_status column (snake_case for database)
        await sequelize.query(`
            ALTER TABLE request_items 
            ADD COLUMN IF NOT EXISTS endorser_status enum_request_items_endorser_status DEFAULT 'pending';
        `);

        // Add endorser_remarks column (snake_case for database)
        await sequelize.query(`
            ALTER TABLE request_items 
            ADD COLUMN IF NOT EXISTS endorser_remarks TEXT;
        `);

        console.log('✅ Successfully added endorser_status and endorser_remarks columns');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding endorser fields:', error);
        process.exit(1);
    }
}

addEndorserFields();
