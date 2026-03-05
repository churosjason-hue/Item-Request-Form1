import express from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { itemRequestUpload } from '../utils/uploadConfig.js';

import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  submitRequest,
  approveRequest,
  declineRequest,
  returnRequest,
  cancelRequest,
  deleteRequest,
  getStats,
  trackRequest,
  restockItem,
  deleteRequestItem,
  uploadAttachments,
  deleteAttachment,
  approvePR,
  readyToDeploy,
  assignVerifier,
  verifyRequest
} from '../controllers/requestController.js';

const router = express.Router();

// Get all requests (with filtering and pagination)
router.get('/', authenticateToken, getAllRequests);

// Get request by ID
router.get('/:id', authenticateToken, getRequestById);

// Create new request
router.post('/', [
  authenticateToken,
  body('userName').optional().trim().isLength({ max: 200 }),
  body('userPosition').optional().trim().isLength({ max: 200 }),
  body('departmentId').isInt({ min: 1 }).withMessage('Valid department ID is required'),
  body('dateRequired').optional({ checkFalsy: true }).custom((value) => {
    if (!value || value === '') return true; // Allow empty values
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be in YYYY-MM-DD format');
    return true;
  }),
  body('reason').optional().trim().isLength({ max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.category').trim().notEmpty().withMessage('Category is required'),
  body('items.*.itemDescription').optional().trim().isLength({ max: 500 }),
  body('items.*.itemDescription').optional().trim().isLength({ max: 500 }),
  body('items.*.quantity').isInt({ min: 1, max: 999 }),
  body('items.*.priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('items.*.dateRequired').optional({ checkFalsy: true }).custom((value) => {
    if (!value || value === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be in YYYY-MM-DD format');
    return true;
  }),
  body('items.*.comments').optional().trim().isLength({ max: 1000 })
], createRequest);

// Update request (draft only)
router.put('/:id', [
  authenticateToken,
  body('userName').optional().trim().isLength({ max: 200 }),
  body('userPosition').optional().trim().isLength({ max: 200 }),
  body('departmentId').optional().isInt({ min: 1 }),
  body('dateRequired').optional({ checkFalsy: true }).custom((value) => {
    if (!value || value === '') return true; // Allow empty values
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be in YYYY-MM-DD format');
    return true;
  }),
  body('reason').optional().trim().isLength({ max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('items').optional().isArray({ min: 1 }),
  body('comments').optional().trim().isLength({ max: 1000 })
], updateRequest);

// Submit request for approval
router.post('/:id/submit', authenticateToken, submitRequest);

// Approve/Decline/Return request
router.post('/:id/approve', [
  authenticateToken,
  body('comments').optional().trim().isLength({ max: 1000 }),
  body('estimatedCompletionDate').optional().isISO8601(),
  body('processingNotes').optional().trim().isLength({ max: 1000 })
], approveRequest);

// Decline request
router.post('/:id/decline', [
  authenticateToken,
  body('comments').trim().notEmpty().withMessage('Comments are required when declining'),
  body('comments').isLength({ max: 1000 })
], declineRequest);

// Return request for revision
router.post('/:id/return', [
  authenticateToken,
  body('returnReason').trim().notEmpty().withMessage('Return reason is required'),
  body('returnReason').isLength({ max: 1000 }),
  body('returnTo').optional().isIn(['requestor', 'department_approver']).withMessage('Invalid returnTo value')
], returnRequest);

// Cancel request
router.post('/:id/cancel', authenticateToken, cancelRequest);

// Delete draft request (requestor only)
router.delete('/:id', authenticateToken, deleteRequest);

// Get request statistics (for dashboard)
router.get('/stats/overview', authenticateToken, getStats);

// Restock item (Service Desk)
router.post('/:id/items/:itemId/restock', authenticateToken, restockItem);

// Delete item (Service Desk)
router.delete('/:id/items/:itemId', authenticateToken, deleteRequestItem);

// Attachments
router.post('/:id/attachments', authenticateToken, itemRequestUpload.array('files'), uploadAttachments);
router.delete('/:id/attachments/:index', authenticateToken, deleteAttachment);

// Approve PR (Service Desk)
router.post('/:id/approve-pr', authenticateToken, approvePR);

// Ready to Deploy (Service Desk)
router.post('/:id/ready-to-deploy', authenticateToken, readyToDeploy);

// Public endpoint: Track request by ticket code (no authentication required)
router.get('/public/track/:ticketCode', trackRequest);

// Assign Verifier (Department Approver / IT Manager)
router.post('/:id/assign-verifier', authenticateToken, assignVerifier);

// Verify Request (Assigned Verifier)
router.post('/:id/verify', authenticateToken, verifyRequest);

export default router;
