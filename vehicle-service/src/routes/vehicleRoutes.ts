import express, { Router } from 'express';
import {registerVehicle,getVehicleById,getAllVehicles,updateVehicle,deleteVehicle,assignDriver,getVehiclesByDriver,getVehiclesByManager} from '../controllers/vehicleController';


const router: Router = express.Router(); 

router.post('/', registerVehicle);
router.get('/', getAllVehicles);
// router.get('/:id', getVehicleById);

router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

router.get('/driver/:driverId', getVehiclesByDriver);
router.get('/manager/:managerId', getVehiclesByManager);
router.post('/:id/assign-driver', assignDriver);



export default router;

