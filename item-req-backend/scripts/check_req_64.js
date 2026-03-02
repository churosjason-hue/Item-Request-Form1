import { sequelize } from '../config/database.js';
import Request from '../models/Request.js';

async function checkRequest64() {
    try {
        const request = await Request.findOne({ where: { request_number: 'REQ-20260202-354180' } });
        if (!request) {
            console.log('Request not found');
        } else {
            console.log(`ID: ${request.id}, Status: ${request.status}`);
            console.log(`Pending Approvers: ${JSON.stringify(request.pending_approver_ids)}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkRequest64();
