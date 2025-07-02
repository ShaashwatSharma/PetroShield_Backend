
import app from './app';

const PORT = process.env.PORT || 3003;

// app.listen(PORT, () => {
//   console.log(`Vehicle Management Service is running on port ${PORT}`);
// });



app.listen(3000, () => {
  console.log('vehicle-service running on port 3000');
});




























// import express, { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();
// const app = express();
// app.use(express.json());

// /**
//  * GET /vehicles
//  * List all vehicles
//  */
// app.get('/vehicles', async (_req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Could not fetch vehicles' });
//   }
// });

// /**
//  * GET /vehicles/:id
//  * Get vehicle by ID
//  */
// app.get('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { id: req.params.id },
//     });
//     if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
//     res.json(vehicle);
//   } catch (error) {
//     res.status(500).json({ error: 'Could not fetch vehicle' });
//   }
// });

// /**
//  * POST /vehicles
//  * Register new vehicle
//  */
// app.post('/vehicles', async (req: Request, res: Response) => {
//   try {
//     const vehicle = await prisma.vehicle.create({ data: req.body });
//     res.status(201).json(vehicle);
//   } catch (error) {
//     res.status(500).json({ error: 'Vehicle registration failed' });
//   }
// });

// /**
//  * PUT /vehicles/:id
//  * Update vehicle info
//  */
// app.put('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     const updatedVehicle = await prisma.vehicle.update({
//       where: { id: req.params.id },
//       data: req.body,
//     });
//     res.json(updatedVehicle);
//   } catch (error) {
//     res.status(500).json({ error: 'Vehicle update failed' });
//   }
// });

// /**
//  * DELETE /vehicles/:id
//  * Delete vehicle
//  */
// app.delete('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     await prisma.vehicle.delete({ where: { id: req.params.id } });
//     res.json({ message: 'Vehicle deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Vehicle deletion failed' });
//   }
// });

// /**
//  * POST /vehicles/:id/assign-driver
//  * Assign driver to vehicle
//  */
// app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
//   try {
//     const { driverId } = req.body;
//     const vehicle = await prisma.vehicle.update({
//       where: { id: req.params.id },
//       data: { driverId },
//     });
//     res.json({ message: 'Driver assigned successfully', vehicle });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to assign driver' });
//   }
// });

// /**
//  * GET /vehicles/driver/:driverId
//  * Vehicles assigned to driver
//  */
// app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany({
//       where: { driverId: req.params.driverId },
//     });
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Could not fetch vehicles for driver' });
//   }
// });

// /**
//  * GET /vehicles/manager/:managerId
//  * Vehicles managed by manager
//  */
// app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany({
//       where: { managerId: req.params.managerId },
//     });
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Could not fetch vehicles for manager' });
//   }
// });

// // Start server
// const PORT = process.env.PORT || 3003;
// app.listen(PORT, () => {
//   console.log(`Vehicle Management Service is running on port ${PORT}`);
// });
