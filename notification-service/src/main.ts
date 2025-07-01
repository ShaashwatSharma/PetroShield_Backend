import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

app.post('/notify', async (req, res) => {
  try {
    const { userId, message, status } = req.body;

    const notification = await prisma.notificationLog.create({
      data: {
        userId,
        message,
        status,
      },
    });

    console.log(`Notification logged: ${message}`);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error saving notification:', error);
    res.status(500).json({ error: 'Failed to save notification' });
  }
});

app.get('/notify', async (_, res) => {
  try {
    const logs = await prisma.notificationLog.findMany();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.listen(3000, () => {
  console.log('notification-service running on port 3000');
});
