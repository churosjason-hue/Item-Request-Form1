import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [2, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  ad_dn: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Active Directory Distinguished Name for OU'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  last_ad_sync: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time department was synced from AD'
  },
  is_vehicle_steward: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Flag to indicate if this department manages service vehicles (e.g., ODHC)'
  }
}, {
  tableName: 'departments',
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['parent_id']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Self-referencing association for department hierarchy
Department.hasMany(Department, {
  as: 'SubDepartments',
  foreignKey: 'parent_id'
});

Department.belongsTo(Department, {
  as: 'ParentDepartment',
  foreignKey: 'parent_id'
});

export default Department;
