import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApprovalMatrix = sequelize.define('ApprovalMatrix', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    form_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Type of form this rule applies to (e.g., item_request, vehicle_request)'
    },
    department_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'departments',
            key: 'id',
            onDelete: 'CASCADE'
        },
        comment: 'The specific department this rule applies to'
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'The workflow role this rule fulfills (e.g., department_approver)'
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
            onDelete: 'CASCADE'
        },
        comment: 'The specific user who serves as the approver'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Toggle whether this mapping is currently active'
    }
}, {
    tableName: 'approval_matrices',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['form_type', 'department_id', 'role'],
            name: 'unique_approval_matrix_rule'
        }
    ]
});

export default ApprovalMatrix;
