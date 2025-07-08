import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { jwtDecode } from 'jwt-decode';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

interface KeycloakDecodedToken {
  realm_access?: { roles: string[] };
  groups?: string[];
  preferred_username?: string;
  sub?: string;
  [key: string]: any;
}

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;
const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

async function getAdminToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

  const response = await axios.post(
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

async function getUserGroups(kcId: string, adminToken: string): Promise<string[]> {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${kcId}/groups`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data.map((g: any) => g.path);
}

async function getOrCreateGroup(groupPath: string, adminToken: string): Promise<string> {
  const parts = groupPath.split('/').filter(Boolean);
  let parentId: string | undefined = undefined;
  let currentPath = '';

  for (const currentName of parts) {
    currentPath += '/' + currentName;

    let childrenGroups: any[] = [];
    if (parentId) {
      const resp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      childrenGroups = resp.data;
    } else {
      const resp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      childrenGroups = resp.data;
    }

    let existingGroup = childrenGroups.find((g: any) => g.name === currentName);

    if (!existingGroup) {
      if (parentId) {
        await axios.post(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, { name: currentName }, { headers: { Authorization: `Bearer ${adminToken}` } });
      } else {
        await axios.post(`${KEYCLOAK_ADMIN_API_URL}/groups`, { name: currentName }, { headers: { Authorization: `Bearer ${adminToken}` } });
      }

      const updatedGroups = parentId
        ? await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, { headers: { Authorization: `Bearer ${adminToken}` } })
        : await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, { headers: { Authorization: `Bearer ${adminToken}` } });

      childrenGroups = updatedGroups.data;
      existingGroup = childrenGroups.find((g: any) => g.name === currentName);

      if (!existingGroup) throw new Error(`Could not find group after creating: ${currentPath}`);
    }

    parentId = existingGroup.id;
  }

  return parentId!;
}

const checkRole = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader){
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwtDecode<KeycloakDecodedToken>(token);
      const roles = decoded.realm_access?.roles || [];
      const hasRole = requiredRoles.some(role => roles.includes(role));

      if (!hasRole) {
        res.status(403).json({ error: 'Forbidden: insufficient role' });
        return;
      }

      (req as any).user = decoded;
      next();
    } catch (err) {
      console.error('Token decode error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};

async function getUserById(keycloakUserId: string, adminToken: string) {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${keycloakUserId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data;
}

async function deleteUser(userId: string, adminToken: string) {
  await axios.delete(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

async function createUser(username: string, password: string, adminToken: string): Promise<string> {
  await axios.post(
    `${KEYCLOAK_ADMIN_API_URL}/users`,
    {
      username,
      email: username,
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const users = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users?username=${username}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return users.data[0].id;
}

async function getRoleByName(roleName: string, adminToken: string) {
  const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/roles/${roleName}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data;
}

async function assignRoleToUser(userId: string, role: any, adminToken: string) {
  await axios.post(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/role-mappings/realm`, [role], {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

app.post('/create-admin', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
  try {
    const { username, password, org } = req.body;
    if (!org) {
      res.status(400).json({ error: 'Organization (org) is required' });
      return;
    }

    const adminToken = await getAdminToken();
    const userId = await createUser(username, password, adminToken);

    const orgGroupPath = `/${org}/Admin`;
    const groupId = await getOrCreateGroup(orgGroupPath, adminToken);

    await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    const role = await getRoleByName('Admin', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    res.json({ message: 'Admin created successfully', userId });
  } catch (error: any) {
    console.error('Error creating admin:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

app.post('/create-manager', checkRole(['Super_Admin', 'Admin']), async (req: Request, res: Response) => {
  try {
    const { username, password, org, adminKcId } = req.body;
    if (!org || !adminKcId) {
      res.status(400).json({ error: 'Organization (org) and adminKcId are required' });
      return;
    }

    const adminToken = await getAdminToken();
    const userId = await createUser(username, password, adminToken);

    const groupPath = `/${org}/Admin/Manager`;
    const groupId = await getOrCreateGroup(groupPath, adminToken);

    await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    const role = await getRoleByName('Manager', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    await prisma.adminManager.create({ data: { adminKcId, managerKcId: userId } });

    res.json({ message: 'Manager created and assigned successfully', userId });
  } catch (error: any) {
    console.error('Error creating manager:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create manager' });
  }
});

app.post('/create-driver', checkRole(['Super_Admin', 'Admin', 'Manager']), async (req: Request, res: Response) => {
  try {
    const { username, password, org, managerKcId } = req.body;
    if (!org || !managerKcId){
      res.status(400).json({ error: 'Organization (org) and managerKcId are required' });
      return;
    }

    const adminToken = await getAdminToken();
    const userId = await createUser(username, password, adminToken);

    const groupPath = `/${org}/Admin/Manager/Driver`;
    const groupId = await getOrCreateGroup(groupPath, adminToken);

    await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    const role = await getRoleByName('Driver', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    await prisma.managerDriver.create({ data: { managerKcId, driverKcId: userId } });

    res.json({ message: 'Driver created and assigned successfully', userId });
  } catch (error: any) {
    console.error('Error creating driver:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

app.post('/assign-manager', checkRole(['Admin', 'Super_Admin']), async (req: Request, res: Response) => {
  try {
    const { adminKcId, managerKcId } = req.body;
    if (!adminKcId || !managerKcId){
      res.status(400).json({ error: 'adminKcId and managerKcId are required' });
      return;
    }

    const adminToken = await getAdminToken();
    const adminGroups = await getUserGroups(adminKcId, adminToken);
    const managerGroups = await getUserGroups(managerKcId, adminToken);

    const adminOrg = adminGroups.find(g => g.startsWith('/Org'));
    const managerOrg = managerGroups.find(g => g.startsWith('/Org'));

    if (!adminOrg || !managerOrg || adminOrg.split('/')[1] !== managerOrg.split('/')[1]) {
      res.status(400).json({ error: 'Admin and Manager must belong to the same org' });
      return;
    }

    const existingAssignment = await prisma.adminManager.findFirst({ where: { managerKcId } });
    if (existingAssignment) {
      await prisma.adminManager.update({ where: { id: existingAssignment.id }, data: { adminKcId } });
    } else {
      await prisma.adminManager.create({ data: { adminKcId, managerKcId } });
    }

    res.json({ message: 'Manager assigned/reassigned successfully', org: adminOrg });
  } catch (error: any) {
    console.error('Error assigning manager:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to assign manager' });
  }
});

app.post('/assign-driver', checkRole(['Admin', 'Manager', 'Super_Admin']), async (req: Request, res: Response) => {
  try {
    const { managerKcId, driverKcId } = req.body;
    const adminToken = await getAdminToken();

    const driverGroups = await getUserGroups(driverKcId, adminToken);
    const managerGroups = await getUserGroups(managerKcId, adminToken);

    const driverOrg = driverGroups.find(g => g.startsWith('/Org'));
    const managerOrg = managerGroups.find(g => g.startsWith('/Org'));

    if (!driverOrg || !managerOrg || driverOrg.split('/')[1] !== managerOrg.split('/')[1]) {
      res.status(400).json({ error: 'Driver and Manager must belong to the same org' });
      return;
    }

    const existing = await prisma.managerDriver.findFirst({ where: { driverKcId } });
    if (existing) {
      await prisma.managerDriver.update({ where: { id: existing.id }, data: { managerKcId } });
    } else {
      await prisma.managerDriver.create({ data: { managerKcId, driverKcId } });
    }

    res.json({ message: 'Driver assigned/reassigned successfully', org: driverOrg });
  } catch (error: any) {
    console.error('Error assigning driver:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

app.get('/my-managers', checkRole(['Admin']), async (req: Request, res: Response) => {
  try {
    const kcUser = (req as any).user as KeycloakDecodedToken;
    const adminKcId = kcUser.sub;
    const adminToken = await getAdminToken();

    const assignments = await prisma.adminManager.findMany({ where: { adminKcId } });
    const managers = await Promise.all(assignments.map(rel => getUserById(rel.managerKcId, adminToken)));

    res.json(managers);
  } catch (error: any) {
    console.error('Error fetching managers:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

app.get('/my-drivers', checkRole(['Manager']), async (req: Request, res: Response) => {
  try {
    const kcUser = (req as any).user as KeycloakDecodedToken;
    const managerKcId = kcUser.sub;
    const adminToken = await getAdminToken();

    const assignments = await prisma.managerDriver.findMany({ where: { managerKcId } });
    const drivers = await Promise.all(assignments.map(rel => getUserById(rel.driverKcId, adminToken)));

    res.json(drivers);
  } catch (error: any) {
    console.error('Error fetching drivers:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

app.get('/my-drivers-as-admin', checkRole(['Admin']), async (req: Request, res: Response) => {
  try {
    const kcUser = (req as any).user as KeycloakDecodedToken;
    const adminKcId = kcUser.sub;
    const adminToken = await getAdminToken();

    const managers = await prisma.adminManager.findMany({ where: { adminKcId } });
    let allDriverIds: string[] = [];

    for (const manager of managers) {
      const drivers = await prisma.managerDriver.findMany({ where: { managerKcId: manager.managerKcId } });
      allDriverIds.push(...drivers.map(d => d.driverKcId));
    }

    const drivers = await Promise.all(allDriverIds.map(driverId => getUserById(driverId, adminToken)));
    res.json(drivers);
  } catch (error: any) {
    console.error('Error fetching drivers as admin:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch drivers as admin' });
  }
});

app.get('/my-manager/:managerKcId', checkRole(['Admin']), async (req: Request, res: Response) => {
  try {
    const kcUser = (req as any).user as KeycloakDecodedToken;
    const adminKcId = kcUser.sub;
    const { managerKcId } = req.params;
    const adminToken = await getAdminToken();

    const assignment = await prisma.adminManager.findFirst({ where: { adminKcId, managerKcId } });
    if (!assignment) {
      res.status(403).json({ error: 'This manager is not assigned to you' });
      return;
    }

    const manager = await getUserById(managerKcId, adminToken);
    const driverAssignments = await prisma.managerDriver.findMany({ where: { managerKcId } });
    const drivers = await Promise.all(driverAssignments.map(rel => getUserById(rel.driverKcId, adminToken)));

    res.json({ manager, drivers });
  } catch (error: any) {
    console.error('Error fetching manager and drivers:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch manager and drivers' });
  }
});

app.get('/users/:id', checkRole(['Super_Admin', 'Admin', 'Manager', 'Driver']), async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const adminToken = await getAdminToken();
    const user = await getUserById(userId, adminToken);
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/org-users', checkRole(['Admin']), async (req: Request, res: Response) => {
  try {
    const kcUser = (req as any).user as KeycloakDecodedToken;
    const adminKcId = kcUser.sub;
    const adminToken = await getAdminToken();

    // Find managers under this admin from DB
    const managers = await prisma.adminManager.findMany({ where: { adminKcId } });

    let allManagerKcIds: string[] = managers.map(m => m.managerKcId);
    let allDriverKcIds: string[] = [];

    for (const manager of managers) {
      const drivers = await prisma.managerDriver.findMany({ where: { managerKcId: manager.managerKcId } });
      allDriverKcIds.push(...drivers.map(d => d.driverKcId));
    }

    // Fetch manager user details from Keycloak
    const managerDetails = await Promise.all(allManagerKcIds.map(id => getUserById(id, adminToken)));
    const driverDetails = await Promise.all(allDriverKcIds.map(id => getUserById(id, adminToken)));

    res.json({
      managers: managerDetails,
      drivers: driverDetails,
    });
  } catch (error: any) {
    console.error('Error fetching org users:', error);
    res.status(500).json({ error: 'Failed to fetch org users' });
  }
});

app.delete('/users/:id', checkRole(['Super_Admin', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const adminToken = await getAdminToken();

    const kcUser = (req as any).user as KeycloakDecodedToken;
    const requesterRoles = kcUser.realm_access?.roles || [];

    if (requesterRoles.includes('Super_Admin')) {
      // Super_Admin can delete any user directly
      await deleteUser(userId, adminToken);
      res.json({ message: 'User deleted successfully by Super_Admin' });
      return;
    }

    if (requesterRoles.includes('Admin')) {
      // Admin can delete only users in their org
      const requesterId = kcUser.sub;

      // Fetch target user groups
      const targetGroups = await getUserGroups(userId, adminToken);
      const targetOrg = targetGroups.find(g => g.startsWith('/'));

      if (!targetOrg) {
        res.status(400).json({ error: 'Target user has no org group' });
        return;
      }

      // Fetch admin groups
      const adminGroups = await getUserGroups(requesterId, adminToken);
      const adminOrg = adminGroups.find(g => g.startsWith('/'));

      if (!adminOrg) {
        res.status(400).json({ error: 'Admin has no org group' });
        return;
      }

      if (targetOrg.split('/')[1] !== adminOrg.split('/')[1]) {
        res.status(403).json({ error: 'You cannot delete a user from another org' });
        return;
      }

      // Delete user
      await deleteUser(userId, adminToken);
      res.json({ message: 'User deleted successfully by Admin in their org' });
      return;
    }

    // Should not reach here
    res.status(403).json({ error: 'Forbidden' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ user-management-service running on port ${PORT} or 3001 on host`);
});


















































// import express, { Request, Response, NextFunction } from 'express';
// import axios from 'axios';
// import dotenv from 'dotenv';
// import { jwtDecode } from 'jwt-decode';
// import { PrismaClient } from '@prisma/client';

// dotenv.config();

// const app = express();
// app.use(express.json());

// const prisma = new PrismaClient();

// interface KeycloakDecodedToken {
//   realm_access?: { roles: string[] };
//   groups?: string[];
//   preferred_username?: string;
//   sub?: string;
//   [key: string]: any;
// }

// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;
// const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

// // ---------------------------- Helper functions ----------------------------

// async function getAdminToken(): Promise<string> {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(
//     `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
//     params,
//     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//   );

//   return response.data.access_token;
// }

// async function getUserGroups(kcId: string, adminToken: string): Promise<string[]> {
//   const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${kcId}/groups`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
//   return res.data.map((g: any) => g.path);
// }

// async function getOrCreateGroup(groupPath: string, adminToken: string): Promise<string> {
//   const parts = groupPath.split('/').filter(Boolean);

//   let parentId: string | undefined = undefined;
//   let currentPath = '';

//   for (let i = 0; i < parts.length; i++) {
//     const currentName = parts[i];
//     currentPath = currentPath + '/' + currentName;

//     let childrenGroups: any[] = [];

//     if (parentId) {
//       const childrenResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
//         headers: { Authorization: `Bearer ${adminToken}` },
//       });
//       childrenGroups = childrenResp.data;
//     } else {
//       const topResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
//         headers: { Authorization: `Bearer ${adminToken}` },
//       });
//       childrenGroups = topResp.data;
//     }

//     let existingGroup = childrenGroups.find((g: any) => g.name === currentName);

//     if (!existingGroup) {
//       if (parentId) {
//         await axios.post(
//           `${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`,
//           { name: currentName },
//           { headers: { Authorization: `Bearer ${adminToken}` } }
//         );
//       } else {
//         await axios.post(
//           `${KEYCLOAK_ADMIN_API_URL}/groups`,
//           { name: currentName },
//           { headers: { Authorization: `Bearer ${adminToken}` } }
//         );
//       }

//       if (parentId) {
//         const updatedChildrenResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
//           headers: { Authorization: `Bearer ${adminToken}` },
//         });
//         childrenGroups = updatedChildrenResp.data;
//       } else {
//         const updatedTopResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
//           headers: { Authorization: `Bearer ${adminToken}` },
//         });
//         childrenGroups = updatedTopResp.data;
//       }

//       existingGroup = childrenGroups.find((g: any) => g.name === currentName);

//       if (!existingGroup) {
//         throw new Error(`Could not find group after creating it: ${currentPath}`);
//       }
//     }

//     parentId = existingGroup.id;
//   }

//   return parentId!;
// }


// const checkRole = (requiredRoles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader) {
//         res.status(401).json({ error: 'No token provided' });
//         return;
//       }

//       const token = authHeader.split(' ')[1];
//       const decoded = jwtDecode<KeycloakDecodedToken>(token);
//       const roles = decoded.realm_access?.roles || [];
//       const hasRole = requiredRoles.some(role => roles.includes(role));

//       if (!hasRole) {
//         res.status(403).json({ error: 'Forbidden: insufficient role' });
//         return;
//       }

//       (req as any).user = decoded;
//       next();
//     } catch (err) {
//       console.error('Token decode error:', err);
//       res.status(401).json({ error: 'Invalid token' });
//     }
//   };
// };

// async function getUserById(keycloakUserId: string, adminToken: string) {
//   const res = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${keycloakUserId}`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
//   return res.data;
// }

// async function deleteUser(userId: string, adminToken: string) {
//   await axios.delete(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
// }

// async function createUser(username: string, password: string, adminToken: string): Promise<string> {
//   await axios.post(
//     `${KEYCLOAK_ADMIN_API_URL}/users`,
//     {
//       username,
//       email: username,
//       enabled: true,
//       credentials: [{ type: 'password', value: password, temporary: false }],
//     },
//     { headers: { Authorization: `Bearer ${adminToken}` } }
//   );

//   // Fetch to get the ID
//   const allUsers = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users?username=${username}`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });

//   return allUsers.data[0].id;
// }

// async function getRoleByName(roleName: string, adminToken: string) {
//   const roleResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/roles/${roleName}`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
//   return roleResp.data;
// }

// async function assignRoleToUser(userId: string, role: any, adminToken: string) {
//   await axios.post(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/role-mappings/realm`, [role], {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
// }

// // ---------------------------- Create User endpoints ----------------------------

// app.post('/create-admin', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org } = req.body;
//     if (!org) {
//       res.status(400).json({ error: 'Organization (org) is required' });
//       return;
//     }

//     const adminToken = await getAdminToken();

//     const userId = await createUser(username, password, adminToken);

//     // Create or get org group
//     const orgGroupPath = `/${org}/Admin`;
//     const groupId = await getOrCreateGroup(orgGroupPath, adminToken);

//     // Assign user to group
//     await axios.put(
//       `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
//       {},
//       { headers: { Authorization: `Bearer ${adminToken}` } }
//     );

//     const role = await getRoleByName('Admin', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     res.json({ message: 'Admin created successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating admin:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create admin' });
//   }
// });


// app.post('/create-manager', checkRole(['Super_Admin', 'Admin']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org, adminKcId } = req.body;

//     if (!org || !adminKcId) {
//       res.status(400).json({ error: 'Organization (org) and adminKcId are required' });
//       return;
//     }

//     const adminToken = await getAdminToken();

//     // Create manager user
//     const userId = await createUser(username, password, adminToken);

//     // Create/get group path
//     const groupPath = `/${org}/Admin/Manager`;
//     const groupId = await getOrCreateGroup(groupPath, adminToken);

//     // Assign user to group
//     await axios.put(
//       `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
//       {},
//       { headers: { Authorization: `Bearer ${adminToken}` } }
//     );

//     // Assign role
//     const role = await getRoleByName('Manager', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     // Create relation in DB
//     await prisma.adminManager.create({
//       data: {
//         adminKcId,
//         managerKcId: userId,
//       },
//     });

//     res.json({ message: 'Manager created and assigned successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating manager:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create manager' });
//   }
// });


// app.post('/create-driver', checkRole(['Super_Admin', 'Admin', 'Manager']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org, managerKcId } = req.body;

//     if (!org || !managerKcId) {
//       res.status(400).json({ error: 'Organization (org) and managerKcId are required' });
//       return;
//     }

//     const adminToken = await getAdminToken();

//     // Create driver user
//     const userId = await createUser(username, password, adminToken);

//     // Create/get group path
//     const groupPath = `/${org}/Admin/Manager/Driver`;
//     const groupId = await getOrCreateGroup(groupPath, adminToken);

//     // Assign user to group
//     await axios.put(
//       `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
//       {},
//       { headers: { Authorization: `Bearer ${adminToken}` } }
//     );

//     // Assign role
//     const role = await getRoleByName('Driver', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     // Save local relationship in DB
//     await prisma.managerDriver.create({
//       data: {
//         managerKcId,
//         driverKcId: userId,
//       },
//     });

//     res.json({ message: 'Driver created and assigned successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating driver:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create driver' });
//   }
// });


// // ---------------------------- Assign relationships ----------------------------

// app.post('/assign-manager', checkRole(['Admin', 'Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const { adminKcId, managerKcId } = req.body;
//     if (!adminKcId || !managerKcId) {
//       res.status(400).json({ error: 'adminKcId and managerKcId are required' });
//       return;
//     }

//     const adminToken = await getAdminToken();

//     // Fetch groups
//     const adminGroups = await getUserGroups(adminKcId, adminToken);
//     const managerGroups = await getUserGroups(managerKcId, adminToken);

//     // Find org group
//     const adminOrg = adminGroups.find(g => g.startsWith('/Org'));
//     const managerOrg = managerGroups.find(g => g.startsWith('/Org'));

//     if (!adminOrg || !managerOrg || adminOrg.split('/')[1] !== managerOrg.split('/')[1]) {
//       res.status(400).json({ error: 'Admin and Manager must belong to the same org' });
//       return;
//     }

//     // Check if already assigned
//     const existingAssignment = await prisma.adminManager.findFirst({
//       where: { managerKcId },
//     });

//     if (existingAssignment) {
//       // Update to new admin
//       await prisma.adminManager.update({
//         where: { id: existingAssignment.id },
//         data: { adminKcId },
//       });
//     } else {
//       // Create new assignment
//       await prisma.adminManager.create({
//         data: { adminKcId, managerKcId },
//       });
//     }

//     res.json({ message: 'Manager assigned/reassigned successfully', org: adminOrg });
//     return;
//   } catch (error: any) {
//     console.error('Error assigning manager:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to assign manager' });
//     return;
//   }
// });


// app.post('/assign-driver', checkRole(['Admin', 'Manager', 'Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const { managerKcId, driverKcId } = req.body;
//     const adminToken = await getAdminToken();

//     // Get groups
//     const driverGroups = await getUserGroups(driverKcId, adminToken);
//     const managerGroups = await getUserGroups(managerKcId, adminToken);

//     // Check same org
//     const driverOrg = driverGroups.find(g => g.startsWith('/Org'));
//     const managerOrg = managerGroups.find(g => g.startsWith('/Org'));

//     if (!driverOrg || !managerOrg || driverOrg.split('/')[1] !== managerOrg.split('/')[1]) {
//       res.status(400).json({ error: 'Driver and manager must belong to the same org' });
//       return;
//     }

//     // Check existing assignment
//     const existing = await prisma.managerDriver.findFirst({ where: { driverKcId } });
//     if (existing) {
//       await prisma.managerDriver.update({ where: { id: existing.id }, data: { managerKcId } });
//     } else {
//       await prisma.managerDriver.create({ data: { managerKcId, driverKcId } });
//     }

//     res.json({ message: 'Driver assigned/reassigned successfully', org: driverOrg });
//   } catch (error: any) {
//     console.error('Error assigning driver:', error);
//     res.status(500).json({ error: 'Failed to assign driver' });
//     return;
//   }
// });


// // ---------------------------- Fetch managers & drivers ----------------------------

// app.get('/my-managers', checkRole(['Admin']), async (req: Request, res: Response) => {
//   try {
//     const kcUser = (req as any).user as KeycloakDecodedToken;
//     const adminKcId = kcUser.sub;
//     const adminToken = await getAdminToken();

//     const assignments = await prisma.adminManager.findMany({ where: { adminKcId } });
//     const managers = await Promise.all(assignments.map(rel => getUserById(rel.managerKcId, adminToken)));

//     res.json(managers);
//   } catch (error: any) {
//     console.error('Error fetching managers:', error);
//     res.status(500).json({ error: 'Failed to fetch managers' });
//     return;
//   }
// });

// app.get('/my-drivers', checkRole(['Manager']), async (req: Request, res: Response) => {
//   try {
//     const kcUser = (req as any).user as KeycloakDecodedToken;
//     const managerKcId = kcUser.sub;
//     const adminToken = await getAdminToken();

//     const assignments = await prisma.managerDriver.findMany({ where: { managerKcId } });
//     const drivers = await Promise.all(assignments.map(rel => getUserById(rel.driverKcId, adminToken)));

//     res.json(drivers);
//   } catch (error: any) {
//     console.error('Error fetching drivers:', error);
//     res.status(500).json({ error: 'Failed to fetch drivers' });
//     return;
//   }
// });

// app.get('/my-drivers-as-admin', checkRole(['Admin']), async (req: Request, res: Response) => {
//   try {
//     const kcUser = (req as any).user as KeycloakDecodedToken;
//     const adminKcId = kcUser.sub;
//     const adminToken = await getAdminToken();

//     const managers = await prisma.adminManager.findMany({ where: { adminKcId } });
//     let allDriverIds: string[] = [];

//     for (const manager of managers) {
//       const drivers = await prisma.managerDriver.findMany({ where: { managerKcId: manager.managerKcId } });
//       allDriverIds.push(...drivers.map(d => d.driverKcId));
//     }

//     const drivers = await Promise.all(allDriverIds.map(driverId => getUserById(driverId, adminToken)));
//     res.json(drivers);
//   } catch (error: any) {
//     console.error('Error fetching drivers as admin:', error);
//     res.status(500).json({ error: 'Failed to fetch drivers as admin' });
//   }
// });

// app.get('/my-manager/:managerKcId', checkRole(['Admin']), async (req: Request, res: Response) => {
//   try {
//     const kcUser = (req as any).user as KeycloakDecodedToken;
//     const adminKcId = kcUser.sub;
//     const { managerKcId } = req.params;
//     const adminToken = await getAdminToken();

//     const assignment = await prisma.adminManager.findFirst({ where: { adminKcId, managerKcId } });
//     if (!assignment) {
//       res.status(403).json({ error: 'This manager is not assigned to you' });
//       return;
//     }

//     const manager = await getUserById(managerKcId, adminToken);

//     const driverAssignments = await prisma.managerDriver.findMany({ where: { managerKcId } });
//     const drivers = await Promise.all(driverAssignments.map(rel => getUserById(rel.driverKcId, adminToken)));

//     res.json({ manager, drivers });
//   } catch (error: any) {
//     console.error('Error fetching manager and drivers:', error);
//     res.status(500).json({ error: 'Failed to fetch manager and drivers' });
//   }
// });

// // ---------------------------- User management (fetch & delete) ----------------------------

// app.get('/users/:id', checkRole(['Super_Admin', 'Admin', 'Manager', 'Driver']), async (req: Request, res: Response) => {
//   try {
//     const userId = req.params.id;
//     const adminToken = await getAdminToken();
//     const user = await getUserById(userId, adminToken);
//     res.json(user);
//   } catch (error: any) {
//     console.error('Error fetching user:', error);
//     res.status(500).json({ error: 'Failed to fetch user' });
//   }
// });

// app.delete('/users/:id', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const userId = req.params.id;
//     const adminToken = await getAdminToken();
//     await deleteUser(userId, adminToken);
//     res.json({ message: 'User deleted successfully' });
//   } catch (error: any) {
//     console.error('Error deleting user:', error);
//     res.status(500).json({ error: 'Failed to delete user' });
//   }
// });

// // ---------------------------- Server ----------------------------

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`✅ user-management-service running on port ${PORT} or 3001 on host`);
// });










































































// import express, { Request, Response, NextFunction } from 'express';
// import axios from 'axios';
// import dotenv from 'dotenv';
// import { jwtDecode } from 'jwt-decode';

// dotenv.config();

// const app = express();
// app.use(express.json());

// interface KeycloakDecodedToken {
//   realm_access?: {
//     roles: string[];
//   };
//   groups?: string[];
//   preferred_username?: string;
//   sub?: string;
//   [key: string]: any;
// }

// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

// async function getAdminToken(): Promise<string> {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(
//     `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
//     params,
//     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//   );

//   return response.data.access_token;
// }

// const checkRole = (requiredRoles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader) {
//         res.status(401).json({ error: 'No token provided' });
//         return;
//       }

//       const token = authHeader.split(' ')[1];
//       const decoded = jwtDecode<KeycloakDecodedToken>(token);

//       const roles = decoded.realm_access?.roles || [];
//       const groups = decoded.groups || [];

//       console.log(`Decoded roles: ${roles}`);
//       console.log(`Decoded groups: ${groups}`);

//       const hasRole = requiredRoles.some(role => roles.includes(role));
//       if (!hasRole) {
//         res.status(403).json({ error: 'Forbidden: insufficient role' });
//         return;
//       }

//       (req as any).user = decoded;
//       next();
//     } catch (err) {
//       console.error('Token decode error:', err);
//       res.status(401).json({ error: 'Invalid token' });
//     }
//   };
// };

// async function getOrCreateGroup(groupPath: string, adminToken: string): Promise<string> {
//   const parts = groupPath.split('/').filter(Boolean);

//   let parentId: string | undefined = undefined;
//   let currentPath = '';

//   for (let i = 0; i < parts.length; i++) {
//     const currentName = parts[i];
//     currentPath = currentPath + '/' + currentName;

//     let childrenGroups: any[] = [];

//     if (parentId) {
//       const childrenResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
//         headers: { Authorization: `Bearer ${adminToken}` },
//       });
//       childrenGroups = childrenResp.data;
//     } else {
//       const topResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
//         headers: { Authorization: `Bearer ${adminToken}` },
//       });
//       childrenGroups = topResp.data;
//     }

//     let existingGroup = childrenGroups.find((g: any) => g.name === currentName);

//     if (!existingGroup) {
//       if (parentId) {
//         await axios.post(
//           `${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`,
//           { name: currentName },
//           { headers: { Authorization: `Bearer ${adminToken}` } }
//         );
//       } else {
//         await axios.post(
//           `${KEYCLOAK_ADMIN_API_URL}/groups`,
//           { name: currentName },
//           { headers: { Authorization: `Bearer ${adminToken}` } }
//         );
//       }

//       if (parentId) {
//         const updatedChildrenResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups/${parentId}/children`, {
//           headers: { Authorization: `Bearer ${adminToken}` },
//         });
//         childrenGroups = updatedChildrenResp.data;
//       } else {
//         const updatedTopResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
//           headers: { Authorization: `Bearer ${adminToken}` },
//         });
//         childrenGroups = updatedTopResp.data;
//       }

//       existingGroup = childrenGroups.find((g: any) => g.name === currentName);

//       if (!existingGroup) {
//         throw new Error(`Could not find group after creating it: ${currentPath}`);
//       }
//     }

//     parentId = existingGroup.id;
//   }

//   return parentId!;
// }

// async function getRoleByName(roleName: string, adminToken: string) {
//   const rolesResponse = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/roles/${roleName}`, {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
//   return rolesResponse.data;
// }

// async function assignRoleToUser(userId: string, role: any, adminToken: string) {
//   await axios.post(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/role-mappings/realm`, [role], {
//     headers: { Authorization: `Bearer ${adminToken}` },
//   });
// }

// async function createUser(username: string, password: string, adminToken: string): Promise<string> {
//   const userResp = await axios.post(
//     `${KEYCLOAK_ADMIN_API_URL}/users`,
//     {
//       username,
//       email: username,
//       enabled: true,
//       credentials: [{ type: 'password', value: password, temporary: false }],
//     },
//     { headers: { Authorization: `Bearer ${adminToken}` } }
//   );
//   return userResp.headers.location.split('/').pop();
// }

// // ---------------------------- CREATE ENDPOINTS ----------------------------

// // Create Admin
// app.post('/create-admin', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org } = req.body;
//     const adminToken = await getAdminToken();

//     const userId = await createUser(username, password, adminToken);

//     const orgGroupPath = `/${org}/Admin`;
//     const groupId = await getOrCreateGroup(orgGroupPath, adminToken);

//     await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });

//     const role = await getRoleByName('Admin', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     res.json({ message: 'Admin created successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating admin:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create admin' });
//   }
// });

// // Create Manager
// app.post('/create-manager', checkRole(['Super_Admin', 'Admin']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org } = req.body;
//     const adminToken = await getAdminToken();

//     const userId = await createUser(username, password, adminToken);

//     const groupPath = `/${org}/Admin/Manager`;
//     const groupId = await getOrCreateGroup(groupPath, adminToken);

//     await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });

//     const role = await getRoleByName('Manager', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     res.json({ message: 'Manager created successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating manager:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create manager' });
//   }
// });

// // Create Driver
// app.post('/create-driver', checkRole(['Super_Admin', 'Admin']), async (req: Request, res: Response) => {
//   try {
//     const { username, password, org, managerGroup } = req.body;
//     const adminToken = await getAdminToken();

//     const userId = await createUser(username, password, adminToken);

//     const groupPath = `/${org}/Admin/Manager/${managerGroup}/Driver`;
//     const groupId = await getOrCreateGroup(groupPath, adminToken);

//     await axios.put(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`, {}, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });

//     const role = await getRoleByName('Driver', adminToken);
//     await assignRoleToUser(userId, role, adminToken);

//     res.json({ message: 'Driver created successfully', userId });
//   } catch (error: any) {
//     console.error('Error creating driver:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create driver' });
//   }
// });

// // -------------------------- USER FETCH/DELETE --------------------------

// app.get('/users', checkRole(['Super_Admin', 'Admin', 'Manager', 'Driver']), async (req: Request, res: Response) => {
//   try {
//     const adminToken = await getAdminToken();
//     const kcUser = (req as any).user as KeycloakDecodedToken;
//     const userRoles = kcUser.realm_access?.roles || [];
//     const userGroups = kcUser.groups || [];
//     const username = kcUser.preferred_username;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });
//     let users: any[] = response.data;

//     for (const user of users) {
//       const groupsResponse = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${user.id}/groups`, {
//         headers: { Authorization: `Bearer ${adminToken}` },
//       });
//       user.groups = groupsResponse.data.map((g: any) => g.path);
//     }

//     if (userRoles.includes('Super_Admin')) {
//       res.json(users);
//       return;
//     }

//     if (userRoles.includes('Admin')) {
//       const orgGroup = userGroups.find(g => g.includes('/Org'));
//       if (orgGroup) {
//         users = users.filter(u => (u.groups || []).some((g: string) => g.startsWith(orgGroup)));
//         res.json(users);
//         return;
//       }
//     }

//     if (userRoles.includes('Manager')) {
//       const managerGroup = userGroups.find(g => g.includes('/Manager'));
//       if (managerGroup) {
//         const managerSelf = users.find(u => u.id === kcUser.sub);
//         const driverUsers = users.filter(u =>
//           (u.groups || []).some((g: string) => g.startsWith(`${managerGroup}/Driver`))
//         );
//         const finalUsers = [managerSelf, ...driverUsers].filter(Boolean);
//         res.json(finalUsers);
//         return;
//       }
//     }

//     if (userRoles.includes('Driver') && username) {
//       users = users.filter(u => u.username === username);
//       res.json(users);
//       return;
//     }

//     res.status(403).json({ error: 'Forbidden: Cannot determine visibility rules' });
//   } catch (error: any) {
//     console.error('Error fetching users:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch users' });
//   }
// });

// app.get('/users/:id', checkRole(['Super_Admin', 'Admin', 'Manager', 'Driver']), async (req: Request, res: Response) => {
//   try {
//     const adminToken = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });

//     res.json(response.data);
//   } catch (error: any) {
//     console.error('Error fetching user:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch user' });
//   }
// });

// app.delete('/users/:id', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const adminToken = await getAdminToken();
//     const userId = req.params.id;

//     await axios.delete(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: { Authorization: `Bearer ${adminToken}` },
//     });

//     res.json({ message: 'User deleted successfully' });
//   } catch (error: any) {
//     console.error('Error deleting user:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to delete user' });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`✅ user-management-service running on port ${PORT} or 3001 on Host`);
// });
































































// import express, { Request, Response, NextFunction } from 'express';
// import axios from 'axios';
// import dotenv from 'dotenv';
// import {jwtDecode} from 'jwt-decode';
// // If using CommonJS, use: const jwt_decode = require('jwt-decode').default;

// dotenv.config();

// const app = express();
// app.use(express.json());


// interface KeycloakDecodedToken {
//   realm_access?: {
//     roles: string[];
//   };
//   groups?: string[];
//   sub?: string;
//   preferred_username?: string;
//   [key: string]: any;
// }

// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

// async function getAdminToken(): Promise<string> {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(
//     `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
//     params,
//     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//   );

//   return response.data.access_token;
// }

// const checkRole = (requiredRoles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader) {
//         res.status(401).json({ error: 'No token provided' });
//         return;
//       }

//       const token = authHeader.split(' ')[1];
//       const decoded = jwtDecode<KeycloakDecodedToken>(token);
//       // const decoded = jwt_decode(token);
//                       console.log(`Decoded token: ${JSON.stringify(decoded)}`); // Debugging line
    
      // const roles = decoded.realm_access?.roles || [];
                      // console.log(`User roles: ${roles}`); // Debugging line
//       const groups = decoded.groups || [];
//                       console.log(groups); // Debugging line

//       const hasRole = requiredRoles.some(role => roles.includes(role));
//       if (!hasRole) {
//         console.log(`Found: ${roles}`);
//         res.status(403).json({ error: 'Forbidden: insufficient role' });
//         return;
//       }

//       console.log(`User roles: ${roles}`);
//       console.log(`Decoded token: ${JSON.stringify(decoded)}`);

//       (req as any).user = decoded;
//       next();
//     } catch (err) {
//       res.status(401).json({ error: 'Invalid token' });
//       return;
//     }
//   };
// };

// app.get('/users', checkRole(['Super_Admin', 'Admin']), async (_req: Request, res: Response) => {
//   try {
//     const token = await getAdminToken();

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error: any) {
//     console.error('Error fetching users from Keycloak:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// app.get('/users/:id', checkRole(['Super_Admin', 'Admin', 'Manager']), async (req: Request, res: Response) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error: any) {
//     console.error('Error fetching user from Keycloak:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// app.delete('/users/:id', checkRole(['Super_Admin']), async (req: Request, res: Response) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     await axios.delete(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json({ message: 'User deleted successfully' });
//   } catch (error: any) {
//     console.error('Error deleting user from Keycloak:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to delete user from Keycloak' });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`✅ user-management-service running on port ${PORT} or 3001 on Host`);
// });
















// import express from 'express';
// import axios from 'axios';
// import dotenv from 'dotenv';

// dotenv.config();

// const app = express();
// app.use(express.json());

// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!; // e.g., http://petroshield-keycloak:8080
// const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM!;       // e.g., myrealm
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!; // e.g., myclient
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!; // e.g., xyz

// const KEYCLOAK_ADMIN_API_URL = `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}`;

// async function getAdminToken() {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(
//     `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
//     params,
//     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//   );

//   return response.data.access_token;
// }

// // ✅ Route to get all users
// app.get('/users', async (_req, res) => {
//   try {
//     const token = await getAdminToken();

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error: any) {
//     console.error('Error fetching users from Keycloak:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// // ✅ Route to get a single user
// app.get('/users/:id', async (req, res) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error: any) {
//     console.error('Error fetching user from Keycloak:', error?.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`✅ user-management-service running on port ${PORT} or 3001 on Host`);
// });













// import express from 'express';
// import axios from 'axios';
// import type { Request } from 'express';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();
// app.use(express.json());

// // Keycloak config
// const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// const KEYCLOAK_ADMIN_API_URL = process.env.KEYCLOAK_ADMIN_API_URL!;
// const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// // Extract token from incoming request (if needed later)
// function extractToken(req: Request): string | null {
//   const bearer = req.headers["authorization"];
//   if (!bearer || typeof bearer !== "string" || !bearer.startsWith("Bearer ")) return null;
//   return bearer.slice(7);
// }

// // Get Keycloak admin token
// async function getAdminToken() {
//   console.log("it was here 2"); 
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   // ✅ Correct URL with realm
//       console.log(params.toString());
//       console.log(`${KEYCLOAK_BASE_URL}/realms/myrealm/protocol/openid-connect/token`);
//       console.log(KEYCLOAK_CLIENT_ID);
//       console.log(KEYCLOAK_CLIENT_SECRET);
//       console.log(KEYCLOAK_BASE_URL);
//       console.log(KEYCLOAK_ADMIN_API_URL);
//   const response = await axios.post(`${KEYCLOAK_BASE_URL}/realms/myrealm/protocol/openid-connect/token`, params);
//   return response.data.access_token;
// }

// // Fetch all users
// app.get('/users', async (req, res) => {
//   try {
//     console.log("it was here 1"); 
//     const token = await getAdminToken();
//     // const token = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ2NDdwZDhGOWt2Wm51bTJyRmZtQ2k3bmtRU3EtNENtSWtjcVAxcGRuSzlVIn0.eyJleHAiOjE3NTE2MjQ5NDUsImlhdCI6MTc1MTYyNDY0NSwianRpIjoidHJydGNjOjI2NTBmOWViLTZlN2EtNDNlNi04OWFkLWZmODhhOTNlOTkzZiIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvbXlyZWFsbSIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiIxZDQyMjY3My00NzI1LTQ0ZDQtYjYzYy03MDFkYTg4YTI0OWEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJteWNsaWVudCIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiLyoiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtbXlyZWFsbSIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJyZWFsbS1tYW5hZ2VtZW50Ijp7InJvbGVzIjpbImNyZWF0ZS1jbGllbnQiXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCIsImNsaWVudEhvc3QiOiIxOTIuMTY4LjY1LjEiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6InNlcnZpY2UtYWNjb3VudC1teWNsaWVudCIsImNsaWVudEFkZHJlc3MiOiIxOTIuMTY4LjY1LjEiLCJjbGllbnRfaWQiOiJteWNsaWVudCJ9.ajfomDNG1dsdl7Qgfnn3CPgVPj2U4dZmps2ATxg0Dg9f94D9_2RukoxnGT90wu1V1X1cXHbNOCkmsWGL0YYwLYI3JB3gntf0rO__ZnMlKJCGRcq9kKAVwQZ-IOx5bF0DB138Wi4uDLfL2XlmPqYojvY3f1LzJt3dzXqs0dJwuw9DFAbnVnpYtBJdiRf452VInrYsfFH3s4d1IU_fYDkcKAFdw3iy5nhVlHv73ENn7Nb4IshcdrKubjVF8FypjpxzKwcjAplg2nvzph5fkUreQnY5SD5aWmZfSxv1_CPxaFQVXf471Z-Rp9qW6zp8CIL1GUcPfcm8sOKELyl8d6HpsA"
//     console.log("it was here 3");
//             // const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//             //   headers: {
//             //     Authorization: `Bearer ${token}`,
//             //   },
//             // });
//     const response = await axios.get(`http://petroshield-keycloak:8080/admin/realms/myrealm/users`, {
//     headers: {
//     Authorization: `Bearer ${token}`,
//     },
//     });

//     console.log("it was here 4");
//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching users from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// // Fetch specific user
// app.get('/users/:id', async (req, res) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching user from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// app.listen(3000, () => {
//   console.log('user-management-service running on port 3000 or 3001 on Host');
// });
























































// import express from 'express';
// import axios from 'axios';
// import type { Request } from 'express';

// const app = express();
// app.use(express.json());

// // Update these variables with your Keycloak setup
// const KEYCLOAK_BASE_URL = 'http://petroshield-keycloak:8080';
// const KEYCLOAK_ADMIN_API_URL = 'http://petroshield-keycloak:8080/admin/realms/myrealm';
// const KEYCLOAK_CLIENT_ID = 'myclient';
// const KEYCLOAK_CLIENT_SECRET = 'jWQJs4FcdBFH7qJ5gHvkv7H8oMQC4Y7i';


// function extractToken(req: express.Request): string | null {
//   const bearer = req.headers["authorization"];
//   if (!bearer || typeof bearer !== "string" || !bearer.startsWith("Bearer ")) return null;
//   return bearer.slice(7);
// }

// async function getAdminToken() {
//   const params = new URLSearchParams();
//   params.append('grant_type', 'client_credentials');
//   params.append('client_id', KEYCLOAK_CLIENT_ID);
//   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

//   const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
//   return response.data.access_token;
// }

// // Example route to fetch all users from Keycloak
// app.get('/users', async (req, res) => {
//   try {
//     const token = await getAdminToken();

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching users from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
//   }
// });

// // Example route to get a specific user by Keycloak ID
// app.get('/users/:id', async (req, res) => {
//   try {
//     const token = await getAdminToken();
//     const userId = req.params.id;

//     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching user from Keycloak:', error);
//     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
//   }
// });

// app.listen(3000, () => {
//   console.log('user-management-service running on port 3000 or 3001 on Host');
// });



// // import express from 'express';
// // import axios from 'axios';
// // import * as dotenv from 'dotenv';
// // dotenv.config();

// // const app = express();
// // app.use(express.json());

// // const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL!;
// // const KEYCLOAK_ADMIN_API_URL = process.env.KEYCLOAK_ADMIN_API_URL!;
// // const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
// // const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;

// // async function getAdminToken() {
// //   const params = new URLSearchParams();
// //   params.append('grant_type', 'client_credentials');
// //   params.append('client_id', KEYCLOAK_CLIENT_ID);
// //   params.append('client_secret', KEYCLOAK_CLIENT_SECRET);

// //   const response = await axios.post(`${KEYCLOAK_BASE_URL}/protocol/openid-connect/token`, params);
// //   return response.data.access_token;
// // }

// // // Fetch all users
// // app.get('/users', async (_, res) => {
// //   try {
// //     const token = await getAdminToken();
// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
// //       headers: {
// //         Authorization: `Bearer ${token}`,
// //       },
// //     });
// //     res.json(response.data);
// //   } catch (error) {
// //     console.error('Error fetching users from Keycloak:', error);
// //     res.status(500).json({ error: 'Failed to fetch users from Keycloak' });
// //   }
// // });

// // // Fetch single user
// // app.get('/users/:id', async (req, res) => {
// //   try {
// //     const token = await getAdminToken();
// //     const userId = req.params.id;
// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
// //       headers: {
// //         Authorization: `Bearer ${token}`,
// //       },
// //     });
// //     res.json(response.data);
// //   } catch (error) {
// //     console.error('Error fetching user from Keycloak:', error);
// //     res.status(500).json({ error: 'Failed to fetch user from Keycloak' });
// //   }
// // });

// // app.listen(3000, () => {
// //   console.log('user-management-service running on port 3000');
// // });








// // import express, { Request, Response } from "express";
// // import authMiddleware from "./routes/auth";
// // import { PrismaClient } from "@prisma/client";
// // import { getAdminToken } from "./utils/keycloak";
// // import dotenv from "dotenv";
// // import axios from "axios";

// // dotenv.config();
// // const app = express();
// // const prisma = new PrismaClient();

// // app.use(express.json());

// // // ✅ Keycloak config
// // const KEYCLOAK_ADMIN_API_URL = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}`;

// // // ✅ Routes that require Keycloak token
// // app.get("/users", authMiddleware, async (_req: Request, res: Response) => {
// //   try {
// //     const token = await getAdminToken();

// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users`, {
// //       headers: { Authorization: `Bearer ${token}` },
// //     });

// //     res.json(response.data);
// //   } catch (error) {
// //     console.error("Error fetching users from Keycloak:", error);
// //     res.status(500).json({ error: "Failed to fetch users" });
// //   }
// // });

// // app.get("/users/:id", authMiddleware, async (req: Request, res: Response) => {
// //   try {
// //     const token = await getAdminToken();
// //     const userId = req.params.id;

// //     const response = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/users/${userId}`, {
// //       headers: { Authorization: `Bearer ${token}` },
// //     });

// //     res.json(response.data);
// //   } catch (error) {
// //     console.error("Error fetching user:", error);
// //     res.status(500).json({ error: "Failed to fetch user" });
// //   }
// // });

// // // ✅ Example of creating driver assignment in DB
// // app.post("/assign-driver", authMiddleware, async (req: Request, res: Response) => {
// //   try {
// //     const { userId, vehicleId, organizationId } = req.body;

// //     const assignment = await prisma.driverVehicleAssignment.create({
// //       data: {
// //         userId,
// //         vehicleId,
// //         organizationId,
// //       },
// //     });

// //     res.json(assignment);
// //   } catch (error) {
// //     console.error("Error creating assignment:", error);
// //     res.status(500).json({ error: "Failed to create assignment" });
// //   }
// // });

// // const PORT = 3000;
// // app.listen(PORT, () => {
// //   console.log(`user-management-service running on port ${PORT}`);
// // });
