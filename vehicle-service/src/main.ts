import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import vehicleRoutes from './routes/vehicleRoutes';
import sensorRoutes from './routes/sensorRoutes';
import { authenticateToken } from './middleware/authMiddleware';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//  Middleware to decode token and attach user info
app.use(authenticateToken);

//  Routes
app.use('/vehicles', vehicleRoutes);
app.use('/sensors', sensorRoutes);


app.get('/', (_req, res) => {
  res.send('Vehicle & Sensor Service is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Vehicle & Sensor Service running on port ${PORT} 3002 on Host`);
});
