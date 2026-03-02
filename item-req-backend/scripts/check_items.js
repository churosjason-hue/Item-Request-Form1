import { sequelize } from '../config/database.js';
import { Item } from '../models/index.js';

async function checkItems() {
    try {
        const items = await Item.findAll();
        console.log(`Found ${items.length} items.`);
        items.forEach(i => console.log(`- [${i.id}] ${i.name} (${i.category}) Qty: ${i.quantity}`));
    } catch (error) {
        console.error('Error fetching items:', error);
    } finally {
        await sequelize.close();
    }
}

checkItems();
