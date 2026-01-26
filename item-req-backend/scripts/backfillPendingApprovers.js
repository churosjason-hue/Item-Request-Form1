import { Sequelize, Op } from 'sequelize';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ServiceVehicleRequest from '../models/ServiceVehicleRequest.js';
import Request from '../models/Request.js';
import { findApproversForStep, findCurrentStepForApprover } from '../utils/workflowProcessor.js';
import { WorkflowStep, User, Department, ApprovalWorkflow } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: false, // Reduce noise
    }
);

async function backfillPendingApprovers() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        console.log('🔄 Starting backfill for Service Vehicle Requests...');

        // Fetch all active service vehicle requests
        const vehicleRequests = await ServiceVehicleRequest.findAll({
            where: {
                status: {
                    [Op.notIn]: ['completed', 'declined', 'draft', 'cancelled']
                }
            }
        });

        console.log(`📋 Found ${vehicleRequests.length} active service vehicle requests`);

        let updatedCount = 0;

        for (const request of vehicleRequests) {
            try {
                console.log(`Processing Request #${request.id} (Status: ${request.status})...`);

                // Find current step
                // We simulate "approver" as null just to find the step by status or explicit ID
                const currentStep = await findCurrentStepForApprover('vehicle_request', { id: -1 }, request.status, {
                    department_id: request.department_id,
                    current_step_id: request.current_step_id
                });

                if (currentStep) {
                    console.log(`   Detailed Step: ${currentStep.step_name}`);

                    // Find approvers for this step
                    const approvers = await findApproversForStep(currentStep, {
                        department_id: request.department_id
                    });

                    if (approvers && approvers.length > 0) {
                        const approverIds = approvers.map(u => u.id);
                        console.log(`   Found ${approverIds.length} approvers: [${approverIds.join(', ')}]`);

                        request.pending_approver_ids = approverIds;
                        // Also update current_step_id if missing
                        if (!request.current_step_id) {
                            request.current_step_id = currentStep.id;
                        }

                        await request.save();
                        updatedCount++;
                    } else {
                        console.warn(`   ⚠️ No approvers found for step ${currentStep.step_name}`);
                    }
                } else {
                    console.warn(`   ⚠️ Could not determine current step for status ${request.status}`);
                }
            } catch (err) {
                console.error(`   ❌ Error processing request #${request.id}:`, err.message);
            }
        }

        console.log(`✅ Completed backfill. Updated ${updatedCount}/${vehicleRequests.length} requests.`);

        // Note: Can extend to 'Request' model if needed, but we focused on ServiceVehicleRequest for Phase 2/3

    } catch (error) {
        console.error('❌ Backfill failed:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the function
backfillPendingApprovers();
