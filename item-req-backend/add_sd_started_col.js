import { sequelize } from './config/database.js';

(async () => {
    try {
        await sequelize.query(`
            ALTER TABLE "requests"
            ADD COLUMN IF NOT EXISTS "sd_started_at" TIMESTAMP WITH TIME ZONE;
        `);
        console.log("✅ Successfully added column sd_started_at to requests table.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to add column:", e.message);
        process.exit(1);
    }
})();
