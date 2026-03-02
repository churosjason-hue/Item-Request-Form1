import express from 'express';
import { getSetting, updateSetting, getGeneralPurposes } from '../controllers/settingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get general purposes (specific helper)
router.get('/general-purposes', getGeneralPurposes);

// Get setting
router.get('/:key', getSetting);

// Update setting (Admin/IT Manager only checked in controller)
router.put('/:key', updateSetting);

export default router;
