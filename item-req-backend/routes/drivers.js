import express from 'express';
import {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver
} from '../controllers/driverController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all drivers
router.get('/', getAllDrivers);

// Get single driver
router.get('/:id', getDriverById);

// Create driver
router.post('/', createDriver);

// Update driver
router.put('/:id', updateDriver);

// Delete driver
router.delete('/:id', deleteDriver);

export default router;
