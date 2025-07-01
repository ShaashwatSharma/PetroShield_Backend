import mqtt from 'mqtt';

// ⚡ Configure your MQTT broker URL
const brokerUrl = 'mqtt://localhost:1883'; // Change if needed

// Connect
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('Simulator connected to MQTT broker');

  // Simulate sending data every 3 seconds
  setInterval(() => {
    // Create random fake data
    const data = {
      sensorId: `sensor-${Math.floor(Math.random() * 5 + 1)}`,
      vehicleId: `vehicle-${Math.floor(Math.random() * 5 + 1)}`,
      userId: `user-${Math.floor(Math.random() * 3 + 1)}`,
      fuelLevel: parseFloat((Math.random() * 100).toFixed(2)),
      latitude: 28.61 + Math.random() * 0.01,
      longitude: 77.20 + Math.random() * 0.01
    };

    // Publish to topic
client.publish('petroshield/fuel', JSON.stringify(data));
    console.log('Published simulated data:', data);
  }, 3000);
});

client.on('error', (err) => {
  console.error('MQTT Simulator error:', err);
  client.end();
});
