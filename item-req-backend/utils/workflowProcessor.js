import { ApprovalWorkflow, WorkflowStep, User, Department, Approval, ApprovalMatrix } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Check if a workflow step is fully completed based on approval logic
 */
export async function checkStepCompletion(step, requestId) {
  if (!step) return true;

  // Default to 'any' if not specified
  const logic = step.approval_logic || 'any';

  if (logic === 'any') {
    return true; // Use existing logic: one approval is enough
  }

  if (logic === 'all') {
    const approvalType = step.step_name.toLowerCase().replace(/ /g, '_');

    // Check if there are any PENDING approvals for this step
    const pendingCount = await Approval.count({
      where: {
        request_id: requestId,
        approval_type: approvalType,
        status: 'pending'
      }
    });

    console.log(`🔍 Checking completion for step '${step.step_name}' (Logic: ALL) - Pending: ${pendingCount}`);

    return pendingCount === 0;
  }

  return true;
}

/**
 * Get the active workflow for a form type
 */
export async function getActiveWorkflow(formType, departmentId = null) {
  try {
    console.log(`🔍 Looking for active workflow for form type: ${formType}, department: ${departmentId}`);

    let workflow = null;

    // First try to find a department-specific workflow
    if (departmentId) {
      workflow = await ApprovalWorkflow.findOne({
        where: {
          form_type: formType,
          department_id: departmentId,
          is_active: true
        },
        order: [['created_at', 'DESC']]
      });
    }

    // If not found, try to find an active AND default global workflow
    if (!workflow) {
      workflow = await ApprovalWorkflow.findOne({
        where: {
          form_type: formType,
          department_id: null,
          is_active: true,
          is_default: true
        },
        order: [['created_at', 'DESC']] // Get the most recent default workflow
      });
    }

    // If still not found, try to find any active workflow globally (fallback)
    if (!workflow) {
      console.log(`⚠️ No active default workflow found, trying any active global workflow...`);
      workflow = await ApprovalWorkflow.findOne({
        where: {
          form_type: formType,
          department_id: null,
          is_active: true
        },
        order: [['created_at', 'DESC']]
      });
    }

    if (!workflow) {
      console.log(`❌ No active workflow found for form type: ${formType}`);
      return null;
    }

    console.log(`✅ Found workflow: ${workflow.name} (ID: ${workflow.id}, Active: ${workflow.is_active}, Default: ${workflow.is_default})`);

    // Load steps separately to avoid association issues
    // Note: is_active column doesn't exist in workflow_steps table, so we don't filter by it
    const steps = await WorkflowStep.findAll({
      where: {
        workflow_id: workflow.id
      },
      order: [['step_order', 'ASC']]
    });

    console.log(`📋 Found ${steps.length} step(s) for workflow ${workflow.id}`);

    // Attach steps to workflow object
    workflow.Steps = steps;

    return workflow;
  } catch (error) {
    console.error('❌ Error getting active workflow:', error);
    return null;
  }
}

/**
 * Get the first pending step for a request
 */
export async function getFirstPendingStep(formType, departmentId = null) {
  const workflow = await getActiveWorkflow(formType, departmentId);

  if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
    return null;
  }

  // Return the first step (lowest step_order)
  return workflow.Steps[0];
}

/**
 * Find ALL valid approvers for a workflow step based on the step configuration
 * Phase 2 Improvement: Group Approvals
 */
export async function findApproversForStep(step, requestData = {}, formType = null) {
  if (!step) {
    console.warn('⚠️ No step provided to findApproversForStep');
    return [];
  }

  try {
    let approvers = [];

    console.log(`🔍 Finding approvers for step: ${step.step_name}`);
    console.log(`   Approver type: ${step.approver_type}`);
    console.log(`   Request data department_id: ${requestData.department_id}`);

    switch (step.approver_type) {
      case 'role':
        // Find user by role
        const whereClause = {
          role: step.approver_role,
          is_active: true
        };

        // If requires_same_department, add department filter
        if (step.requires_same_department && requestData.department_id) {
          whereClause.department_id = requestData.department_id;
          console.log(`   Filtering by same department: ${requestData.department_id}`);
        }

        console.log(`   Searching for users with role: ${step.approver_role}`);
        approvers = await User.findAll({ where: whereClause });
        break;

      case 'user':
        // Find specific users (Multiple or Single)
        const userIds = new Set();

        // Check new array field
        if (step.specific_approver_ids) {
          let ids = step.specific_approver_ids;
          if (typeof ids === 'string') {
            try { ids = JSON.parse(ids); } catch (e) { }
          }
          if (Array.isArray(ids)) {
            ids.forEach(id => userIds.add(id));
          }
        }

        // Check legacy single field
        if (step.approver_user_id) {
          userIds.add(step.approver_user_id);
        }

        if (userIds.size > 0) {
          console.log(`   Searching for specific users: ${Array.from(userIds).join(', ')}`);
          approvers = await User.findAll({
            where: {
              id: Array.from(userIds),
              is_active: true
            }
          });
        } else {
          console.warn(`   ⚠️ No specific users configured for user-type step`);
        }
        break;

      case 'requestor':
        // The Requestor themselves is the approver (e.g. for self-verification)
        if (requestData.requestor_id) {
          console.log(`   Searching for Requestor: ${requestData.requestor_id}`);
          const reqUser = await User.findByPk(requestData.requestor_id);
          if (reqUser) approvers = [reqUser];
        } else {
          console.warn('   ⚠️ Requestor ID missing in requestData (cannot assign to Requestor)');
        }
        break;

      case 'department':
      case 'department_approver':
        // Find department approver from specified department
        let targetDeptId = null;

        if (step.approver_department_id) {
          targetDeptId = step.approver_department_id;
          console.log(`   Searching for department approvers in department ID: ${targetDeptId}`);
        } else if (step.requires_same_department && requestData.department_id) {
          targetDeptId = requestData.department_id;
          console.log(`   No department specified, using requestor's department: ${targetDeptId}`);
        }

        if (targetDeptId) {
          // NEW LOGIC: Check ApprovalMatrix first
          if (formType) {
            const matrixRule = await ApprovalMatrix.findOne({
              where: {
                form_type: formType,
                department_id: targetDeptId,
                role: 'department_approver',
                is_active: true
              }
            });

            if (matrixRule) {
              console.log(`   ✅ Found ApprovalMatrix override for this department/role! User ID: ${matrixRule.user_id}`);
              const matrixUser = await User.findByPk(matrixRule.user_id);
              if (matrixUser && matrixUser.is_active) {
                approvers = [matrixUser];
                break; // Skip the default department approver fallback
              }
            }
          }

          approvers = await User.findAll({
            where: {
              department_id: targetDeptId,
              role: 'department_approver',
              is_active: true
            }
          });
        } else {
          console.warn(`   ⚠️ No department specified and requires_same_department is false`);
        }
        break;

      case 'custom_matrix_role':
        // Find approver from the Approval Matrix based on formType, department, and custom role
        let targetMatrixDeptId = null;

        if (step.approver_department_id) {
          targetMatrixDeptId = step.approver_department_id;
        } else if (step.requires_same_department && requestData.department_id) {
          targetMatrixDeptId = requestData.department_id;
        } else {
          // Fallback to requestor's department
          targetMatrixDeptId = requestData.department_id;
        }

        if (targetMatrixDeptId && step.approver_role) {
          // 1. Check ApprovalMatrix explicitly mapped user
          const matrixRule = await ApprovalMatrix.findOne({
            where: {
              form_type: formType,
              department_id: targetMatrixDeptId,
              role: step.approver_role,
              is_active: true
            }
          });

          if (matrixRule) {
            console.log(`   ✅ Found ApprovalMatrix override for custom role '${step.approver_role}'! User ID: ${matrixRule.user_id}`);
            const matrixUser = await User.findByPk(matrixRule.user_id);
            if (matrixUser && matrixUser.is_active) {
              approvers = [matrixUser];
              break;
            }
          }

          // 2. If no explicit matrix rule, find any users in the department who hold this custom role tag
          console.log(`   ⚠️ No ApprovalMatrix rule found, searching for users with custom_role '${step.approver_role}' in Dept: ${targetMatrixDeptId}`);

          const allDeptUsers = await User.findAll({
            where: {
              department_id: targetMatrixDeptId,
              is_active: true
            }
          });

          approvers = allDeptUsers.filter(u => u.hasCustomRole(step.approver_role));
        } else {
          console.warn(`   ⚠️ Missing department ID or role name for custom_matrix_role lookup`);
        }
        break;

      default:
        console.warn(`⚠️ Unknown approver_type: ${step.approver_type}`);
    }

    if (approvers.length > 0) {
      console.log(`   ✅ Found ${approvers.length} approver(s)`);
    } else {
      console.warn(`   ❌ No approvers found`);
    }

    return approvers;
  } catch (error) {
    console.error('❌ Error finding approvers for step:', error);
    return [];
  }
}

// Support legacy calls temporarily if needed, but best to update all callers
export async function findApproverForStep(step, requestData, formType = null) {
  const list = await findApproversForStep(step, requestData, formType);
  return list[0] || null;
}

/**
 * Get the next step in the workflow after the current step
 */
export async function getNextStep(formType, currentStepOrder, departmentId = null) {
  const workflow = await getActiveWorkflow(formType, departmentId);

  if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
    return null;
  }

  const nextStep = workflow.Steps.find(
    step => step.step_order > currentStepOrder
  );

  return nextStep || null;
}

/**
 * Process workflow on request submission - find first approvers
 * Phase 2 Support: Returns multiple approvers
 */
export async function processWorkflowOnSubmit(formType, requestData) {
  try {
    const firstStep = await getFirstPendingStep(formType, requestData.department_id);

    if (!firstStep) {
      console.warn(`No workflow found for form type: ${formType}. Using fallback logic.`);
      return null;
    }

    const approvers = await findApproversForStep(firstStep, requestData, formType);

    if (!approvers || approvers.length === 0) {
      console.warn(`No approvers found for first step of workflow: ${formType}`);
      return null;
    }

    return {
      step: firstStep,
      approvers: approvers, // Return array
      approver: approvers[0] // Legacy support (first one)
    };
  } catch (error) {
    console.error('Error processing workflow on submit:', error);
    return null;
  }
}

/**
 * Find the current workflow step based on request status and approver
 * Phase 2 Support: Group Approver Check
 */
export async function findCurrentStepForApprover(formType, approver, requestStatus, requestData = {}) {
  try {
    // Immediate short-circuit for final states to prevent looping
    if (['completed', 'declined', 'cancelled', 'pr_approved', 'ready_to_deploy'].includes(requestStatus)) {
      return null;
    }

    // Phase 1 Improvement: Explicit State Tracking
    if (requestData.current_step_id) {
      const step = await WorkflowStep.findByPk(requestData.current_step_id);

      if (step) {
        // Check if the user is in the list of valid approvers for this step
        const stepApprovers = await findApproversForStep(step, requestData, formType);
        const isApprover = stepApprovers.some(a => a.id === approver.id);

        if (isApprover) {
          return step;
        }
      }
    }

    // Fallback: Legacy "Guessing" Logic
    const workflow = await getActiveWorkflow(formType, requestData.department_id);

    if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
      return null;
    }

    // Helper to check if approver is in the list for a step
    const checkStep = async (step) => {
      const stepApprovers = await findApproversForStep(step, requestData, formType);
      return stepApprovers.some(a => a.id === approver.id);
    };

    if (requestStatus === 'submitted' || requestStatus === 'returned') {
      // If submitted, we look for the FIRST step
      const firstStep = workflow.Steps[0];
      if (firstStep && await checkStep(firstStep)) {
        return firstStep;
      }
    } else {
      // Find the step whose status_on_approval matches the current status
      for (let i = 0; i < workflow.Steps.length; i++) {
        const step = workflow.Steps[i];
        if (step.status_on_approval === requestStatus) {
          // If current status is 'department_approved', it means we passed step 1.
          // We should be on step 2.
          if (i + 1 < workflow.Steps.length) {
            const currentStep = workflow.Steps[i + 1];
            if (await checkStep(currentStep)) {
              return currentStep;
            }
          }
        }
      }

      const statusBasedStepIndex = workflow.Steps.findIndex(step => step.status_on_approval === requestStatus);

      for (const step of workflow.Steps) {
        if (statusBasedStepIndex >= 0 && step.step_order <= workflow.Steps[statusBasedStepIndex].step_order) {
          continue;
        }

        if (await checkStep(step)) {
          return step;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding current step for approver:', error);
    return null;
  }
}

/**
 * Process workflow on approval - find next approvers
 * Phase 2 Support: Returns multiple approvers
 */
export async function processWorkflowOnApproval(formType, requestData, currentStepOrder) {
  try {
    const nextStep = await getNextStep(formType, currentStepOrder, requestData.department_id);

    if (!nextStep) {
      return null;
    }

    const approvers = await findApproversForStep(nextStep, requestData, formType);

    if (!approvers || approvers.length === 0) {
      console.warn(`No approvers found for next step (order: ${nextStep.step_order}) of workflow: ${formType}`);
      return null;
    }

    return {
      step: nextStep,
      approvers: approvers, // Return array
      approver: approvers[0] // Legacy support
    };
  } catch (error) {
    console.error('Error processing workflow on approval:', error);
    return null;
  }
}
