import { sequelize } from '../config/database.js';
import Request from '../models/Request.js';
import User from '../models/User.js';

async function repairRequest64() {
    try {
        const request = await Request.findOne({ where: { request_number: 'REQ-20260202-354180' } });
        if (!request) {
            console.log('Request not found');
            return;
        }

        const itManager = await User.findOne({ where: { role: 'it_manager' } });
        if (!itManager) {
            console.log('IT Manager not found');
            return;
        }

        console.log(`Repairing Request ${request.id}...`);

        await request.update({
            status: 'checked_endorsed',
            pending_approver_ids: [itManager.id]
        });

        console.log(`Updated status to 'checked_endorsed' and pending_approver_ids to [${itManager.id}]`);

    } catch (error) {
        console.error('Error repairing request:', error);
    } finally {
        process.exit();
    }
}

repairRequest64();
