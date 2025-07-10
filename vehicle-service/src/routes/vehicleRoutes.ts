import express from 'express';
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignDriver
} from '../controllers/vehicleController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllVehicles);
router.get('/:id', getVehicleById);
router.post('/', requireRole(['Super_Admin', 'Admin']), createVehicle);
router.put('/:id', requireRole(['Super_Admin', 'Admin']), updateVehicle);
router.delete('/:id', requireRole(['Super_Admin', 'Admin']), deleteVehicle);
router.post('/:id/assign-driver', requireRole(['Super_Admin', 'Admin', 'Manager']), assignDriver);

export default router;
