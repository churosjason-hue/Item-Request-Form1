import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Request = sequelize.define('Request', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  request_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  requestor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  user_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Name of the actual user who will use the equipment'
  },
  user_position: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Position of the actual user'
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  date_required: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  current_step_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'workflow_steps',
      key: 'id'
    },
    comment: 'ID of the current workflow step'
  },
  pending_approver_ids: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: true,
    defaultValue: [],
    comment: 'Array of user IDs who can currently approve this request'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for equipment request'
  },
  status: {
    type: DataTypes.ENUM(
      'draft',
      'submitted',
      'department_approved',
      'department_declined',
      'checked_endorsed',
      'endorser_declined',
      'it_manager_approved',
      'it_manager_declined',
      'service_desk_processing',
      'pr_approved',
      'ready_to_deploy',
      'completed',
      'cancelled',
      'returned'
    ),
    allowNull: false,
    defaultValue: 'draft'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium'
  },
  total_estimated_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Array of attachment file paths and metadata'
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional comments or notes'
  },
  requestor_signature: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Base64 encoded signature image or file path'
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verifier_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID of the assigned verifier (e.g. by IT Manager)'
  },
  verifier_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for assigning the verifier'
  },
  verification_status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'none',
    comment: 'Status of verification (none, pending, verified, declined)'
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when verification action was taken'
  },
  verifier_comments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Comments from the verifier'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sd_started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when the request first entered service_desk_processing status'
  }
}, {
  tableName: 'requests',
  indexes: [
    {
      fields: ['request_number']
    },
    {
      fields: ['requestor_id']
    },
    {
      fields: ['department_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['submitted_at']
    }
  ]
});

// Instance methods
Request.prototype.canBeEditedBy = function (user) {
  // Requestor can edit draft or returned requests
  if (this.status === 'draft' || this.status === 'returned') {
    return this.requestor_id === user.id;
  }

  // Admins can always edit
  if (user.role === 'super_administrator') {
    return true;
  }

  // IT Manager can edit during their approval phase
  if (user.role === 'it_manager' && this.status === 'department_approved') {
    return true;
  }

  return false;
};

Request.prototype.canBeApprovedBy = function (user) {
  switch (this.status) {
    case 'submitted':
      return user.canApproveForDepartment(this.department_id);
    case 'department_approved':
    case 'endorser_approved':
    case 'checked_endorsed':
      return user.canApproveAsITManager();
    default:
      return false;
  }
};

Request.prototype.canBeProcessedBy = function (user) {
  return (this.status === 'it_manager_approved' || this.status === 'service_desk_processing' || this.status === 'pr_approved' || this.status === 'ready_to_deploy') && user.canProcessRequests();
};

Request.prototype.getNextStatus = function (action, userRole) {
  const statusMap = {
    'submitted': {
      'approve': 'department_approved',
      'decline': 'department_declined',
      'return': 'returned'
    },
    'department_approved': {
      'approve': 'it_manager_approved',
      'decline': 'it_manager_declined',
      'return': 'returned'
    },
    'it_manager_approved': {
      'process': 'service_desk_processing',
      'complete': 'completed'
    },
    'service_desk_processing': {
      'complete': 'completed'
    },
    'pr_approved': {
      'approve': 'completed',
      'complete': 'completed'
    },
    'ready_to_deploy': {
      'approve': 'completed',
      'complete': 'completed'
    }
  };

  return statusMap[this.status]?.[action] || this.status;
};

export default Request;
