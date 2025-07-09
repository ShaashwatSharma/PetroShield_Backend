import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

/* --------------------- Auth Middleware --------------------- */

export interface AuthenticatedRequest extends Request {
  user?: {
    kcId: string;
    roles: string[];
    organizationId?: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.sendStatus(401);
    return;
  }

  const decoded = jwt.decode(token) as any;
  if (!decoded) {
    res.sendStatus(403);
    return;
  }

  const roles = decoded.realm_access?.roles || [];
  const kcId = decoded.sub;

  // Parse organizationId from groups array
  let organizationId = '';
  const groups = decoded.groups || [];
  if (groups.length > 0) {
    // Example: "/Org-1/Admin"
    const groupParts = groups[0].split('/');
    if (groupParts.length >= 2) {
      organizationId = groupParts[1]; // "Org-1"
    }
  }

  req.user = {
    kcId,
    roles,
    organizationId,
  };

  next();
}

function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.sendStatus(403);
      return;
    }
    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));
    if (!hasRole) {
      res.sendStatus(403);
      return;
    }
    next();
  };
}

app.use(authenticateToken);

/* --------------------- Vehicle Endpoints --------------------- */

app.get('/vehicles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;

    if (user?.roles.includes('Super_Admin')) {
      const vehicles = await prisma.vehicle.findMany();
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('Admin')) {
      const vehicles = await prisma.vehicle.findMany({
        where: { organizationId: user.organizationId },
      });
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('Manager')) {
      const vehicles = await prisma.vehicle.findMany({
        where: { managerKcId: user.kcId },
      });
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('Driver')) {
      const vehicles = await prisma.vehicle.findMany({
        where: { driverKcId: user.kcId },
      });
      res.json(vehicles);
      return;
    }

    res.status(403).json({ error: 'Unauthorized' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});
//checked
app.get('/vehicles/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('Super_Admin')
      || (user?.roles.includes('Admin') && vehicle.organizationId === user.organizationId)
      || (user?.roles.includes('Manager') && vehicle.managerKcId === user.kcId)
      || (user?.roles.includes('Driver') && vehicle.driverKcId === user.kcId)
    ) {
      res.json(vehicle);
      return;
    }

    res.status(403).json({ error: 'Unauthorized to access this vehicle' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});
//checked
app.post('/vehicles', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, registrationNumber ,organizationId} = req.body;
    // const organizationId = req.user.organizationId ;

    const vehicle = await prisma.vehicle.create({
      data: { name, registrationNumber, organizationId },
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register vehicle' });
  }
});
//checked
app.put('/vehicles/:id', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});
//checked
app.delete('/vehicles/:id', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('Admin') && vehicle.organizationId !== user.organizationId) {
      console.log(user.organizationId);
      console.log(vehicle.organizationId);
      res.status(403).json({ error: 'Cannot delete vehicle from another org' });
      return;
    }

    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

app.post('/vehicles/:id/assign-Driver', requireRole(['Super_Admin', 'Admin', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign Driver' });
  }
});

/* --------------------- Sensor Endpoints --------------------- */

app.get('/sensors', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;

    if (user?.roles.includes('Super_Admin')) {
      const sensors = await prisma.sensor.findMany();
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('Admin')) {
      const sensors = await prisma.sensor.findMany({ where: { organizationId: user.organizationId } });
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('Manager')) {
      const sensors = await prisma.sensor.findMany({ where: { vehicle: { managerKcId: user.kcId } } });
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('Driver')) {
      const sensors = await prisma.sensor.findMany({ where: { vehicle: { driverKcId: user.kcId } } });
      res.json(sensors);
      return;
    }

    res.status(403).json({ error: 'Unauthorized' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

app.get('/sensors/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
    if (!sensor) {
      res.status(404).json({ error: 'Sensor not found' });
      return;
    }

    if (user?.roles.includes('Super_Admin')
      || (user?.roles.includes('Admin') && sensor.organizationId === user.organizationId)
      || (user?.roles.includes('Manager') && sensor.vehicle?.managerKcId === user.kcId)
      || (user?.roles.includes('Driver') && sensor.vehicle?.driverKcId === user.kcId)
    ) {
      res.json(sensor);
      return;
    }

    res.status(403).json({ error: 'Unauthorized to access this sensor' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor' });
  }
});

app.post('/sensors', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, description } = req.body;
    const organizationId = req.user?.organizationId ?? '';

    const sensor = await prisma.sensor.create({
      data: { name, type, description, organizationId },
    });
    res.json(sensor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register sensor' });
  }
});

app.post('/sensors/:id/assign-vehicle', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vehicleId } = req.body;
    const { user } = req;

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
      res.status(403).json({ error: 'Sensor and Vehicle must belong to the same organization' });
      return;
    }

    const updatedSensor = await prisma.sensor.update({
      where: { id: req.params.id },
      data: { vehicleId },
    });

    res.json({ message: 'Sensor assigned to vehicle successfully', sensor: updatedSensor });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign sensor to vehicle' });
  }
});

app.put('/sensors/:id', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sensor' });
  }
});

app.delete('/sensors/:id', requireRole(['Super_Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sensor' });
  }
});

/* --------------------- Start server --------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vehicle & Sensor Service running on port ${PORT} or 3002 on Host`);
});








