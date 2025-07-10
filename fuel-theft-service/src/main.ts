import express from 'express';
import { PrismaClient, TheftStatus } from '@prisma/client';
import mqtt from 'mqtt';
import { sendAlertMessage, sendReportMessage } from './sqsfnxn';


const app = express();
const prisma = new PrismaClient();
app.use(express.json());

/** ---------------------------- MQTT SETUP ----------------------------- */

// const mqttClient = mqtt.connect('mqtt://mosquitto:1883'); // docker network name if running in container
// const mqttClient = mqtt.connect('mqtt://localhost:1883');
const mqttClient = mqtt.connect("mqtt://host.docker.internal:1883");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe("petroshield/fuel", (err) => {
    if (!err) {
      console.log("Subscribed to topic: petroshield/fuel");
    }
  });
});

mqttClient.on("message", async (topic: string, message: Buffer) => {
  try {
    const data = JSON.parse(message.toString());
    await handleIncomingSensorData(data);
  } catch (err) {
    console.error("Error handling MQTT message", err);
  }
});

async function handleIncomingSensorData(data: {
  sensorId: string;
  vehicleId: string;
  fuelLevel: number;
  latitude: number;
  longitude: number;
  userId: string;
}) {
  // Save raw log first
  const fuelLog = await prisma.fuelLog.create({
    data: {
      sensorId: data.sensorId,
      vehicleId: data.vehicleId,
      fuelLevel: data.fuelLevel,
      latitude: data.latitude,
      longitude: data.longitude,
      userId: data.userId,
    },
  });

  console.log(`✅ Saved FuelLog with id: ${fuelLog.id}`);

  // Run ML model on this data
  const mlResult = await runMLModel(data);

  // If ML model detects theft, create local alert
  if (mlResult.isTheft) {
    await prisma.theftAlert.create({
      data: {
        fuelLogId: fuelLog.id,
        userId: data.userId,
        vehicleId: data.vehicleId,
        status: TheftStatus.PENDING,
        description: `Fuel theft detected: ${mlResult.fuelDropLiters} liters lost.`,
      },
    });
    console.log(`🚨 Created theft alert for FuelLog id: ${fuelLog.id}`);

    // Send to Notification Service via SQS
    await sendAlertMessage({
      vehicleId: mlResult.vehicleId,
      message: `Fuel theft detected: ${mlResult.fuelDropLiters} liters lost.`,
      timestamp: mlResult.timestamp,
      driverId: mlResult.driverId,
      orgId: mlResult.orgId,
    });
  }

  // Always send refined data to Report Service
  await sendReportMessage({
    vehicleId: mlResult.vehicleId,
    refinedData: mlResult.refinedData,
    timestamp: mlResult.timestamp,
    orgId: mlResult.orgId,
  });

  return mlResult;
}

async function runMLModel(rawData: {
  sensorId: string;
  vehicleId: string;
  fuelLevel: number;
  latitude: number;
  longitude: number;
  userId: string;
}): Promise<{
  isTheft: boolean;
  fuelDropLiters: number;
  vehicleId: string;
  timestamp: string;
  refinedData: any;
  driverId: string;
  orgId: string;
}> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const fuelThreshold = 20;
      const fuelDropLiters = Math.max(0, fuelThreshold - rawData.fuelLevel);
      const isTheft = fuelDropLiters > 5;
      const timestamp = new Date().toISOString();

      const refinedData = {
        ...rawData,
        fuelDropLiters,
        timestamp,
      };

      resolve({
        isTheft,
        fuelDropLiters,
        vehicleId: rawData.vehicleId,
        timestamp,
        refinedData,
        driverId: rawData.userId,
        orgId: "example-org-id", // Replace or pass dynamically
      });
    }, 500); // Simulated delay
  });
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
    const result = await handleIncomingSensorData(req.body);
    res.json({ 
      message: 'Fuel log processed and saved successfully',
      isTheft: result.isTheft,
      fuelDropLiters: result.fuelDropLiters
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process fuel log' });
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
