import { sequelize } from '../config/database.js';
import WorkflowStep from '../models/WorkflowStep.js';
import ApprovalWorkflow from '../models/ApprovalWorkflow.js';
import fs from 'fs';

async function listWorkflow() {
    try {
        const workflow = await ApprovalWorkflow.findOne({
            where: { form_type: 'item_request', is_active: true }
        });

        if (!workflow) {
            console.log('No active item_request workflow found.');
            return;
        }

        let output = `Workflow ID: ${workflow.id}\n`;

        const steps = await WorkflowStep.findAll({
            where: { workflow_id: workflow.id },
            order: [['step_order', 'ASC']]
        });

        steps.forEach(step => {
            output += JSON.stringify({
                o: step.step_order,
                n: step.step_name,
                onApp: step.status_on_approval,
                onComp: step.status_on_completion
            }) + '\n';
        });

        fs.writeFileSync('workflow_output.txt', output);
        console.log('Done writing to workflow_output.txt');

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

listWorkflow();
