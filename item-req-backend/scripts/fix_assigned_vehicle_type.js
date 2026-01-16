import { sequelize } from '../models/index.js';

async function fixAssignedVehicleColumn() {
    const transaction = await sequelize.transaction();
    try {
        console.log('Starting SAFER fix (handling large numbers)...');

        // 1. Add new column
        console.log('Adding assigned_vehicle_new...');
        await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      ADD COLUMN assigned_vehicle_new INTEGER;
    `, { transaction });

        // 2. data copy (only valid integers that fit in 4 bytes)
        // Max integer is 2,147,483,647 (10 digits). We'll trust up to 9 digits strictly, or check logic.
        console.log('Copying valid data...');
        await sequelize.query(`
      UPDATE service_vehicle_requests 
      SET assigned_vehicle_new = CAST(assigned_vehicle AS INTEGER) 
      WHERE assigned_vehicle ~ '^[0-9]+$' 
      AND LENGTH(assigned_vehicle) <= 9;
    `, { transaction });

        // 3. Drop old column
        console.log('Dropping old column...');
        await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      DROP COLUMN assigned_vehicle CASCADE;
    `, { transaction });

        // 4. Rename
        console.log('Renaming new column...');
        await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      RENAME COLUMN assigned_vehicle_new TO assigned_vehicle;
    `, { transaction });

        await transaction.commit();
        console.log('SUCCESS');

    } catch (error) {
        await transaction.rollback();
        console.error('FAILED:', error);
    } finally {
        await sequelize.close();
    }
}

fixAssignedVehicleColumn();
