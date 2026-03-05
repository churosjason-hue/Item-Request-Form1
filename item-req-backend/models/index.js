import { sequelize } from '../config/database.js';
import User from './User.js';
import Department from './Department.js';
import Request from './Request.js';
import RequestItem from './RequestItem.js';
import Approval from './Approval.js';
import ServiceVehicleRequest from './ServiceVehicleRequest.js';
import ApprovalWorkflow from './ApprovalWorkflow.js';
import WorkflowStep from './WorkflowStep.js';
import ApprovalMatrix from './ApprovalMatrix.js';
import VehicleApproval from './VehicleApproval.js';
import Vehicle from './Vehicle.js';
import Driver from './Driver.js';
import AuditLog from './AuditLog.js';
import Item from './Item.js';
import Category from './Category.js';
import SystemSetting from './SystemSetting.js';
import ApiKey from './ApiKey.js';

// Define associations

// ApiKey - User associations
ApiKey.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
User.hasMany(ApiKey, { foreignKey: 'created_by', as: 'ApiKeys' });

// AuditLog - User associations
AuditLog.belongsTo(User, {
  foreignKey: 'actor_id',
  as: 'Actor'
});

User.hasMany(AuditLog, {
  foreignKey: 'actor_id',
  as: 'AuditLogs'
});

// User - Department associations
User.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(User, {
  foreignKey: 'department_id',
  as: 'Users'
});


// Request - User associations
Request.belongsTo(User, {
  foreignKey: 'requestor_id',
  as: 'Requestor'
});

User.hasMany(Request, {
  foreignKey: 'requestor_id',
  as: 'Requests'
});

// Request - Verifier associations
Request.belongsTo(User, {
  foreignKey: 'verifier_id',
  as: 'Verifier'
});

User.hasMany(Request, {
  foreignKey: 'verifier_id',
  as: 'VerifiedRequests'
});

// Request - Department associations
Request.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(Request, {
  foreignKey: 'department_id',
  as: 'Requests'
});

// Request - RequestItem associations
Request.hasMany(RequestItem, {
  foreignKey: 'request_id',
  as: 'Items',
  onDelete: 'CASCADE'
});

RequestItem.belongsTo(Request, {
  foreignKey: 'request_id',
  as: 'Request'
});

// Request - Approval associations
Request.hasMany(Approval, {
  foreignKey: 'request_id',
  as: 'Approvals',
  onDelete: 'CASCADE'
});

Approval.belongsTo(Request, {
  foreignKey: 'request_id',
  as: 'Request'
});

// Approval - User associations
Approval.belongsTo(User, {
  foreignKey: 'approver_id',
  as: 'Approver'
});

User.hasMany(Approval, {
  foreignKey: 'approver_id',
  as: 'Approvals'
});

// ServiceVehicleRequest - User associations (requested_by)
ServiceVehicleRequest.belongsTo(User, {
  foreignKey: 'requested_by',
  as: 'RequestedByUser'
});

User.hasMany(ServiceVehicleRequest, {
  foreignKey: 'requested_by',
  as: 'ServiceVehicleRequests'
});

// ServiceVehicleRequest - User associations (assigned_driver)
// Removed: assigned_driver is now a string field, not a foreign key

// ServiceVehicleRequest - User associations (Verification)
ServiceVehicleRequest.belongsTo(User, {
  foreignKey: 'verifier_id',
  as: 'Verifier'
});

User.hasMany(ServiceVehicleRequest, {
  foreignKey: 'verifier_id',
  as: 'RequestsToVerify'
});

// ServiceVehicleRequest - Department associations
ServiceVehicleRequest.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(ServiceVehicleRequest, {
  foreignKey: 'department_id',
  as: 'ServiceVehicleRequests'
});

// ServiceVehicleRequest - Vehicle associations
ServiceVehicleRequest.belongsTo(Vehicle, {
  foreignKey: 'assigned_vehicle',
  as: 'AssignedVehicle'
});

// ApprovalWorkflow - User associations
ApprovalWorkflow.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'Creator'
});

ApprovalWorkflow.belongsTo(User, {
  foreignKey: 'updated_by',
  as: 'Updater'
});

User.hasMany(ApprovalWorkflow, {
  foreignKey: 'created_by',
  as: 'CreatedWorkflows'
});

// ApprovalWorkflow - Department associations
ApprovalWorkflow.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(ApprovalWorkflow, {
  foreignKey: 'department_id',
  as: 'ApprovalWorkflows'
});

// ApprovalWorkflow - WorkflowStep associations
ApprovalWorkflow.hasMany(WorkflowStep, {
  foreignKey: 'workflow_id',
  as: 'Steps',
  onDelete: 'CASCADE'
});

WorkflowStep.belongsTo(ApprovalWorkflow, {
  foreignKey: 'workflow_id',
  as: 'Workflow'
});

// WorkflowStep - User associations (for specific user approvers)
WorkflowStep.belongsTo(User, {
  foreignKey: 'approver_user_id',
  as: 'ApproverUser'
});

// WorkflowStep - Department associations
WorkflowStep.belongsTo(Department, {
  foreignKey: 'approver_department_id',
  as: 'ApproverDepartment'
});

// ApprovalMatrix associations
ApprovalMatrix.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(ApprovalMatrix, {
  foreignKey: 'department_id',
  as: 'ApprovalMatrices'
});

ApprovalMatrix.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'User'
});

User.hasMany(ApprovalMatrix, {
  foreignKey: 'user_id',
  as: 'ApprovalMatrices'
});

// ServiceVehicleRequest - VehicleApproval associations
ServiceVehicleRequest.hasMany(VehicleApproval, {
  foreignKey: 'vehicle_request_id',
  as: 'Approvals',
  onDelete: 'CASCADE'
});

VehicleApproval.belongsTo(ServiceVehicleRequest, {
  foreignKey: 'vehicle_request_id',
  as: 'VehicleRequest'
});

// VehicleApproval - User associations
VehicleApproval.belongsTo(User, {
  foreignKey: 'approver_id',
  as: 'Approver'
});

User.hasMany(VehicleApproval, {
  foreignKey: 'approver_id',
  as: 'VehicleApprovals'
});

// VehicleApproval - WorkflowStep associations
VehicleApproval.belongsTo(WorkflowStep, {
  foreignKey: 'workflow_step_id',
  as: 'WorkflowStep'
});

WorkflowStep.hasMany(VehicleApproval, {
  foreignKey: 'workflow_step_id',
  as: 'Approvals'
});

// Export all models
export {
  sequelize,
  User,
  Department,
  Request,
  RequestItem,
  Approval,
  ServiceVehicleRequest,
  ApprovalWorkflow,
  WorkflowStep,
  ApprovalMatrix,
  VehicleApproval,
  Vehicle,
  Driver,
  AuditLog,
  Item,
  Category,
  SystemSetting,
  ApiKey
};

// Sync database function
export async function syncDatabase(force = false) {
  try {
    await sequelize.sync({ force, alter: !force });
    console.log('✅ Database synchronized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
}

// Initialize default data
export async function initializeDefaultData() {
  try {
    // Create default departments if they don't exist
    const [itDept] = await Department.findOrCreate({
      where: { name: 'Information Technology' },
      defaults: {
        description: 'IT Department',
        is_active: true
      }
    });

    const [hrDept] = await Department.findOrCreate({
      where: { name: 'Human Resources' },
      defaults: {
        description: 'HR Department',
        is_active: true
      }
    });

    const [financeDept] = await Department.findOrCreate({
      where: { name: 'Finance' },
      defaults: {
        description: 'Finance Department',
        is_active: true
      }
    });

    console.log('✅ Default departments initialized');

    // Initialize default categories
    await initializeDefaultCategories();

    return { itDept, hrDept, financeDept };
  } catch (error) {
    console.error('❌ Failed to initialize default data:', error);
    throw error;
  }
}



// Initialize default categories
export async function initializeDefaultCategories() {
  try {
    const count = await Category.count();
    if (count === 0) {
      console.log('📦 Seeding default categories...');
      const categories = [
        { name: 'Laptop', description: 'Portable computers', track_stock: true },
        { name: 'Desktop', description: 'Desktop computers', track_stock: true },
        { name: 'Monitor', description: 'Display monitors', track_stock: true },
        { name: 'Keyboard', description: 'Keyboards', track_stock: true },
        { name: 'Mouse', description: 'Mice', track_stock: true },
        { name: 'UPS', description: 'Uninterruptible Power Supply', track_stock: true },
        { name: 'Printer', description: 'Printers and scanners', track_stock: true },
        { name: 'Software', description: 'Software and licenses', track_stock: false },
        { name: 'Other Accessory', description: 'Miscellaneous accessories', track_stock: false },
        { name: 'Other Equipment', description: 'Miscellaneous equipment', track_stock: false }
      ];

      await Category.bulkCreate(categories);
      console.log('✅ Default categories seeded');
    }
  } catch (error) {
    console.error('❌ Failed to seed default categories:', error);
  }
}
