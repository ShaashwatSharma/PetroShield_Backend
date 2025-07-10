import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import authenticateToken from './middleware/auth'; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
//  Apply auth middleware globally
app.use(authenticateToken);

// Routes
app.use('/api/users', userRoutes);

// Root health check
app.get('/', (_req, res) => {
  res.send('User Management Service is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(` User Management Service running on port ${PORT} or 3001 on Host`);
});
