import { sequelize } from '../config/database.js';

async function addAttachmentsToServiceVehicleRequests() {
  try {
    // Check if the column already exists
    const table = await sequelize.queryInterface.describeTable('service_vehicle_requests');
    
    if (table.attachments) {
      console.log('attachments column already exists in service_vehicle_requests table');
      return;
    }

    // Add the column
    await sequelize.queryInterface.addColumn('service_vehicle_requests', 'attachments', {
      type: sequelize.Sequelize.JSONB,
      allowNull: true,
      comment: 'Array of attachment file paths and metadata'
    });

    console.log('✓ Successfully added attachments column to service_vehicle_requests table');
  } catch (error) {
    console.error('Error adding attachments column:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addAttachmentsToServiceVehicleRequests();
