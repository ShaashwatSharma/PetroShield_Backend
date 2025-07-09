import PDFDocument from 'pdfkit';
import { Response } from 'express';

export const streamVehiclePDF = (res: Response, vehicle: any) => {
  const doc = new PDFDocument();
  const buffers: any[] = [];

  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=vehicle-report.pdf');
    res.send(pdfBuffer);
  });

  // PDF content
  doc.fontSize(20).text('Vehicle Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`ID: ${vehicle.id}`);
  doc.text(`Registration: ${vehicle.registration}`);
  doc.text(`Organization ID: ${vehicle.organizationId}`);
  doc.text(`Driver ID: ${vehicle.driverId ?? 'N/A'}`);
  doc.text(`Manager ID: ${vehicle.managerId ?? 'N/A'}`);
  doc.text(`Created At: ${new Date(vehicle.createdAt).toLocaleString()}`);

  doc.end();
};

