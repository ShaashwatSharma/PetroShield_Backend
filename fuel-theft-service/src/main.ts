import express from 'express';
import { PrismaClient, TheftStatus } from '@prisma/client';
import mqtt from 'mqtt';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

/** ---------------------------- MQTT SETUP ----------------------------- */

// const mqttClient = mqtt.connect('mqtt://mosquitto:1883'); // docker network name if running in container
// const mqttClient = mqtt.connect('mqtt://localhost:1883');
const mqttClient = mqtt.connect('mqtt://host.docker.internal:1883');

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('petroshield/fuel', (err) => {
    if (!err) {
      console.log('Subscribed to topic: petroshield/fuel');
    }
  });
});

mqttClient.on('message', async (topic: string, message: Buffer) => {
  try {
    const data = JSON.parse(message.toString());
    await ingestFuelLog(data);
  } catch (err) {
    console.error('Error handling MQTT message', err);
  }
});

/** ---------------------------- HELPERS ----------------------------- */

async function ingestFuelLog(data: any) {
  const { sensorId, vehicleId, fuelLevel, latitude, longitude, userId } = data;

  const log = await prisma.fuelLog.create({
    data: { sensorId, vehicleId, fuelLevel, latitude, longitude, userId }
  });
  console.log(`Saved FuelLog with id: ${log.id}`); 
  // Create alert if suspicious
  if (fuelLevel < 10) {
    await prisma.theftAlert.create({
      data: {
        fuelLogId: log.id,
        userId,
        vehicleId,
        status: TheftStatus.PENDING,
        description: 'Possible theft detected: low fuel level'
      }
    });
    console.log(`Created alert for FuelLog id: ${log.id}`); 
  }
}

/** ---------------------- FUEL LOG ENDPOINTS --------------------- */

// Admin: all fuel logs
app.get('/fuel-logs', async (_, res) => {
  const logs = await prisma.fuelLog.findMany();
  res.json(logs);
});

// Vehicle logs
app.get('/fuel-logs/vehicle/:vehicleId', async (req, res) => {
  const logs = await prisma.fuelLog.findMany({
    where: { vehicleId: req.params.vehicleId }
  });
  res.json(logs);
});

// Driver logs
app.get('/fuel-logs/driver/:driverId', async (req, res) => {
  const logs = await prisma.fuelLog.findMany({
    where: { userId: req.params.driverId }
  });
  res.json(logs);
});

// Manager logs — assuming we get list of vehicle IDs from another service or mapping table
app.get('/fuel-logs/manager/:managerId', async (req, res) => {
  try {
    // Example: fetch vehicle IDs for manager from vehicle-service
    // Here we mock as []
    const managerVehicleIds: string[] = []; // You will replace with actual call to vehicle service

    const logs = await prisma.fuelLog.findMany({
      where: { vehicleId: { in: managerVehicleIds } }
    });

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch manager fuel logs' });
  }
});

// Ingestion (sensor or manual)
app.post('/fuel-logs', async (req, res) => {
  try {
    await ingestFuelLog(req.body);
    res.json({ message: 'Fuel log saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save fuel log' });
  }
});

/** ---------------------- ALERT ENDPOINTS --------------------- */

// All alerts
app.get('/alerts', async (_, res) => {
  const alerts = await prisma.theftAlert.findMany();
  res.json(alerts);
});

// Alerts for vehicle
app.get('/alerts/vehicle/:vehicleId', async (req, res) => {
  const alerts = await prisma.theftAlert.findMany({
    where: { vehicleId: req.params.vehicleId }
  });
  res.json(alerts);
});

// System creates alert (automated)
app.post('/alerts', async (req, res) => {
  const { fuelLogId, userId, vehicleId, description } = req.body;
  try {
    const alert = await prisma.theftAlert.create({
      data: {
        fuelLogId,
        userId,
        vehicleId,
        description,
        status: TheftStatus.PENDING
      }
    });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Report suspected theft (manager)
app.post('/alerts/report/:id', async (req, res) => {
  try {
    const alert = await prisma.theftAlert.update({
      where: { id: req.params.id },
      data: { status: TheftStatus.REVIEWED }
    });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Acknowledge alert
app.post('/alerts/acknowledge/:id', async (req, res) => {
  try {
    const alert = await prisma.theftAlert.update({
      where: { id: req.params.id },
      data: { status: TheftStatus.CONFIRMED }
    });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Approve alert
app.post('/alerts/approve/:id', async (req, res) => {
  try {
    const alert = await prisma.theftAlert.update({
      where: { id: req.params.id },
      data: { status: TheftStatus.CONFIRMED }
    });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve alert' });
  }
});

// Reject alert
app.post('/alerts/reject/:id', async (req, res) => {
  try {
    const alert = await prisma.theftAlert.update({
      where: { id: req.params.id },
      data: { status: TheftStatus.DISMISSED }
    });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject alert' });
  }
});

/** ---------------------- START SERVER --------------------- */

app.listen(3000, () => {
  console.log('fuel-theft-service running on port 3000 or 3000 on Host');
});
