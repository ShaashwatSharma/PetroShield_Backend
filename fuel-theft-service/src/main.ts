import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import mqtt from 'mqtt';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

// Example API: save fuel log manually
app.post('/fuel-log', async (req, res) => {
  const { sensorId, vehicleId, fuelLevel, latitude, longitude } = req.body;

  const log = await prisma.fuelLog.create({
    data: { sensorId, vehicleId, fuelLevel, latitude, longitude }
  });

  // Check theft (very simple example logic)
  if (fuelLevel < 10) {
    // Save alert
    await prisma.theftAlert.create({
      data: {
        vehicleId,
        alertType: 'Low Fuel Theft',
        status: 'Open'
      }
    });

    // Notify notification-service
    await axios.post('http://notification-service:3001/notify', {
      vehicleId,
      message: `Possible theft detected for vehicle ${vehicleId}`
    });
  }

  res.json(log);
});

// MQTT integration
const mqttClient = mqtt.connect('mqtt://mqtt-broker-url'); // or your broker
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('petroshield/fuel');
});

mqttClient.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log('Received MQTT fuel data:', data);

    // Save log
    await prisma.fuelLog.create({
      data: {
        sensorId: data.sensorId,
        vehicleId: data.vehicleId,
        fuelLevel: data.fuelLevel,
        latitude: data.latitude,
        longitude: data.longitude
      }
    });

    // Example theft detection
    if (data.fuelLevel < 10) {
      await prisma.theftAlert.create({
        data: {
          vehicleId: data.vehicleId,
          alertType: 'Low Fuel Theft',
          status: 'Open'
        }
      });

      await axios.post('http://notification-service:3001/notify', {
        vehicleId: data.vehicleId,
        message: `Possible theft detected for vehicle ${data.vehicleId}`
      });
    }
  } catch (err) {
    console.error('Error handling MQTT message', err);
  }
});

app.listen(3000, () => {
  console.log('fuel-theft-service running on port 3000');
});
