import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

export const getAllVehicles = async (req: AuthenticatedRequest, res: Response) => {
  const { user } = req;
  try {
    if (user?.roles.includes('Super_Admin')) {
      const vehicles = await prisma.vehicle.findMany();
      res.json(vehicles);
      return;
    }
    if (user?.roles.includes('Admin')) {
      const vehicles = await prisma.vehicle.findMany({ where: { organizationId: user.organizationId } });
      res.json(vehicles);
      return;
    }
    if (user?.roles.includes('Manager')) {
      const vehicles = await prisma.vehicle.findMany({ where: { managerKcId: user.kcId } });
      res.json(vehicles);
      return;
    }
    if (user?.roles.includes('Driver')) {
      const vehicles = await prisma.vehicle.findMany({ where: { driverKcId: user.kcId } });
       res.json(vehicles);
       return;
    }
    res.status(403).json({ error: 'Unauthorized' });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

export const getVehicleById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) { 
        res.status(404).json({ error: 'Vehicle not found' });
        return;
    }

    if (
      user?.roles.includes('Super_Admin') ||
      (user?.roles.includes('Admin') && vehicle.organizationId === user.organizationId) ||
      (user?.roles.includes('Manager') && vehicle.managerKcId === user.kcId) ||
      (user?.roles.includes('Driver') && vehicle.driverKcId === user.kcId)
    ) {
       res.json(vehicle);
       return;
    }

    res.status(403).json({ error: 'Unauthorized to access this vehicle' });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
};

export const createVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, registrationNumber, organizationId } = req.body;
    const vehicle = await prisma.vehicle.create({
      data: { name, registrationNumber, organizationId },
    });
    res.json(vehicle);
  } catch {
    res.status(500).json({ error: 'Failed to register vehicle' });
  }
};

export const updateVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) { 
        res.status(404).json({ error: 'Vehicle not found' });
        return;
    }

    if (user?.roles.includes('Admin') && vehicle.organizationId !== user.organizationId) {
       res.status(403).json({ error: 'Cannot update vehicle from another org' });
       return;
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updatedVehicle);
  } catch {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

export const deleteVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
         res.status(404).json({ error: 'Vehicle not found' });
         return;
    }
    if (user?.roles.includes('Admin') && vehicle.organizationId !== user.organizationId) {
        res.status(403).json({ error: 'Cannot delete vehicle from another org' });
        return;
    }

    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehicle deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};

export const assignDriver = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverKcId } = req.body;
    const { user } = req;

    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) { 
        res.status(404).json({ error: 'Vehicle not found' });
        return;
    }

    if (user?.roles.includes('Admin') && vehicle.organizationId !== user.organizationId) {
       res.status(403).json({ error: 'Cannot assign Driver to vehicle from another org' });
       return;
    }

    if (user?.roles.includes('Manager') && vehicle.managerKcId !== user.kcId) {
       res.status(403).json({ error: 'Cannot assign Driver to vehicle not managed by you' });
       return;
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { driverKcId },
    });
    res.json({ message: 'Driver assigned successfully', vehicle: updatedVehicle });
  } catch {
    res.status(500).json({ error: 'Failed to assign Driver' });
  }
};
