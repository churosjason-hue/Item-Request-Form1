import { sequelize } from './config/database.js';

(async () => {
    try {
        await sequelize.query(`ALTER TABLE "service_vehicle_requests" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;`);
        console.log("Successfully added column cancellation_reason.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
