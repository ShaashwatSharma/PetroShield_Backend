import { Request, Response } from 'express';
import axios from 'axios';
import { generatePDFReport } from '../utils/generateReportPDF';

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { data: logs } = await axios.get('http://fuel-theft-service:3000/fuel-logs');

    const formattedLogs = logs.map((log: any) => ({
      date: log.date || 'N/A',
      vehicle: log.vehicleId || 'Unknown',
      fuelUsed: log.fuelAmount || 0,
      location: log.location || 'Unknown'
    }));

    const data = {
      organization: 'PetroSafe Pvt. Ltd.',
      reportMadeBy: 'Admin',
      logs: formattedLogs,
      pieData: JSON.stringify({
        labels: ['Diesel', 'Petrol'],
        datasets: [{ data: [120, 80], backgroundColor: ['#007BFF', '#FFC107'] }]
      }),
      lineData: JSON.stringify({
        labels: formattedLogs.map((l:any) => l.date),
        datasets: [{
          label: 'Fuel Usage (L)',
          data: formattedLogs.map((l:any) => l.fuelUsed),
          backgroundColor: '#28a745'
        }]
      }),
      description: 'Fuel usage and anomalies report for this period.'
    };

    const pdf = await generatePDFReport(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err: any) {
    console.error('PDF generation failed:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
};




export const downloadReportPDF = async (req: Request, res: Response) => {
  try {
    const { data: logs } = await axios.get('http://fuel-theft-service:3000/fuel-logs');

    const formattedLogs = logs.map((log: any) => ({
      date: log.date || 'N/A',
      vehicle: log.vehicleId || 'Unknown',
      fuelUsed: log.fuelAmount || 0,
      location: log.location || 'Unknown'
    }));

    const data = {
      organization: 'PetroSafe Pvt. Ltd.',
      reportMadeBy: 'Admin',
      logs: formattedLogs,
      pieData: JSON.stringify({
        labels: ['Diesel', 'Petrol'],
        datasets: [{ data: [120, 80], backgroundColor: ['#007BFF', '#FFC107'] }]
      }),
      lineData: JSON.stringify({
        labels: formattedLogs.map((l: any) => l.date),
        datasets: [{
          label: 'Fuel Usage (L)',
          data: formattedLogs.map((l: any) => l.fuelUsed),
          backgroundColor: '#28a745'
        }]
      }),
      description: 'Fuel usage and anomalies report for this period.'
    };

    const pdfBuffer = await generatePDFReport(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=fuel-report.pdf');
    res.send(pdfBuffer);

  } catch (err: any) {
    console.error(' PDF download failed:', err.message);
    res.status(500).json({ error: 'Failed to download PDF', details: err.message });
  }
};
