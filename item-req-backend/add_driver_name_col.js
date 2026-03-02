import { sequelize } from './config/database.js';

async function execute() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Add driver_name column to service_vehicle_requests table
        await sequelize.query('ALTER TABLE service_vehicle_requests ADD COLUMN driver_name VARCHAR(200);');
        console.log('Successfully added driver_name column.');

    } catch (error) {
        console.error('Unable to connect to the database or alter table:', error);
    } finally {
        process.exit();
    }
}

execute();
