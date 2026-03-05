import { ApprovalMatrix, Department, User } from '../models/index.js';
import { Op } from 'sequelize';

// Get all matrix routing rules
export const getApprovalMatrices = async (req, res) => {
    try {
        const rules = await ApprovalMatrix.findAll({
            include: [
                {
                    model: Department,
                    as: 'Department',
                    attributes: ['id', 'name']
                },
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ],
            order: [['form_type', 'ASC'], ['department_id', 'ASC']]
        });
        res.json({ rules });
    } catch (error) {
        console.error('Error fetching approval matrix rules:', error);
        res.status(500).json({ message: 'Error fetching rules', error: error.message });
    }
};

// Get specific matrix rule by id
export const getApprovalMatrixById = async (req, res) => {
    try {
        const rule = await ApprovalMatrix.findByPk(req.params.id, {
            include: [
                {
                    model: Department,
                    as: 'Department',
                    attributes: ['id', 'name']
                },
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ]
        });

        if (!rule) {
            return res.status(404).json({ message: 'Routing rule not found' });
        }

        res.json({ rule });
    } catch (error) {
        console.error('Error fetching approval matrix rule:', error);
        res.status(500).json({ message: 'Error fetching rule', error: error.message });
    }
};

// Create a new matrix routing rule
export const createApprovalMatrix = async (req, res) => {
    try {
        const { form_type, department_id, role, user_id, is_active } = req.body;

        // Validate — department_id is optional (null = global fallback)
        if (!form_type || !role || !user_id) {
            return res.status(400).json({ message: 'form_type, role, and user_id are required' });
        }

        // Check if duplicate rule exists (same user in same role for same department)
        const existingRule = await ApprovalMatrix.findOne({
            where: {
                form_type,
                department_id: department_id ?? null,
                role,
                user_id
            }
        });

        if (existingRule) {
            return res.status(400).json({
                message: `This user is already assigned to this Form, Department, and Role combination.`
            });
        }

        const rule = await ApprovalMatrix.create({
            form_type,
            department_id,
            role,
            user_id,
            is_active: is_active !== undefined ? is_active : true
        });

        // Fetch the complete rule with associations
        const completeRule = await ApprovalMatrix.findByPk(rule.id, {
            include: [
                { model: Department, as: 'Department', attributes: ['id', 'name'] },
                { model: User, as: 'User', attributes: ['id', 'first_name', 'last_name', 'email'] }
            ]
        });

        res.status(201).json({ message: 'Routing rule created successfully', rule: completeRule });
    } catch (error) {
        console.error('Error creating approval matrix rule:', error);
        res.status(500).json({ message: 'Error creating rule', error: error.message });
    }
};

// Update an existing matrix routing rule
export const updateApprovalMatrix = async (req, res) => {
    try {
        const { id } = req.params;
        const { form_type, department_id, role, user_id, is_active } = req.body;

        const rule = await ApprovalMatrix.findByPk(id);

        if (!rule) {
            return res.status(404).json({ message: 'Routing rule not found' });
        }

        // Check for duplicate updates (if they are changing the unique key)
        if (
            (form_type && form_type !== rule.form_type) ||
            (department_id && department_id !== rule.department_id) ||
            (role && role !== rule.role) ||
            (user_id && user_id !== rule.user_id)
        ) {
            const existingRule = await ApprovalMatrix.findOne({
                where: {
                    form_type: form_type || rule.form_type,
                    department_id: department_id || rule.department_id,
                    role: role || rule.role,
                    user_id: user_id || rule.user_id,
                    id: { [Op.ne]: id }
                }
            });

            if (existingRule) {
                return res.status(400).json({
                    message: `This user is already assigned to this Form, Department, and Role combination.`
                });
            }
        }

        await rule.update({
            form_type: form_type !== undefined ? form_type : rule.form_type,
            department_id: department_id !== undefined ? department_id : rule.department_id,
            role: role !== undefined ? role : rule.role,
            user_id: user_id !== undefined ? user_id : rule.user_id,
            is_active: is_active !== undefined ? is_active : rule.is_active
        });

        // Fetch complete updated rule
        const updatedRule = await ApprovalMatrix.findByPk(id, {
            include: [
                { model: Department, as: 'Department', attributes: ['id', 'name'] },
                { model: User, as: 'User', attributes: ['id', 'first_name', 'last_name', 'email'] }
            ]
        });

        res.json({ message: 'Routing rule updated successfully', rule: updatedRule });
    } catch (error) {
        console.error('Error updating approval matrix rule:', error);
        res.status(500).json({ message: 'Error updating rule', error: error.message });
    }
};

// Delete a matrix routing rule
export const deleteApprovalMatrix = async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await ApprovalMatrix.findByPk(id);

        if (!rule) {
            return res.status(404).json({ message: 'Routing rule not found' });
        }

        await rule.destroy();

        res.json({ message: 'Routing rule deleted successfully' });
    } catch (error) {
        console.error('Error deleting approval matrix rule:', error);
        res.status(500).json({ message: 'Error deleting rule', error: error.message });
    }
};
