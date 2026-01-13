import { sequelize } from '../config/database.js';

async function addSignatureToApprovalsTable() {
  try {
    // Check if the column already exists
    const table = await sequelize.queryInterface.describeTable('approvals');
    
    if (table.signature) {
      console.log('signature column already exists in approvals table');
      return;
    }

    // Add the column
    await sequelize.queryInterface.addColumn('approvals', 'signature', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
      comment: 'Base64 encoded signature image of the approver'
    });

    console.log('✓ Successfully added signature column to approvals table');
  } catch (error) {
    console.error('Error adding signature column:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addSignatureToApprovalsTable();
