import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApiKey = sequelize.define('ApiKey', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Human-readable label for this API key (e.g. "OEE Dashboard Integration")'
    },
    key_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 hash of the raw API key — never store plain text'
    },
    key_prefix: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'First ~16 chars of the raw key for display purposes (e.g. prism_live_a1b2c3)'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    last_used_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Optional expiry date. NULL means the key never expires.'
    }
}, {
    tableName: 'api_keys',
    indexes: [
        { fields: ['key_hash'], unique: true },
        { fields: ['is_active'] },
        { fields: ['created_by'] }
    ]
});

export default ApiKey;
