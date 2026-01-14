import express from 'express';
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
} from '../controllers/vehicleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all vehicles
router.get('/', getAllVehicles);

// Get single vehicle
router.get('/:id', getVehicleById);

// Create vehicle
router.post('/', createVehicle);

// Update vehicle
router.put('/:id', updateVehicle);

// Delete vehicle
router.delete('/:id', deleteVehicle);

export default router;
