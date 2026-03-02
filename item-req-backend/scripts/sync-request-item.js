import { sequelize } from '../config/database.js';
import RequestItem from '../models/RequestItem.js';

async function syncRequestItem() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync only RequestItem model with alter: true
        await RequestItem.sync({ alter: true });
        console.log('RequestItem model synchronized successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
}

syncRequestItem();
