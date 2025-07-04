// import express from 'express';
// import { PrismaClient } from '@prisma/client';

// const app = express();
// const prisma = new PrismaClient();
// app.use(express.json());

// app.post('/vehicles', async (req, res) => {
//   try {
//     const { registration, organizationId } = req.body;

//     const vehicle = await prisma.vehicle.create({
//       data: {
//         registration,
//         organizationId,
//       },
//     });

//     res.json(vehicle);
//   } catch (error) {
//     console.error('Error creating vehicle:', error);
//     res.status(500).json({ error: 'Failed to create vehicle' });
//   }
// });

// app.get('/vehicles', async (_, res) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json(vehicles);
//   } catch (error) {
//     console.error('Error fetching vehicles:', error);
//     res.status(500).json({ error: 'Failed to fetch vehicles' });
//   }
// });

// app.listen(3000, () => {
//   console.log('vehicle-service running on port 3000 or 3002 on Host');
// });







































import app from './app';

const PORT = process.env.PORT || 3003;

// app.listen(PORT, () => {
//   console.log(`Vehicle Management Service is running on port ${PORT}`);
// });



app.listen(3000, () => {
  console.log('vehicle-service running on port 3000 or 3002 on Host');
});




























// // import express, { Request, Response } from 'express';
// // import { PrismaClient } from '@prisma/client';

// // const prisma = new PrismaClient();
// // const app = express();
// // app.use(express.json());

// // /**
// //  * GET /vehicles
// //  * List all vehicles
// //  */
// // app.get('/vehicles', async (_req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany();
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles' });
// //   }
// // });

// // /**
// //  * GET /vehicles/:id
// //  * Get vehicle by ID
// //  */
// // app.get('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     const vehicle = await prisma.vehicle.findUnique({
// //       where: { id: req.params.id },
// //     });
// //     if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
// //     res.json(vehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicle' });
// //   }
// // });

// // /**
// //  * POST /vehicles
// //  * Register new vehicle
// //  */
// // app.post('/vehicles', async (req: Request, res: Response) => {
// //   try {
// //     const vehicle = await prisma.vehicle.create({ data: req.body });
// //     res.status(201).json(vehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle registration failed' });
// //   }
// // });

// // /**
// //  * PUT /vehicles/:id
// //  * Update vehicle info
// //  */
// // app.put('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     const updatedVehicle = await prisma.vehicle.update({
// //       where: { id: req.params.id },
// //       data: req.body,
// //     });
// //     res.json(updatedVehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle update failed' });
// //   }
// // });

// // /**
// //  * DELETE /vehicles/:id
// //  * Delete vehicle
// //  */
// // app.delete('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     await prisma.vehicle.delete({ where: { id: req.params.id } });
// //     res.json({ message: 'Vehicle deleted successfully' });
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle deletion failed' });
// //   }
// // });

// // /**
// //  * POST /vehicles/:id/assign-driver
// //  * Assign driver to vehicle
// //  */
// // app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
// //   try {
// //     const { driverId } = req.body;
// //     const vehicle = await prisma.vehicle.update({
// //       where: { id: req.params.id },
// //       data: { driverId },
// //     });
// //     res.json({ message: 'Driver assigned successfully', vehicle });
// //   } catch (error) {
// //     res.status(500).json({ error: 'Failed to assign driver' });
// //   }
// // });

// // /**
// //  * GET /vehicles/driver/:driverId
// //  * Vehicles assigned to driver
// //  */
// // app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany({
// //       where: { driverId: req.params.driverId },
// //     });
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles for driver' });
// //   }
// // });

// // /**
// //  * GET /vehicles/manager/:managerId
// //  * Vehicles managed by manager
// //  */
// // app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany({
// //       where: { managerId: req.params.managerId },
// //     });
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles for manager' });
// //   }
// // });

// // // Start server
// // const PORT = process.env.PORT || 3003;
// // app.listen(PORT, () => {
// //   console.log(`Vehicle Management Service is running on port ${PORT}`);
// // });














// import express, { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';

// const app = express();
// const prisma = new PrismaClient();
// app.use(express.json());

// /**
//  * GET /vehicles
//  */
// app.get('/vehicles', async (_req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany();
//   res.json(vehicles);
// });

// /**
//  * GET /vehicles/:id
//  */
// app.get('/vehicles/:id', async (req: Request, res: Response) => {
//   const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
//   if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
//   res.json(vehicle);
// });

// /**
//  * POST /vehicles
//  */
// app.post('/vehicles', async (req: Request, res: Response) => {
//   const vehicle = await prisma.vehicle.create({ data: req.body });
//   res.status(201).json(vehicle);
// });

// /**
//  * PUT /vehicles/:id
//  */
// app.put('/vehicles/:id', async (req: Request, res: Response) => {
//   const updatedVehicle = await prisma.vehicle.update({
//     where: { id: req.params.id },
//     data: req.body,
//   });
//   res.json(updatedVehicle);
// });

// /**
//  * DELETE /vehicles/:id
//  */
// app.delete('/vehicles/:id', async (req: Request, res: Response) => {
//   await prisma.vehicle.delete({ where: { id: req.params.id } });
//   res.json({ message: 'Vehicle deleted' });
// });

// /**
//  * POST /vehicles/:id/assign-driver
//  */
// app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
//   const { driverId } = req.body;
//   const vehicle = await prisma.vehicle.update({
//     where: { id: req.params.id },
//     data: { driverId },
//   });
//   res.json({ message: 'Driver assigned', vehicle });
// });

// /**
//  * GET /vehicles/driver/:driverId
//  */
// app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany({ where: { driverId: req.params.driverId } });
//   res.json(vehicles);
// });

// /**
//  * GET /vehicles/manager/:managerId
//  */
// app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany({ where: { managerId: req.params.managerId } });
//   res.json(vehicles);
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Vehicle service running on port ${PORT} or 3002 on host`);
// });