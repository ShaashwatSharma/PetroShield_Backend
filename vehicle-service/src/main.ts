
import app from './app';

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Vehicle Management Service is running on port ${PORT}`);
});



























































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
//   console.log('vehicle-service running on port 3000');
// });
