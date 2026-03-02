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
    type: DataTypes.STRING,
    allowNull: false
  },
  item_description: {
    type: DataTypes.STRING(500),
    allowNull: true
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
  },
  is_returned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the item has been returned to inventory'
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when the item was returned to inventory'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: true,
    defaultValue: 'medium'
  },
  date_required: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional comments specific to this item'
  },
  it_remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Remarks or notes from IT Manager'
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    allowNull: false,
    comment: 'Department line-item verification status'
  },
  endorser_status: {
    type: DataTypes.ENUM('pending', 'in_stock', 'needs_pr'),
    defaultValue: 'pending',
    allowNull: true,
    comment: 'Endorser recommendation: in_stock or needs_pr (informational only)'
  },
  endorser_remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Remarks from endorser about item availability or PR requirements'
  },
  original_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Original quantity requested before modification by approvers'
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
RequestItem.prototype.getTotalCost = function () {
  return this.estimated_cost ? (this.estimated_cost * this.quantity) : 0;
};

RequestItem.prototype.getCategoryDisplayName = function () {
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
