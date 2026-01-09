import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const RequestItem = sequelize.define('RequestItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'requests',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  category: {
    type: DataTypes.ENUM(
      'laptop',
      'desktop',
      'monitor',
      'keyboard',
      'mouse',
      'ups',
      'printer',
      'software',
      'other_accessory',
      'other_equipment'
    ),
    allowNull: false
  },
  item_description: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 500]
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 999
    }
  },
  inventory_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Inventory or asset tag number if applicable'
  },
  proposed_specs: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Proposed specifications for the equipment'
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Purpose or intended use of the equipment'
  },
  estimated_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  vendor_info: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Preferred vendor or supplier information'
  },
  is_replacement: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is a replacement for existing equipment'
  },
  replaced_item_info: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Information about the item being replaced'
  },
  urgency_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason if item is urgently needed'
  }
}, {
  tableName: 'request_items',
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['inventory_number']
    }
  ]
});

// Instance methods
RequestItem.prototype.getTotalCost = function() {
  return this.estimated_cost ? (this.estimated_cost * this.quantity) : 0;
};

RequestItem.prototype.getCategoryDisplayName = function() {
  const categoryNames = {
    'laptop': 'Laptop',
    'desktop': 'Desktop Computer Set',
    'monitor': 'Monitor',
    'keyboard': 'Keyboard',
    'mouse': 'Mouse',
    'ups': 'UPS',
    'printer': 'Printer',
    'software': 'Software/System',
    'other_accessory': 'Other Accessory',
    'other_equipment': 'Other Equipment'
  };
  
  return categoryNames[this.category] || this.category;
};

export default RequestItem;
