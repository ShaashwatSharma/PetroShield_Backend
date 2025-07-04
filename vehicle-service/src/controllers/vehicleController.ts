import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';

const prisma = new PrismaClient();

export const generateVehiclesPDF = async (req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany();
    generateVehicleReportPDF(vehicles, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

// GET /vehicles/:id
export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching vehicle' });
  }
};

// POST /vehicles
export const registerVehicle = async (req: Request, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.create({ data: req.body });
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Vehicle registration failed', details: error });
  }
};



//GET /vehicles
export const getAllVehicles = async (_req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany();
    res.status(200).json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch vehicles' });
  }
};


// PUT /vehicles/:id
export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Vehicle update failed' });
  }
};

// DELETE /vehicles/:id
export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Vehicle deletion failed' });
  }
};
// POST /vehicles/:id/assign-driver
export const assignDriver = async (req: Request, res: Response) => {
  const { driverId } = req.body;
  try {
    const updated = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { driverId },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign driver' });
  }
};

// GET /vehicles/driver/:driverId
export const getVehiclesByDriver = async (req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { driverId: req.params.driverId },
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching vehicles for driver' });
  }
};

// GET /vehicles/manager/:managerId
export const getVehiclesByManager = async (req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { managerId: req.params.managerId },
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching vehicles for manager' });
  }
};