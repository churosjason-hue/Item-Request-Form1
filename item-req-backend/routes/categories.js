import express from 'express';
import {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Public (read-only)
router.get('/', getAllCategories);

// Restricted (Service Desk & Admin)
router.post('/', requireRole(['service_desk', 'super_administrator']), createCategory);
router.put('/:id', requireRole(['service_desk', 'super_administrator']), updateCategory);
router.delete('/:id', requireRole(['service_desk', 'super_administrator']), deleteCategory);

export default router;
