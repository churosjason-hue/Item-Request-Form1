import { sequelize } from './config/database.js';

(async () => {
    try {
        const [results] = await sequelize.query(`SELECT request_id, reference_code, verifier_id, verifier_reason FROM "service_vehicle_requests" WHERE reference_code = 'SVR-20260225-249408';`);
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
