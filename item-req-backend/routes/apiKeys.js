import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    deleteApiKey
} from '../controllers/apiKeyController.js';

const router = express.Router();

// All routes require authentication AND super_administrator role
router.use(authenticateToken, requireRole(['super_administrator']));

// List all API keys
router.get('/', listApiKeys);

// Create a new API key (returns plain key once)
router.post('/', createApiKey);

// Revoke (deactivate) an API key
router.patch('/:id/revoke', revokeApiKey);

// Permanently delete an API key
router.delete('/:id', deleteApiKey);

export default router;
