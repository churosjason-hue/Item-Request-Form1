import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addCurrentStepColumns() {
    try {
        console.log('Checking and adding current_step_id column to request tables...');

        // 1. Check requests table
        const checkRequestsColumn = await sequelize.query(
            `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'requests' AND column_name = 'current_step_id'`,
            { type: QueryTypes.SELECT }
        );

        if (checkRequestsColumn.length === 0) {
            console.log('Adding current_step_id column to requests table...');
            await sequelize.query(
                `ALTER TABLE requests ADD COLUMN current_step_id INTEGER REFERENCES workflow_steps(id)`,
                { type: QueryTypes.RAW }
            );
            console.log('✅ current_step_id column added to requests');
        } else {
            console.log('✅ current_step_id column already exists in requests');
        }

        // 2. Check service_vehicle_requests table
        const checkVehicleRequestsColumn = await sequelize.query(
            `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'service_vehicle_requests' AND column_name = 'current_step_id'`,
            { type: QueryTypes.SELECT }
        );

        if (checkVehicleRequestsColumn.length === 0) {
            console.log('Adding current_step_id column to service_vehicle_requests table...');
            await sequelize.query(
                `ALTER TABLE service_vehicle_requests ADD COLUMN current_step_id INTEGER REFERENCES workflow_steps(id)`,
                { type: QueryTypes.RAW }
            );
            console.log('✅ current_step_id column added to service_vehicle_requests');
        } else {
            console.log('✅ current_step_id column already exists in service_vehicle_requests');
        }

        console.log('\n✅ All columns checked/added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding columns:', error);
        process.exit(1);
    }
}

// Run the migration
addCurrentStepColumns();
