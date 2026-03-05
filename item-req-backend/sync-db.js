import { sequelize } from './config/database.js';

async function fixDb() {
    try {
        console.log('Adding custom_roles column to users...');
        await sequelize.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_roles" JSONB DEFAULT '[]'::jsonb;`);
        console.log('Adding department_id to approval_workflows...');
        await sequelize.query(`ALTER TABLE "approval_workflows" ADD COLUMN IF NOT EXISTS "department_id" INTEGER;`);
        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixDb();
