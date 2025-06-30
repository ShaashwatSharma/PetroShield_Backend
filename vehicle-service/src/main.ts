import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.post('/vehicles', async (req, res) => {
  const { name, number } = req.body;
  const vehicle = await prisma.vehicle.create({
    data: { name, number }
  });
  res.json(vehicle);
});

app.get('/vehicles', async (_, res) => {
  const vehicles = await prisma.vehicle.findMany();
  res.json(vehicles);
});

app.listen(3002, () => {
  console.log('vehicle-service running on port 3002');
});
