import { sequelize } from '../models/index.js';

async function checkSchema() {
    try {
        const [results, metadata] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_vehicle_requests' 
      AND column_name = 'assigned_vehicle';
    `);

        console.log('Column Schema:', JSON.stringify(results, null, 2));

        if (results.length > 0 && results[0].data_type === 'character varying') {
            console.log('Column is VARCHAR. Checking content...');
            // Use request_id instead of id
            const [rows] = await sequelize.query(`
            SELECT request_id, assigned_vehicle FROM service_vehicle_requests 
            WHERE assigned_vehicle IS NOT NULL AND assigned_vehicle != ''
        `);
            console.log('Non-empty assigned_vehicle values:', JSON.stringify(rows, null, 2));
        } else {
            console.log('Column is NOT VARCHAR or not found.');
        }

    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await sequelize.close();
    }
}

checkSchema();
