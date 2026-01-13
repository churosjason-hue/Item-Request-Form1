import { sequelize, Request, ServiceVehicleRequest, Approval } from '../models/index.js';

async function syncAllModels() {
  try {
    console.log('Starting database synchronization...\n');
    
    // Check and sync Request model
    console.log('Checking Request table...');
    const requestTable = await sequelize.queryInterface.describeTable('requests');
    console.log('Request table columns:', Object.keys(requestTable));
    
    // Sync Request with alter
    await Request.sync({ alter: true });
    console.log('✓ Request model synced\n');
    
    // Check and sync ServiceVehicleRequest model
    console.log('Checking ServiceVehicleRequest table...');
    const vehicleTable = await sequelize.queryInterface.describeTable('service_vehicle_requests');
    console.log('ServiceVehicleRequest table columns:', Object.keys(vehicleTable));
    
    // Sync ServiceVehicleRequest with alter
    await ServiceVehicleRequest.sync({ alter: true });
    console.log('✓ ServiceVehicleRequest model synced\n');
    
    // Check and sync Approval model
    console.log('Checking Approval table...');
    const approvalTable = await sequelize.queryInterface.describeTable('approvals');
    console.log('Approval table columns:', Object.keys(approvalTable));
    
    // Sync Approval with alter
    await Approval.sync({ alter: true });
    console.log('✓ Approval model synced\n');
    
    console.log('✅ Database synchronization completed successfully');
  } catch (error) {
    console.error('❌ Error during synchronization:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

syncAllModels();
