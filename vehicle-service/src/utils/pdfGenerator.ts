import PDFDocument from 'pdfkit';
import { Vehicle } from '@prisma/client';

export function generateVehicleReportPDF(vehicles: Vehicle[], res: any) {
  const doc = new PDFDocument();

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=vehicles.pdf');

  doc.pipe(res);

  doc.fontSize(20).text('Vehicle Report', { underline: true });
  doc.moveDown();

  vehicles.forEach((vehicle, index) => {
    doc.fontSize(12).text(
      `${index + 1}. Vehicle ID: ${vehicle.id}
   Registration: ${vehicle.registration}
   Org ID: ${vehicle.organizationId}
   Manager ID: ${vehicle.managerId ?? 'N/A'}
   Driver ID: ${vehicle.driverId ?? 'N/A'}`
    );
    doc.moveDown();
  });

  doc.end();
}
