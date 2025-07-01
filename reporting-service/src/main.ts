import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

// Overall consumption
app.get('/reports/consumption', async (_, res) => {
  try {
    const { data: logs } = await axios.get('http://fuel-theft-service:3000/fuel-logs');

    const totalConsumption = logs.reduce((sum: number, log: { fuelLevel: number }) => sum + log.fuelLevel, 0);
    res.json({ totalConsumption, logsCount: logs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch consumption data' });
  }
});

// Manager reports
app.get('/reports/manager/:managerId', async (req, res) => {
  const { managerId } = req.params;

  try {
    const { data: vehicles } = await axios.get(`http://vehicle-service:3000/manager/${managerId}/vehicles`);
    const vehicleIds = vehicles.map((v: { id: string }) => v.id);

    const { data: logs } = await axios.get('http://fuel-theft-service:3000/fuel-logs');
    const filteredLogs = logs.filter((log: { vehicleId: string }) => vehicleIds.includes(log.vehicleId));

    res.json({ managerId, vehicles, fuelLogs: filteredLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch manager report' });
  }
});

// Driver reports
app.get('/reports/driver/:driverId', async (req, res) => {
  const { driverId } = req.params;

  try {
    const { data: vehicles } = await axios.get(`http://vehicle-service:3000/driver/${driverId}/vehicles`);
    const vehicleIds = vehicles.map((v: { id: string }) => v.id);

    const { data: logs } = await axios.get('http://fuel-theft-service:3000/fuel-logs');
    const filteredLogs = logs.filter((log: { vehicleId: string }) => vehicleIds.includes(log.vehicleId));

    const incidents = await prisma.incidentReport.findMany({
      where: { userId: driverId }
    });

    res.json({ driverId, vehicles, fuelLogs: filteredLogs, incidents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch driver report' });
  }
});

app.listen(3000, () => {
  console.log('reporting-service running on port 3000');
});
