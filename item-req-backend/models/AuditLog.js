import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Can be null for system actions or failed logins where user not found
        references: {
            model: 'users',
            key: 'id'
        }
    },
    actor_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Snapshot of user name at time of action'
    },
    action: {
        type: DataTypes.ENUM(
            'CREATE',
            'UPDATE',
            'DELETE',
            'LOGIN',
            'LOGOUT',
            'APPROVE',
            'DECLINE',
            'RETURN',
            'SUBMIT',
            'CANCEL'
        ),
        allowNull: false
    },
    entity_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Name of the table/entity affected (e.g. Request, User, Workflow)'
    },
    entity_id: {
        type: DataTypes.STRING, // String to support diverse IDs if needed
        allowNull: true
    },
    details: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Stores changes (old value, new value) or other metadata'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // Audit logs are immutable
});

export default AuditLog;
