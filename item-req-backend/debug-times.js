import { Sequelize, QueryTypes } from 'sequelize';

const sequelize = new Sequelize('item_requisition_db', 'postgres', 'test', {
    host: 'localhost',
    dialect: 'postgres',
    logging: false,
});

async function run() {
    try {
        const results = await sequelize.query(
            `SELECT request_id, travel_date_from, travel_date_to, pick_up_time, drop_off_time 
       FROM service_vehicle_requests 
       WHERE request_number IN ('SVRF2026-0193', 'SVRF2026-0194') OR request_id IN (193, 194)`,
            { type: QueryTypes.SELECT }
        );
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        const seq2 = new Sequelize('item_requisition_db', 'postgres', '1234', {
            host: 'localhost',
            dialect: 'postgres',
            logging: false,
        });
        const results = await seq2.query(
            `SELECT request_id, travel_date_from, travel_date_to, pick_up_time, drop_off_time 
       FROM service_vehicle_requests 
       WHERE request_number IN ('SVRF2026-0193', 'SVRF2026-0194') OR request_id IN (193, 194)`,
            { type: QueryTypes.SELECT }
        );
        console.log(JSON.stringify(results, null, 2));
    }
    process.exit(0);
}

run();
