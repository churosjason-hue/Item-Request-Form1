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
      'it_manager_approved',
      'it_manager_declined',
      'service_desk_processing',
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
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
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
Request.prototype.canBeEditedBy = function(user) {
  // Requestor can edit draft or returned requests
  if (this.status === 'draft' || this.status === 'returned') {
    return this.requestor_id === user.id;
  }
  
  // Admins can always edit
  if (user.role === 'super_administrator') {
    return true;
  }
  
  return false;
};

Request.prototype.canBeApprovedBy = function(user) {
  switch (this.status) {
    case 'submitted':
      return user.canApproveForDepartment(this.department_id);
    case 'department_approved':
      return user.canApproveAsITManager();
    default:
      return false;
  }
};

Request.prototype.canBeProcessedBy = function(user) {
  return (this.status === 'it_manager_approved' || this.status === 'service_desk_processing') && user.canProcessRequests();
};

Request.prototype.getNextStatus = function(action, userRole) {
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
    }
  };

  return statusMap[this.status]?.[action] || this.status;
};

export default Request;
