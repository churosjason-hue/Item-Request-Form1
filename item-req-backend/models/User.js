import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM(
      'requestor',
      'department_approver', 
      'it_manager',
      'service_desk',
      'super_administrator'
    ),
    allowNull: false,
    defaultValue: 'requestor'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ad_dn: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Active Directory Distinguished Name'
  },
  ad_groups: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Active Directory group memberships'
  },
  last_ad_sync: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time user data was synced from AD'
  }
}, {
  tableName: 'users',
  indexes: [
    {
      fields: ['username']
    },
    {
      fields: ['email']
    },
    {
      fields: ['department_id']
    },
    {
      fields: ['role']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Instance methods
User.prototype.getFullName = function() {
  return `${this.first_name} ${this.last_name}`;
};

User.prototype.canApproveForDepartment = function(departmentId) {
  return this.role === 'department_approver' && this.department_id === departmentId;
};

User.prototype.canApproveAsITManager = function() {
  return this.role === 'it_manager' || this.role === 'super_administrator';
};

User.prototype.canProcessRequests = function() {
  return ['service_desk', 'it_manager', 'super_administrator'].includes(this.role);
};

User.prototype.isAdmin = function() {
  return this.role === 'super_administrator';
};

export default User;
