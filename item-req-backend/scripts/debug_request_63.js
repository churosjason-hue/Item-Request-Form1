import { sequelize } from '../config/database.js';
import Request from '../models/Request.js';

async function checkRequest() {
    try {
        const request = await Request.findByPk(63);
        if (!request) {
            console.log('Request 63 not found');
        } else {
            console.log('STATUS:', request.status);
            console.log('PENDING:', JSON.stringify(request.pending_approver_ids));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkRequest();
