import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

// GET /sensors
export const getAllSensors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    if (user?.roles.includes('Super_Admin')) {
      const sensors = await prisma.sensor.findMany();
       res.json(sensors);
       return;
    }

    if (user?.roles.includes('Admin')) {
      const sensors = await prisma.sensor.findMany({
        where: { organizationId: user.organizationId },
      });
       res.json(sensors);
       return;
    }

    if (user?.roles.includes('Manager')) {
      const sensors = await prisma.sensor.findMany({
        where: { vehicle: { managerKcId: user.kcId } },
      });
       res.json(sensors);
       return;
    }

    if (user?.roles.includes('Driver')) {
      const sensors = await prisma.sensor.findMany({
        where: { vehicle: { driverKcId: user.kcId } },
      });
       res.json(sensors);
       return;
    }

     res.status(403).json({ error: 'Unauthorized' });
     return;
  } catch {
     res.status(500).json({ error: 'Failed to fetch sensors' });
     return;
  }
};

// GET /sensors/:id
export const getSensorById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const sensor = await prisma.sensor.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });

    if (!sensor) { 
        res.status(404).json({ error: 'Sensor not found' });
        return;
    }


    const canAccess =
      user?.roles.includes('Super_Admin') ||
      (user?.roles.includes('Admin') && sensor.organizationId === user.organizationId) ||
      (user?.roles.includes('Manager') && sensor.vehicle?.managerKcId === user.kcId) ||
      (user?.roles.includes('Driver') && sensor.vehicle?.driverKcId === user.kcId);

    if (!canAccess) { 
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }

     res.json(sensor);
     return;
  } catch {
     res.status(500).json({ error: 'Failed to fetch sensor' });
     return;
  }
};

// POST /sensors
export const createSensor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, description } = req.body;
    const organizationId = req.user?.organizationId ?? '';

    const sensor = await prisma.sensor.create({
      data: { name, type, description, organizationId },
    });
    res.json(sensor);
  } catch {
    res.status(500).json({ error: 'Failed to register sensor' });
  }
};

// POST /sensors/:id/assign-vehicle
export const assignSensorToVehicle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vehicleId } = req.body;

    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });
    if (!sensor) { 
        res.status(404).json({ error: 'Sensor not found' });
        return;
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
         res.status(404).json({ error: 'Vehicle not found' });
         return;
        }

    if (sensor.organizationId !== vehicle.organizationId) {
       res.status(403).json({ error: 'Sensor and Vehicle must belong to same org' });
       return;
    }

    const updatedSensor = await prisma.sensor.update({
      where: { id: req.params.id },
      data: { vehicleId },
    });

     res.json({ message: 'Sensor assigned to vehicle', sensor: updatedSensor });
     return;
  } catch {
     res.status(500).json({ error: 'Failed to assign sensor' });
     return;
  }
};

// PUT /sensors/:id
export const updateSensor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });

    if (!sensor) {
         res.status(404).json({ error: 'Sensor not found' });
         return;
    }

    if (user?.roles.includes('Admin') && sensor.organizationId !== user.organizationId) {
       res.status(403).json({ error: 'Cannot update sensor from another org' });
       return;
    }

    const updatedSensor = await prisma.sensor.update({
      where: { id: req.params.id },
      data: req.body,
    });
     res.json(updatedSensor);
     return;
  } catch {
     res.status(500).json({ error: 'Failed to update sensor' });
     return;
  }
};

// DELETE /sensors/:id
export const deleteSensor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });

    if (!sensor) {
         res.status(404).json({ error: 'Sensor not found' });
         return;
    }

    if (user?.roles.includes('Admin') && sensor.organizationId !== user.organizationId) {
       res.status(403).json({ error: 'Cannot delete sensor from another org' });
       return;
    }

    await prisma.sensor.delete({ where: { id: req.params.id } });
     res.json({ message: 'Sensor deleted successfully' });
     return;
  } catch {
     res.status(500).json({ error: 'Failed to delete sensor' });
     return;
  }
};
