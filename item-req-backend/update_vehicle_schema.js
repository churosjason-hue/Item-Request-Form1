import { sequelize } from './config/database.js';
import Vehicle from './models/Vehicle.js';

async function syncVehicles() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // We will use raw queries to alter the table safely without dropping data

        // Add new column
        try {
            await sequelize.query('ALTER TABLE vehicles ADD COLUMN coding_sched VARCHAR(50) NULL;');
            console.log('Added coding_sched column.');
        } catch (e) {
            console.log('Column coding_sched already exists or error:', e.message);
        }

        // Drop old column
        try {
            await sequelize.query('ALTER TABLE vehicles DROP COLUMN year;');
            console.log('Dropped year column.');
        } catch (e) {
            console.log('Column year already dropped or error:', e.message);
        }

        console.log('Vehicle schema update complete!');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        process.exit();
    }
}

syncVehicles();
