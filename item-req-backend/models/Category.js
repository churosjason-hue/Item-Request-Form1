import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    min_stock_level: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        allowNull: false
    },
    track_stock: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    purposes: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: false
    },
    stock_updated_at: {
        type: DataTypes.DATEONLY,
        allowNull: true
    }
}, {
    tableName: 'categories',
    timestamps: true
});

export default Category;
