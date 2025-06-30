import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.get('/reports/fuel', async (_, res) => {
  const logs = await prisma.fuelLog.findMany();
  res.json(logs);
});

app.get('/reports/theft', async (_, res) => {
  const alerts = await prisma.theftAlert.findMany();
  res.json(alerts);
});

app.listen(3004, () => {
  console.log('reporting-service running on port 3004');
});
