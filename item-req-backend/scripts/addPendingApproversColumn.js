import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: console.log,
    }
);

async function addPendingApproversColumn() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        const queryInterface = sequelize.getQueryInterface();

        // 1. Add pending_approver_ids to requests table
        try {
            await queryInterface.addColumn('requests', 'pending_approver_ids', {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
                defaultValue: []
            });
            console.log('✅ Added pending_approver_ids to requests table');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️ pending_approver_ids column already exists in requests table');
            } else {
                throw error;
            }
        }

        // 2. Add pending_approver_ids to service_vehicle_requests table
        try {
            await queryInterface.addColumn('service_vehicle_requests', 'pending_approver_ids', {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
                defaultValue: []
            });
            console.log('✅ Added pending_approver_ids to service_vehicle_requests table');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️ pending_approver_ids column already exists in service_vehicle_requests table');
            } else {
                throw error;
            }
        }

        console.log('🎉 Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

addPendingApproversColumn();
