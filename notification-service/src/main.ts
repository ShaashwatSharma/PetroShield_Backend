import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.post('/notify', async (req, res) => {
  const { vehicleId, message } = req.body;

  const notification = await prisma.notification.create({
    data: {
      vehicleId,
      message
    }
  });

  console.log(`Notification saved: ${message}`);
  res.json({ success: true, notification });
});

app.listen(3001, () => {
  console.log('notification-service running on port 3001');
});
