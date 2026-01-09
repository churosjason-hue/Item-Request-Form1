import { sequelize } from '../config/database.js';
import { Request, RequestItem, Approval, Department, User } from '../models/index.js';
import { QueryTypes } from 'sequelize';

/**
 * Truncate all database tables except users
 * This will:
 * - Delete all approvals
 * - Delete all request items
 * - Delete all requests
 * - Delete all departments (after clearing user references)
 * - Keep all users intact
 */
async function truncateDatabase() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🗑️  Starting database truncation (keeping users)...');
    
    // Step 1: Delete approvals (they reference requests)
    console.log('Deleting approvals...');
    const approvalsDeleted = await Approval.destroy({
      where: {},
      transaction,
      force: true
    });
    console.log(`✅ Deleted ${approvalsDeleted} approvals`);
    
    // Step 2: Delete request items (they reference requests)
    console.log('Deleting request items...');
    const itemsDeleted = await RequestItem.destroy({
      where: {},
      transaction,
      force: true
    });
    console.log(`✅ Deleted ${itemsDeleted} request items`);
    
    // Step 3: Delete requests
    console.log('Deleting requests...');
    const requestsDeleted = await Request.destroy({
      where: {},
      transaction,
      force: true
    });
    console.log(`✅ Deleted ${requestsDeleted} requests`);
    
    // Step 4: Clear department_id from users before deleting departments
    console.log('Clearing department references from users...');
    await User.update(
      { department_id: null },
      { where: {}, transaction }
    );
    console.log('✅ Cleared department references from users');
    
    // Step 5: Delete departments
    console.log('Deleting departments...');
    const departmentsDeleted = await Department.destroy({
      where: {},
      transaction,
      force: true
    });
    console.log(`✅ Deleted ${departmentsDeleted} departments`);
    
    // Commit transaction
    await transaction.commit();
    
    console.log('\n✅ Database truncation completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Approvals deleted: ${approvalsDeleted}`);
    console.log(`   - Request items deleted: ${itemsDeleted}`);
    console.log(`   - Requests deleted: ${requestsDeleted}`);
    console.log(`   - Departments deleted: ${departmentsDeleted}`);
    console.log('   - Users: PRESERVED');
    
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error truncating database:', error);
    process.exit(1);
  }
}

// Run the truncation
truncateDatabase();

