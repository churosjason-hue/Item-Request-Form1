
import { sequelize } from '../config/database.js';
import { Category } from '../models/index.js';

const updateSchema = async () => {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        console.log('Syncing Category model...');
        // syncing with alter: true should add the missing column
        await Category.sync({ alter: true });

        console.log('Category schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error updating schema:', error);
        process.exit(1);
    }
};

updateSchema();
