import { sequelize } from '../config/database.js';

async function checkColumn() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');

        const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'request_items' AND column_name = 'original_quantity';
    `);

        if (results.length > 0) {
            console.log('✅ Column original_quantity EXISTS.');
        } else {
            console.log('❌ Column original_quantity DOES NOT EXIST.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkColumn();
