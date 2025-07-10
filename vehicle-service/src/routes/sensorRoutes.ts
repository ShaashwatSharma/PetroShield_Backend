import express from 'express';
import {
  getAllSensors,
  getSensorById,
  createSensor,
  assignSensorToVehicle,
  updateSensor,
  deleteSensor
} from '../controllers/sensorController';
import { requireRole,authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllSensors);
router.get('/:id', getSensorById);
router.post('/', requireRole(['Super_Admin', 'Admin']), createSensor);
router.post('/:id/assign-vehicle', requireRole(['Super_Admin', 'Admin']), assignSensorToVehicle);
router.put('/:id', requireRole(['Super_Admin', 'Admin']), updateSensor);
router.delete('/:id', requireRole(['Super_Admin', 'Admin']), deleteSensor);

export default router;
