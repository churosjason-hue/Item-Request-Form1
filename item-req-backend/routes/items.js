import express from 'express';
import {
    getAllItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem
} from '../controllers/itemController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Public (authenticated) routes or Read-only
router.get('/', getAllItems);
router.get('/:id', getItemById);

// Protected routes (Service Desk & Admin only)
// Creating, Updating, Deleting items is restricted
router.post('/', requireRole(['service_desk', 'super_administrator']), createItem);
router.put('/:id', requireRole(['service_desk', 'super_administrator']), updateItem);
router.delete('/:id', requireRole(['service_desk', 'super_administrator']), deleteItem);

export default router;
