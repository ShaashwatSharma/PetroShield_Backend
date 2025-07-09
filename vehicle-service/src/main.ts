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

    if (user?.roles.includes('superadmin')) {
      const vehicles = await prisma.vehicle.findMany();
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('admin')) {
      const vehicles = await prisma.vehicle.findMany({
        where: { organizationId: user.organizationId },
      });
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('manager')) {
      const vehicles = await prisma.vehicle.findMany({
        where: { managerKcId: user.kcId },
      });
      res.json(vehicles);
      return;
    }

    if (user?.roles.includes('driver')) {
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

app.get('/vehicles/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('superadmin')
      || (user?.roles.includes('admin') && vehicle.organizationId === user.organizationId)
      || (user?.roles.includes('manager') && vehicle.managerKcId === user.kcId)
      || (user?.roles.includes('driver') && vehicle.driverKcId === user.kcId)
    ) {
      res.json(vehicle);
      return;
    }

    res.status(403).json({ error: 'Unauthorized to access this vehicle' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

app.post('/vehicles', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, registrationNumber } = req.body;
    const organizationId = req.user?.organizationId ?? '';

    const vehicle = await prisma.vehicle.create({
      data: { name, registrationNumber, organizationId },
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register vehicle' });
  }
});

app.put('/vehicles/:id', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('admin') && vehicle.organizationId !== user.organizationId) {
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

app.delete('/vehicles/:id', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('admin') && vehicle.organizationId !== user.organizationId) {
      res.status(403).json({ error: 'Cannot delete vehicle from another org' });
      return;
    }

    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

app.post('/vehicles/:id/assign-driver', requireRole(['superadmin', 'admin', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverKcId } = req.body;
    const { user } = req;

    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (user?.roles.includes('admin') && vehicle.organizationId !== user.organizationId) {
      res.status(403).json({ error: 'Cannot assign driver to vehicle from another org' });
      return;
    }

    if (user?.roles.includes('manager') && vehicle.managerKcId !== user.kcId) {
      res.status(403).json({ error: 'Cannot assign driver to vehicle not managed by you' });
      return;
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { driverKcId },
    });
    res.json({ message: 'Driver assigned successfully', vehicle: updatedVehicle });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

/* --------------------- Sensor Endpoints --------------------- */

app.get('/sensors', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;

    if (user?.roles.includes('superadmin')) {
      const sensors = await prisma.sensor.findMany();
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('admin')) {
      const sensors = await prisma.sensor.findMany({ where: { organizationId: user.organizationId } });
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('manager')) {
      const sensors = await prisma.sensor.findMany({ where: { vehicle: { managerKcId: user.kcId } } });
      res.json(sensors);
      return;
    }

    if (user?.roles.includes('driver')) {
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

    if (user?.roles.includes('superadmin')
      || (user?.roles.includes('admin') && sensor.organizationId === user.organizationId)
      || (user?.roles.includes('manager') && sensor.vehicle?.managerKcId === user.kcId)
      || (user?.roles.includes('driver') && sensor.vehicle?.driverKcId === user.kcId)
    ) {
      res.json(sensor);
      return;
    }

    res.status(403).json({ error: 'Unauthorized to access this sensor' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor' });
  }
});

app.post('/sensors', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
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

app.post('/sensors/:id/assign-vehicle', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
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

app.put('/sensors/:id', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });
    if (!sensor) {
      res.status(404).json({ error: 'Sensor not found' });
      return;
    }

    if (user?.roles.includes('admin') && sensor.organizationId !== user.organizationId) {
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

app.delete('/sensors/:id', requireRole(['superadmin', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });
    if (!sensor) {
      res.status(404).json({ error: 'Sensor not found' });
      return;
    }

    if (user?.roles.includes('admin') && sensor.organizationId !== user.organizationId) {
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
  console.log(`Vehicle & Sensor Service running on port ${PORT}`);
});





































// import express, { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import dotenv from 'dotenv';
// import cors from 'cors';

// dotenv.config();

// const app = express();
// const prisma = new PrismaClient();

// app.use(express.json());
// app.use(cors());

// /* --------------------- Vehicle Endpoints --------------------- */
// // Get all vehicles
// app.get('/vehicles', async (_req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch vehicles' });
//   }
// });
// // Get vehicle by ID
// app.get('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { id: req.params.id },
//     });
//     if (!vehicle) {
//       res.status(404).json({ error: 'Vehicle not found' });
//       return;
//     }
//     res.json(vehicle);
//     return;
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch vehicle' });
//     return;
//   }
// });
// // Register new vehicle
// app.post('/vehicles', async (req: Request, res: Response) => {
//   try {
//     const { name, model, registrationNumber } = req.body;
//     const vehicle = await prisma.vehicle.create({
//       data: { name, model, registrationNumber },
//     });
//     res.json(vehicle);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to register vehicle' });
//   }
// });
// // Update vehicle info
// app.put('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     const { name, model, registrationNumber } = req.body;
//     const vehicle = await prisma.vehicle.update({
//       where: { id: req.params.id },
//       data: { name, model, registrationNumber },
//     });
//     res.json(vehicle);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to update vehicle' });
//   }
// });
// // Delete vehicle
// app.delete('/vehicles/:id', async (req: Request, res: Response) => {
//   try {
//     await prisma.vehicle.delete({
//       where: { id: req.params.id },
//     });
//     res.json({ message: 'Vehicle deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to delete vehicle' });
//   }
// });
// // Assign driver to vehicle
// app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
//   try {
//     const { driverKcId } = req.body;
//     const vehicle = await prisma.vehicle.update({
//       where: { id: req.params.id },
//       data: { driverKcId },
//     });
//     res.json({ message: 'Driver assigned to vehicle successfully', vehicle });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to assign driver to vehicle' });
//   }
// });
// // Get vehicles assigned to a driver
// app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany({
//       where: { driverKcId: req.params.driverId },
//     });
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch vehicles for driver' });
//   }
// });
// // Get vehicles managed by manager
// app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany({
//       where: { managerKcId: req.params.managerId },
//     });
//     res.json(vehicles);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch vehicles for manager' });
//   }
// });
// /* --------------------- Sensor Endpoints --------------------- */
// // Get all sensors
// app.get('/sensors', async (_req: Request, res: Response) => {
//   try {
//     const sensors = await prisma.sensor.findMany();
//     res.json(sensors);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch sensors' });
//   }
// });
// // Get sensor by ID
// app.get('/sensors/:id', async (req: Request, res: Response) => {
//   try {
//     const sensor = await prisma.sensor.findUnique({
//       where: { id: req.params.id },
//     });
//     if (!sensor){
//       res.status(404).json({ error: 'Sensor not found' });
//       return;
//     }
//     res.json(sensor);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch sensor' });
//     return;
//   }
// });
// // Register sensor
// app.post('/sensors', async (req: Request, res: Response) => {
//   try {
//     const { name, type, description } = req.body;
//     const sensor = await prisma.sensor.create({
//       data: { name, type, description },
//     });
//     res.json(sensor);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to register sensor' });
//   }
// });
// // Update sensor
// app.put('/sensors/:id', async (req: Request, res: Response) => {
//   try {
//     const { name, type, description } = req.body;
//     const sensor = await prisma.sensor.update({
//       where: { id: req.params.id },
//       data: { name, type, description },
//     });
//     res.json(sensor);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to update sensor' });
//   }
// });
// // Delete sensor
// app.delete('/sensors/:id', async (req: Request, res: Response) => {
//   try {
//     await prisma.sensor.delete({
//       where: { id: req.params.id },
//     });
//     res.json({ message: 'Sensor deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to delete sensor' });
//   }
// });
// // Assign sensor to vehicle
// app.post('/sensors/:id/assign-vehicle', async (req: Request, res: Response) => {
//   try {
//     const { vehicleId } = req.body;
//     const sensor = await prisma.sensor.update({
//       where: { id: req.params.id },
//       data: { vehicleId },
//     });
//     res.json({ message: 'Sensor assigned to vehicle successfully', sensor });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to assign sensor to vehicle' });
//   }
// });
// /* --------------------- Start server --------------------- */
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Vehicle & Sensor Service running on port ${PORT} or 3002 on Host`);
// });



































// import express from 'express';
// import { PrismaClient } from '@prisma/client';

// const app = express();
// const prisma = new PrismaClient();
// app.use(express.json());

// app.post('/vehicles', async (req, res) => {
//   try {
//     const { registration, organizationId } = req.body;

//     const vehicle = await prisma.vehicle.create({
//       data: {
//         registration,
//         organizationId,
//       },
//     });

//     res.json(vehicle);
//   } catch (error) {
//     console.error('Error creating vehicle:', error);
//     res.status(500).json({ error: 'Failed to create vehicle' });
//   }
// });

// app.get('/vehicles', async (_, res) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json(vehicles);
//   } catch (error) {
//     console.error('Error fetching vehicles:', error);
//     res.status(500).json({ error: 'Failed to fetch vehicles' });
//   }
// });

// app.listen(3000, () => {
//   console.log('vehicle-service running on port 3000 or 3002 on Host');
// });







































// import app from './app';

// const PORT = process.env.PORT || 3003;

// // app.listen(PORT, () => {
// //   console.log(`Vehicle Management Service is running on port ${PORT}`);
// // });



// app.listen(3000, () => {
//   console.log('vehicle-service running on port 3000 or 3002 on Host');
// });




























// // import express, { Request, Response } from 'express';
// // import { PrismaClient } from '@prisma/client';

// // const prisma = new PrismaClient();
// // const app = express();
// // app.use(express.json());

// // /**
// //  * GET /vehicles
// //  * List all vehicles
// //  */
// // app.get('/vehicles', async (_req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany();
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles' });
// //   }
// // });

// // /**
// //  * GET /vehicles/:id
// //  * Get vehicle by ID
// //  */
// // app.get('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     const vehicle = await prisma.vehicle.findUnique({
// //       where: { id: req.params.id },
// //     });
// //     if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
// //     res.json(vehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicle' });
// //   }
// // });

// // /**
// //  * POST /vehicles
// //  * Register new vehicle
// //  */
// // app.post('/vehicles', async (req: Request, res: Response) => {
// //   try {
// //     const vehicle = await prisma.vehicle.create({ data: req.body });
// //     res.status(201).json(vehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle registration failed' });
// //   }
// // });

// // /**
// //  * PUT /vehicles/:id
// //  * Update vehicle info
// //  */
// // app.put('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     const updatedVehicle = await prisma.vehicle.update({
// //       where: { id: req.params.id },
// //       data: req.body,
// //     });
// //     res.json(updatedVehicle);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle update failed' });
// //   }
// // });

// // /**
// //  * DELETE /vehicles/:id
// //  * Delete vehicle
// //  */
// // app.delete('/vehicles/:id', async (req: Request, res: Response) => {
// //   try {
// //     await prisma.vehicle.delete({ where: { id: req.params.id } });
// //     res.json({ message: 'Vehicle deleted successfully' });
// //   } catch (error) {
// //     res.status(500).json({ error: 'Vehicle deletion failed' });
// //   }
// // });

// // /**
// //  * POST /vehicles/:id/assign-driver
// //  * Assign driver to vehicle
// //  */
// // app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
// //   try {
// //     const { driverId } = req.body;
// //     const vehicle = await prisma.vehicle.update({
// //       where: { id: req.params.id },
// //       data: { driverId },
// //     });
// //     res.json({ message: 'Driver assigned successfully', vehicle });
// //   } catch (error) {
// //     res.status(500).json({ error: 'Failed to assign driver' });
// //   }
// // });

// // /**
// //  * GET /vehicles/driver/:driverId
// //  * Vehicles assigned to driver
// //  */
// // app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany({
// //       where: { driverId: req.params.driverId },
// //     });
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles for driver' });
// //   }
// // });

// // /**
// //  * GET /vehicles/manager/:managerId
// //  * Vehicles managed by manager
// //  */
// // app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
// //   try {
// //     const vehicles = await prisma.vehicle.findMany({
// //       where: { managerId: req.params.managerId },
// //     });
// //     res.json(vehicles);
// //   } catch (error) {
// //     res.status(500).json({ error: 'Could not fetch vehicles for manager' });
// //   }
// // });

// // // Start server
// // const PORT = process.env.PORT || 3003;
// // app.listen(PORT, () => {
// //   console.log(`Vehicle Management Service is running on port ${PORT}`);
// // });














// import express, { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';

// const app = express();
// const prisma = new PrismaClient();
// app.use(express.json());

// /**
//  * GET /vehicles
//  */
// app.get('/vehicles', async (_req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany();
//   res.json(vehicles);
// });

// /**
//  * GET /vehicles/:id
//  */
// app.get('/vehicles/:id', async (req: Request, res: Response) => {
//   const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
//   if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
//   res.json(vehicle);
// });

// /**
//  * POST /vehicles
//  */
// app.post('/vehicles', async (req: Request, res: Response) => {
//   const vehicle = await prisma.vehicle.create({ data: req.body });
//   res.status(201).json(vehicle);
// });

// /**
//  * PUT /vehicles/:id
//  */
// app.put('/vehicles/:id', async (req: Request, res: Response) => {
//   const updatedVehicle = await prisma.vehicle.update({
//     where: { id: req.params.id },
//     data: req.body,
//   });
//   res.json(updatedVehicle);
// });

// /**
//  * DELETE /vehicles/:id
//  */
// app.delete('/vehicles/:id', async (req: Request, res: Response) => {
//   await prisma.vehicle.delete({ where: { id: req.params.id } });
//   res.json({ message: 'Vehicle deleted' });
// });

// /**
//  * POST /vehicles/:id/assign-driver
//  */
// app.post('/vehicles/:id/assign-driver', async (req: Request, res: Response) => {
//   const { driverId } = req.body;
//   const vehicle = await prisma.vehicle.update({
//     where: { id: req.params.id },
//     data: { driverId },
//   });
//   res.json({ message: 'Driver assigned', vehicle });
// });

// /**
//  * GET /vehicles/driver/:driverId
//  */
// app.get('/vehicles/driver/:driverId', async (req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany({ where: { driverId: req.params.driverId } });
//   res.json(vehicles);
// });

// /**
//  * GET /vehicles/manager/:managerId
//  */
// app.get('/vehicles/manager/:managerId', async (req: Request, res: Response) => {
//   const vehicles = await prisma.vehicle.findMany({ where: { managerId: req.params.managerId } });
//   res.json(vehicles);
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Vehicle service running on port ${PORT} or 3002 on host`);
// });