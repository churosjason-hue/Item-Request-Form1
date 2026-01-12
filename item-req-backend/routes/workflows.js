import express from 'express';
import { body, validationResult } from 'express-validator';
import { ApprovalWorkflow, User } from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all workflows
router.get('/', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const workflows = await ApprovalWorkflow.findAll({
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
        }
      ],
      order: [['form_type', 'ASC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message
    });
  }
});

// Get workflow by form type
router.get('/form/:formType', authenticateToken, async (req, res) => {
  try {
    const { formType } = req.params;
    
    const workflow = await ApprovalWorkflow.findOne({
      where: {
        form_type: formType,
        is_active: true
      },
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'No active workflow found for this form type'
      });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow',
      error: error.message
    });
  }
});

// Get single workflow by ID
router.get('/:id', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const workflow = await ApprovalWorkflow.findByPk(id, {
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
        }
      ]
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow',
      error: error.message
    });
  }
});

// Create workflow
router.post(
  '/',
  authenticateToken,
  requireRole(['super_administrator']),
  [
    body('form_type').notEmpty().withMessage('Form type is required'),
    body('workflow_name').notEmpty().withMessage('Workflow name is required'),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('steps').custom((steps) => {
      if (steps.length === 0) {
        throw new Error('At least one approval step is required');
      }
      return true;
    }),
    body('steps.*.step_number').isInt({ min: 1 }).withMessage('Step number must be a positive integer'),
    body('steps.*.approver_role').notEmpty().withMessage('Approver role is required for each step'),
    body('steps.*.approver_type').isIn(['role', 'user', 'department']).withMessage('Approver type must be role, user, or department'),
    body('steps.*.scope').optional().isIn(['same_department', 'cross_department', 'any']).withMessage('Scope must be same_department, cross_department, or any')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { form_type, workflow_name, steps, description, is_active } = req.body;

      // Check if there's already an active workflow for this form type
      if (is_active !== false) {
        const existingActive = await ApprovalWorkflow.findOne({
          where: {
            form_type,
            is_active: true
          }
        });

        if (existingActive) {
          return res.status(400).json({
            success: false,
            message: 'An active workflow already exists for this form type. Please deactivate it first.'
          });
        }
      }

      // Validate step numbers are sequential
      const stepNumbers = steps.map(s => s.step_number).sort((a, b) => a - b);
      for (let i = 0; i < stepNumbers.length; i++) {
        if (stepNumbers[i] !== i + 1) {
          return res.status(400).json({
            success: false,
            message: 'Step numbers must be sequential starting from 1'
          });
        }
      }

      const workflow = await ApprovalWorkflow.create({
        form_type,
        workflow_name,
        steps,
        description: description || null,
        is_active: is_active !== false,
        created_by: req.user.id,
        updated_by: req.user.id
      });

      await workflow.reload({
        include: [
          {
            model: User,
            as: 'Creator',
            attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Workflow created successfully',
        workflow
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create workflow',
        error: error.message
      });
    }
  }
);

// Update workflow
router.put(
  '/:id',
  authenticateToken,
  requireRole(['super_administrator']),
  [
    body('workflow_name').optional().notEmpty().withMessage('Workflow name cannot be empty'),
    body('steps').optional().isArray().withMessage('Steps must be an array'),
    body('steps.*.step_number').optional().isInt({ min: 1 }).withMessage('Step number must be a positive integer'),
    body('steps.*.approver_role').optional().notEmpty().withMessage('Approver role is required for each step'),
    body('steps.*.approver_type').optional().isIn(['role', 'user', 'department']).withMessage('Approver type must be role, user, or department')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { workflow_name, steps, description, is_active } = req.body;

      const workflow = await ApprovalWorkflow.findByPk(id);
      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
      }

      // If activating, check if another active workflow exists for this form type
      if (is_active === true && !workflow.is_active) {
        const existingActive = await ApprovalWorkflow.findOne({
          where: {
            form_type: workflow.form_type,
            is_active: true,
            id: { [Op.ne]: id }
          }
        });

        if (existingActive) {
          return res.status(400).json({
            success: false,
            message: 'An active workflow already exists for this form type. Please deactivate it first.'
          });
        }
      }

      // Validate steps if provided
      if (steps) {
        if (steps.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one approval step is required'
          });
        }

        const stepNumbers = steps.map(s => s.step_number).sort((a, b) => a - b);
        for (let i = 0; i < stepNumbers.length; i++) {
          if (stepNumbers[i] !== i + 1) {
            return res.status(400).json({
              success: false,
              message: 'Step numbers must be sequential starting from 1'
            });
          }
        }
      }

      const updateData = {
        updated_by: req.user.id
      };

      if (workflow_name !== undefined) updateData.workflow_name = workflow_name;
      if (steps !== undefined) updateData.steps = steps;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      await workflow.update(updateData);

      await workflow.reload({
        include: [
          {
            model: User,
            as: 'Creator',
            attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
          },
          {
            model: User,
            as: 'Updater',
            attributes: ['id', 'firstName', 'lastName', 'fullName', 'email']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Workflow updated successfully',
        workflow
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update workflow',
        error: error.message
      });
    }
  }
);

// Delete workflow
router.delete('/:id', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await ApprovalWorkflow.findByPk(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    await workflow.destroy();

    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow',
      error: error.message
    });
  }
});

export default router;
