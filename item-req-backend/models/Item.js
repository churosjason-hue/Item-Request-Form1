import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    quantity: { // This represents the "INV#" / Stock Count
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    status: {
        type: DataTypes.ENUM('available', 'low_stock', 'out_of_stock', 'discontinued'),
        allowNull: false,
        defaultValue: 'available'
    },
    min_stock_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pcs'
    }
}, {
    tableName: 'items',
    timestamps: true,
    indexes: [
        {
            fields: ['category']
        },
        {
            fields: ['status']
        }
    ],
    hooks: {
        beforeSave: (item) => {
            // Auto-update status based on quantity
            if (item.quantity === 0) {
                item.status = 'out_of_stock';
            } else if (item.quantity <= item.min_stock_level) {
                item.status = 'low_stock';
            } else {
                item.status = 'available';
            }
        }
    }
});

export default Item;
