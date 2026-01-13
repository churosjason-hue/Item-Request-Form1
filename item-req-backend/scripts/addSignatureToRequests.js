import { sequelize } from '../config/database.js';

async function addSignatureColumn() {
  try {
    // Check if the column already exists
    const table = await sequelize.queryInterface.describeTable('requests');
    
    if (table.requestor_signature) {
      console.log('requestor_signature column already exists in requests table');
      return;
    }

    // Add the column
    await sequelize.queryInterface.addColumn('requests', 'requestor_signature', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
      comment: 'Base64 encoded signature image or file path'
    });

    console.log('✓ Successfully added requestor_signature column to requests table');
  } catch (error) {
    console.error('Error adding requestor_signature column:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addSignatureColumn();
