import { sequelize } from '../config/database.js';
import WorkflowStep from '../models/WorkflowStep.js';

async function checkWorkflowSteps() {
    try {
        const steps = await WorkflowStep.findAll({
            order: [['step_order', 'ASC']]
        });

        console.log('Workflow Steps:');
        steps.forEach(step => {
            console.log(JSON.stringify({
                id: step.id,
                name: step.step_name,
                order: step.step_order,
                statusOnApproval: step.status_on_approval
            }));
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkWorkflowSteps();
