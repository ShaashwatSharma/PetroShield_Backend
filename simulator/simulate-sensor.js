"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mqtt_1 = require("mqtt");
// ⚡ Configure your MQTT broker URL
var brokerUrl = 'mqtt://localhost:1883'; // Change if needed
// Connect
var client = mqtt_1.default.connect(brokerUrl);
client.on('connect', function () {
    console.log('Simulator connected to MQTT broker');
    // Simulate sending data every 3 seconds
    setInterval(function () {
        // Create random fake data
        var data = {
            sensorId: "sensor-".concat(Math.floor(Math.random() * 5 + 1)),
            vehicleId: "vehicle-".concat(Math.floor(Math.random() * 5 + 1)),
            userId: "user-".concat(Math.floor(Math.random() * 3 + 1)),
            fuelLevel: parseFloat((Math.random() * 100).toFixed(2)),
            latitude: 28.61 + Math.random() * 0.01,
            longitude: 77.20 + Math.random() * 0.01
        };
        // Publish to topic
        client.publish('petroshield/fuel', JSON.stringify(data));
        console.log('Published simulated data:', data);
    }, 3000);
});
client.on('error', function (err) {
    console.error('MQTT Simulator error:', err);
    client.end();
});
