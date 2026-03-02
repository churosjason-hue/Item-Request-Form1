import { sequelize } from '../config/database.js';
import { Category } from '../models/index.js';
import { initializeDefaultCategories } from '../models/index.js';

async function fixSchema() {
    try {
        console.log('🔄 Force syncing Category table...');
        // This drops the table and recreates it with new columns
        await Category.sync({ force: true });
        console.log('✅ Category table re-created with new schema.');

        console.log('📦 Re-seeding default categories...');
        await initializeDefaultCategories();
        console.log('✅ Seeding complete.');

    } catch (error) {
        console.error('❌ Error fixing schema:', error);
    } finally {
        await sequelize.close();
    }
}

fixSchema();
