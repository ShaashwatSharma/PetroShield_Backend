import express from 'express';
import {registerVehicle,getAllVehicles,getVehicleById,updateVehicle,deleteVehicle} from '../controllers/vehicleControllers';



const router = express.Router();

router.post('/',registerVehicle);
router.get('/',getAllVehicles);
router.get('/:id',getVehicleById);
router.put('/:id', updateVehicle);
router.delete('/:id',deleteVehicle);







// router.post('/:id/assign-driver', VehicleController.assignDriver);
// router.get('/driver/:driverId', VehicleController.getVehiclesByDriver);
// router.get('/manager/:managerId', VehicleController.getVehiclesByManager);






export default router;
