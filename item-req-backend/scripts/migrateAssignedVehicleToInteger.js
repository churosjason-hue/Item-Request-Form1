import { sequelize, ServiceVehicleRequest } from '../models/index.js';
import { QueryTypes } from 'sequelize';

async function migrateAssignedVehicleColumn() {
  try {
    console.log('Starting migration of assigned_vehicle column...');
    
    // Step 1: Create a new temporary column as INTEGER
    console.log('Creating temporary column...');
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      ADD COLUMN assigned_vehicle_temp INTEGER
    `);
    
    // Step 2: Copy data, converting non-null values to integers
    console.log('Copying data from old column...');
    await sequelize.query(`
      UPDATE service_vehicle_requests 
      SET assigned_vehicle_temp = CAST(assigned_vehicle AS INTEGER)
      WHERE assigned_vehicle IS NOT NULL 
      AND assigned_vehicle ~ '^[0-9]+$'
    `);
    
    // Step 3: Drop the old column
    console.log('Dropping old column...');
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      DROP COLUMN assigned_vehicle
    `);
    
    // Step 4: Rename the temporary column to the original name
    console.log('Renaming temporary column...');
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests 
      RENAME COLUMN assigned_vehicle_temp TO assigned_vehicle
    `);
    
    // Step 5: Add constraints
    console.log('Adding constraints...');
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests
      ADD CONSTRAINT fk_assigned_vehicle 
      FOREIGN KEY (assigned_vehicle) REFERENCES vehicles(id)
    `);
    
    console.log('✓ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateAssignedVehicleColumn();
