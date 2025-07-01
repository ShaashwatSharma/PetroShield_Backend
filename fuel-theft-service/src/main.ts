import express, { Request, Response } from 'express';
import { PrismaClient, TheftStatus } from '@prisma/client';
import axios from 'axios';
import mqtt from 'mqtt';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.post('/fuel-log', async (req: Request, res: Response) => {
  const { sensorId, vehicleId, fuelLevel, latitude, longitude, userId } = req.body;

  try {
    // Save fuel log
    const log = await prisma.fuelLog.create({
      data: { sensorId, vehicleId, fuelLevel, latitude, longitude, userId }
    });

    // Check for possible theft
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

      // Notify
      await axios.post('http://notification-service:3001/notify', {
        userId,
        message: `Possible theft detected for vehicle ${vehicleId}`,
        status: 'SENT'
      });
    }

    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create fuel log' });
  }
});

// MQTT Setup
const mqttClient = mqtt.connect('mqtt://mqtt-broker-url'); // Replace with actual broker URL

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
    console.log('Received MQTT fuel data:', data);

    const { sensorId, vehicleId, fuelLevel, latitude, longitude, userId } = data;

    // Save fuel log
    const log = await prisma.fuelLog.create({
      data: { sensorId, vehicleId, fuelLevel, latitude, longitude, userId }
    });

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

      await axios.post('http://notification-service:3001/notify', {
        userId,
        message: `Possible theft detected for vehicle ${vehicleId}`,
        status: 'SENT'
      });
    }
  } catch (err) {
    console.error('Error handling MQTT message', err);
  }
});

app.listen(3000, () => {
  console.log('fuel-theft-service running on port 3000');
});
