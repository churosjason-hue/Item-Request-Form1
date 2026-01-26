import { sequelize } from '../config/database.js';
import Department from '../models/Department.js';
import { Op } from 'sequelize';

async function addVehicleStewardFlag() {
    try {
        console.log('🔄 Starting migration: add is_vehicle_steward flag...');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('departments');

        // 1. Add column if it doesn't exist
        if (!tableInfo.is_vehicle_steward) {
            console.log('➕ Adding is_vehicle_steward column to departments table...');
            await queryInterface.addColumn('departments', 'is_vehicle_steward', {
                type: 'BOOLEAN',
                defaultValue: false,
                allowNull: false
            });
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Column is_vehicle_steward already exists.');
        }

        // 2. Set flag for ODHC department
        console.log('🔍 Searching for ODHC department...');
        const odhcDepartment = await Department.findOne({
            where: {
                name: { [Op.iLike]: '%ODHC%' }
            }
        });

        if (odhcDepartment) {
            console.log(`📝 Found ODHC Department: ${odhcDepartment.name} (ID: ${odhcDepartment.id})`);
            odhcDepartment.is_vehicle_steward = true;
            await odhcDepartment.save();
            console.log('✅ Set is_vehicle_steward = true for ODHC department.');
        } else {
            console.warn('⚠️ ODHC department not found! Please manually set the flag for the correct department.');
        }

        console.log('✨ Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

addVehicleStewardFlag();
