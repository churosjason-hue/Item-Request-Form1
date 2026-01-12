import { ApprovalWorkflow } from '../models/index.js';

/**
 * Get the active workflow for a form type
 */
export async function getActiveWorkflow(formType) {
  try {
    const workflow = await ApprovalWorkflow.findOne({
      where: {
        form_type: formType,
        is_active: true
      }
    });

    return workflow;
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return null;
  }
}

/**
 * Get the current step number for a request based on its status
 */
export function getCurrentStepNumber(status, formType) {
  // Map statuses to step numbers
  // This is a simplified mapping - you may need to adjust based on your status naming
  const statusMap = {
    'submitted': 1,
    'department_approved': 2,
    'it_manager_approved': 3,
    'service_desk_processing': 4,
    'completed': -1 // Completed means all steps are done
  };

  return statusMap[status] || 0;
}

/**
 * Check if a user can approve at a specific step
 */
export function canUserApproveStep(user, step, request) {
  // Check approver type
  if (step.approver_type === 'role') {
    // Check if user has the required role
    if (user.role !== step.approver_role) {
      return false;
    }

    // Check scope
    if (step.scope === 'same_department') {
      return user.department_id === request.department_id;
    } else if (step.scope === 'cross_department') {
      return user.department_id !== request.department_id;
    } else if (step.scope === 'any') {
      return true;
    }
  } else if (step.approver_type === 'user') {
    // Check if user is the specific approver
    return user.id === step.approver_user_id;
  } else if (step.approver_type === 'department') {
    // Check if user belongs to the approver department
    return user.department_id === step.approver_department_id;
  }

  return false;
}

/**
 * Get the next status after approval at a step
 */
export function getNextStatus(workflow, currentStepNumber) {
  if (!workflow || !workflow.steps) {
    return null;
  }

  const steps = workflow.steps.sort((a, b) => a.step_number - b.step_number);
  
  // If this is the last step, return completed
  if (currentStepNumber >= steps.length) {
    return 'completed';
  }

  // Otherwise, return the next step's status name
  // This is a simplified version - you may need to adjust based on your status naming convention
  const nextStep = steps[currentStepNumber];
  
  if (nextStep.approver_type === 'role') {
    if (nextStep.approver_role === 'department_approver') {
      return 'department_approved';
    } else if (nextStep.approver_role === 'it_manager') {
      return 'it_manager_approved';
    } else if (nextStep.approver_role === 'service_desk') {
      return 'service_desk_processing';
    }
  }

  // Default: return a generic status
  return `step_${currentStepNumber + 1}_approved`;
}

/**
 * Get the final status after all approvals
 */
export function getFinalStatus(workflow) {
  return 'completed';
}
