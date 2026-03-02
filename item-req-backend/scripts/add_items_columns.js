
import { sequelize } from '../config/database.js';

async function addColumns() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('request_items');

        if (!tableInfo.priority) {
            console.log('Adding priority column...');
            await queryInterface.addColumn('request_items', 'priority', {
                type: 'ENUM("low", "medium", "high", "urgent")',
                allowNull: true,
                defaultValue: 'medium'
            });
        }

        if (!tableInfo.date_required) {
            console.log('Adding date_required column...');
            await queryInterface.addColumn('request_items', 'date_required', {
                type: 'DATE', // DATEONLY maps to DATE in some postgres drivers, usually DATE is safe
                allowNull: true
            });
        }

        if (!tableInfo.comments) {
            console.log('Adding comments column...');
            await queryInterface.addColumn('request_items', 'comments', {
                type: 'TEXT',
                allowNull: true
            });
        }

        console.log('Columns added successfully.');
    } catch (error) {
        console.error('Error adding columns:', error);
    } finally {
        await sequelize.close();
    }
}

addColumns();
