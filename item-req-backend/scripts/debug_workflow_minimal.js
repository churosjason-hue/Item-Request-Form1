import { sequelize } from '../config/database.js';
import WorkflowStep from '../models/WorkflowStep.js';
import { Op } from 'sequelize';

async function checkSteps() {
    try {
        const steps = await WorkflowStep.findAll({
            where: {
                step_name: { [Op.iLike]: '%Endorser%' }
            }
        });

        steps.forEach(step => {
            console.log(`STEP: ${step.step_name} | STATUS_ON_APPROVAL: ${step.status_on_approval} | NEXT_STEP_ID: ${step.next_step_id}`);
        });

        const itSteps = await WorkflowStep.findAll({
            where: {
                step_name: { [Op.iLike]: '%IT Manager%' }
            }
        });

        itSteps.forEach(step => {
            console.log(`STEP: ${step.step_name} | STATUS_ON_APPROVAL: ${step.status_on_approval}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkSteps();
