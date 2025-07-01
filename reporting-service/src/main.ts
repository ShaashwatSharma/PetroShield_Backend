import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

// Get all incident reports
app.get('/reports/incidents', async (_, res) => {
  try {
    const reports = await prisma.incidentReport.findMany();
    res.json(reports);
  } catch (error) {
    console.error('Error fetching incident reports:', error);
    res.status(500).json({ error: 'Failed to fetch incident reports' });
  }
});

// Create a new incident report
app.post('/reports/incidents', async (req, res) => {
  try {
    const { theftAlertId, userId, reportDetails } = req.body;

    const report = await prisma.incidentReport.create({
      data: {
        theftAlertId,
        userId,
        reportDetails,
      },
    });

    res.json(report);
  } catch (error) {
    console.error('Error creating incident report:', error);
    res.status(500).json({ error: 'Failed to create incident report' });
  }
});

app.listen(3000, () => {
  console.log('reporting-service running on port 3000');
});
