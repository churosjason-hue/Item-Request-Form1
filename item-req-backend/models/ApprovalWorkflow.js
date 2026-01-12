import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApprovalWorkflow = sequelize.define('ApprovalWorkflow', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  form_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of form: item_request, vehicle_request, etc.',
    unique: 'unique_form_type'
  },
  workflow_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Name of the workflow configuration'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether this workflow is currently active'
  },
  steps: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of approval steps with approver roles and conditions',
    defaultValue: []
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of the workflow'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who created this workflow'
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who last updated this workflow'
  }
}, {
  tableName: 'approval_workflows',
  timestamps: true,
  underscored: true,
  freezeTableName: true
});

export default ApprovalWorkflow;
