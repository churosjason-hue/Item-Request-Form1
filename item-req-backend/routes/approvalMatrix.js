import express from 'express';
import {
    getApprovalMatrices,
    getApprovalMatrixById,
    createApprovalMatrix,
    updateApprovalMatrix,
    deleteApprovalMatrix
} from '../controllers/approvalMatrixController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All layout routing rules should be restricted to authenticated users
router.use(authenticateToken);

// List rules
router.get('/', getApprovalMatrices);

// Get specific rule
router.get('/:id', getApprovalMatrixById);

// Admin-only routes for modifying rules
const isAdmin = requireRole('super_administrator', 'it_manager');

router.post('/', isAdmin, createApprovalMatrix);
router.put('/:id', isAdmin, updateApprovalMatrix);
router.delete('/:id', isAdmin, deleteApprovalMatrix);

export default router;
