import { sequelize } from '../config/database.js';
import { RequestItem } from '../models/index.js';

async function checkItem() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');

        const items = await RequestItem.findAll({
            where: {
                it_remarks: 'Why need 3 keyboards?'
            }
        });

        if (items.length === 0) {
            console.log('❌ No item found with that remark.');
        } else {
            items.forEach(item => {
                console.log(`📦 Item ID: ${item.id}`);
                console.log(`   Particular: ${item.category}`);
                console.log(`   Quantity: ${item.quantity}`);
                console.log(`   Original Qty: ${item.original_quantity}`);
                console.log(`   Approval Status: ${item.approval_status}`);
            });
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkItem();
