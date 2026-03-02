import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SystemSetting = sequelize.define('SystemSetting', {
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT, // Using TEXT to store JSON strings or simple values
        allowNull: true
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'system_settings',
    timestamps: true
});

export default SystemSetting;
