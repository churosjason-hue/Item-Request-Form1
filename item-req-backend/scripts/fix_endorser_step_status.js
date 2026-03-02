import { sequelize } from '../config/database.js';
import WorkflowStep from '../models/WorkflowStep.js';
import { Op } from 'sequelize';

async function fixEndorserStep() {
    try {
        const endorserStep = await WorkflowStep.findOne({
            where: {
                step_name: { [Op.iLike]: '%Endorser%' }
            }
        });

        if (!endorserStep) {
            console.log('Endorser step not found.');
            return;
        }

        console.log(`Current status_on_approval: ${endorserStep.status_on_approval}`);

        // Update to correct status
        await endorserStep.update({
            status_on_approval: 'checked_endorsed'
        });

        console.log(`Updated status_on_approval to: 'checked_endorsed'`);

    } catch (error) {
        console.error('Error updating workflow step:', error);
    } finally {
        process.exit();
    }
}

fixEndorserStep();
