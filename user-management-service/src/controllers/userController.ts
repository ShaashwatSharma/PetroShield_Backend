import { Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

import {
  getAdminToken,
  getOrCreateGroup,
  getUserIdByUsername,
  getUserGroups,
  createUser,
  getRoleByName,
  assignRoleToUser,
  getUserById,
  getUserRoles,
  deleteUser
} from '../utils/keycloak';
import { KEYCLOAK_ADMIN_API_URL } from '../config/keycloakConfig';
import { KeycloakDecodedToken } from '../types/keycloak';

export const createAdminController = async (req: Request, res: Response) => {
  try {
    const { username, password, org } = req.body;

    if (!org) {
       res.status(400).json({ error: 'Organization (org) is required' });
       return;
    }

    const adminToken = await getAdminToken();

    // Step 1: Check if org group exists
    const groupsResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    let orgGroup = groupsResp.data.find((g: any) => g.name === org);

    // Step 2: If not, create it
    if (!orgGroup) {
      await axios.post(`${KEYCLOAK_ADMIN_API_URL}/groups`, { name: org }, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const updatedGroupsResp = await axios.get(`${KEYCLOAK_ADMIN_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      orgGroup = updatedGroupsResp.data.find((g: any) => g.name === org);
      if (!orgGroup) {
        throw new Error(`Failed to create organization group: ${org}`);
      }
    }

    // Step 3: Create or find /org/Admin group path
    const orgAdminGroupPath = `/${org}/Admin`;
    const groupId = await getOrCreateGroup(orgAdminGroupPath, adminToken);

    // Step 4: Create Keycloak user
    const userId = await createUser(username, password, adminToken);

    // Step 5: Assign user to group
    await axios.put(
      `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // Step 6: Assign Admin role
    const role = await getRoleByName('Admin', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    res.json({ message: 'Admin created successfully', userId, org });
  } catch (error: any) {
    console.error('Error creating admin:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create admin' });
  }
};

export const createManagerController = async (req: Request, res: Response) => {
  try {
    const { username, password, org, adminUsername } = req.body;

    if (!org || !adminUsername) {
       res.status(400).json({ error: 'Organization (org) and adminUsername are required' });
       return;
    }

    const adminToken = await getAdminToken();

    // Get admin's Keycloak ID
    const adminKcId = await getUserIdByUsername(adminUsername, adminToken);
    if (!adminKcId) {
       res.status(404).json({ error: 'Admin not found with provided username' });
       return;
    }

    // Get admin's groups and organization
    const adminGroups = await getUserGroups(adminKcId, adminToken);
    const adminOrgGroup = adminGroups.find(g => g.startsWith('/'));

    if (!adminOrgGroup) {
       res.status(400).json({ error: 'Admin does not belong to any organization group' });
       return;
    }

    const adminOrg = adminOrgGroup.split('/')[1];
    if (adminOrg !== org) {
       res.status(400).json({ error: `Provided org (${org}) does not match admin's org (${adminOrg})` });
       return;
    }

    // Create the manager user
    const userId = await createUser(username, password, adminToken);

    // Assign manager to correct group
    const groupPath = `/${org}/Admin/Manager`;
    const groupId = await getOrCreateGroup(groupPath, adminToken);

    await axios.put(
      `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // Assign manager role
    const role = await getRoleByName('Manager', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    // Save relationship in DB
    await prisma.adminManager.create({
      data: {
        adminKcId,
        managerKcId: userId,
      },
    });

    res.json({ message: 'Manager created and assigned successfully', userId });
  } catch (error: any) {
    console.error('Error creating manager:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create manager' });
  }
};


export const createDriverController = async(req: Request, res: Response) => {
  try {
    const { username, password, org, managerUsername } = req.body;

    if (!org || !managerUsername) {
      res.status(400).json({ error: 'Organization (org) and managerUsername are required' });
      return;
    }

    const adminToken = await getAdminToken();

    // ✅ Get manager Keycloak ID using username
    const managerKcId = await getUserIdByUsername(managerUsername, adminToken);
    if (!managerKcId) {
      res.status(404).json({ error: 'Manager not found with provided username' });
      return;
    }

    // ✅ Get groups of manager
    const managerGroups = await getUserGroups(managerKcId, adminToken);

    // Find manager's org group
    const managerOrgGroup = managerGroups.find(g => g.startsWith('/'));

    if (!managerOrgGroup) {
      res.status(400).json({ error: 'Manager does not belong to any organization group' });
      return;
    }

    const managerOrg = managerOrgGroup.split('/')[1]; // Example: /MyOrg/Admin/Manager

    // ✅ Check if provided org matches manager's org
    if (managerOrg !== org) {
      res.status(400).json({ error: `Provided org (${org}) does not match manager's org (${managerOrg})` });
      return;
    }

    // Create driver user
    const userId = await createUser(username, password, adminToken);

    // Create/get group path
    const groupPath = `/${org}/Admin/Manager/Driver`;
    const groupId = await getOrCreateGroup(groupPath, adminToken);

    // Assign user to group
    await axios.put(
      `${KEYCLOAK_ADMIN_API_URL}/users/${userId}/groups/${groupId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // Assign role
    const role = await getRoleByName('Driver', adminToken);
    await assignRoleToUser(userId, role, adminToken);

    // Save local relationship in DB
    await prisma.managerDriver.create({
      data: {
        managerKcId,
        driverKcId: userId,
      },
    });

    res.json({ message: 'Driver created and assigned successfully', userId });
  } catch (error: any) {
    console.error('Error creating driver:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create driver' });
  }
};

export const assignManagerController = async (req: Request, res: Response) => {
  try {
    const { adminUsername, managerUsername } = req.body;

    if (!adminUsername || !managerUsername) {
      res.status(400).json({ error: 'adminUsername and managerUsername are required' });
      return;
    }

    const adminToken = await getAdminToken();

    // ✅ Get Keycloak IDs from emails
    const adminKcId = await getUserIdByUsername(adminUsername, adminToken);
    const managerKcId = await getUserIdByUsername(managerUsername, adminToken);

    if (!adminKcId || !managerKcId) {
      res.status(404).json({ error: 'Admin or Manager not found with provided email(s)' });
      return;
    }

    // ✅ Fetch groups to check org
    const adminGroups = await getUserGroups(adminKcId, adminToken);
    const managerGroups = await getUserGroups(managerKcId, adminToken);

    const adminOrg = adminGroups.find(g => g.startsWith('/'));
    const managerOrg = managerGroups.find(g => g.startsWith('/'));

    if (!adminOrg || !managerOrg || adminOrg.split('/')[1] !== managerOrg.split('/')[1]) {
      res.status(400).json({ error: 'Admin and Manager must belong to the same org' });
      return;
    }

    // ✅ Check existing assignment
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
};

export const assignDriverController = async (req: Request, res: Response) => {
  try {
    const { managerUsername, driverUsername } = req.body;

    if (!managerUsername || !driverUsername) {
      res.status(400).json({ error: 'managerUsername and driverUsername are required' });
      return;
    }

    const adminToken = await getAdminToken();

    // ✅ Get Keycloak IDs using usernames
    const managerKcId = await getUserIdByUsername(managerUsername, adminToken);
    const driverKcId = await getUserIdByUsername(driverUsername, adminToken);

    if (!managerKcId || !driverKcId) {
      res.status(404).json({ error: 'Manager or Driver not found with provided username(s)' });
      return;
    }

    // ✅ Fetch groups to check org
    const driverGroups = await getUserGroups(driverKcId, adminToken);
    const managerGroups = await getUserGroups(managerKcId, adminToken);

    const driverOrg = driverGroups.find(g => g.startsWith('/'));
    const managerOrg = managerGroups.find(g => g.startsWith('/'));

    if (!driverOrg || !managerOrg || driverOrg.split('/')[1] !== managerOrg.split('/')[1]) {
      res.status(400).json({ error: 'Driver and Manager must belong to the same org' });
      return;
    }

    // ✅ Check existing assignment
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
};


export const getMyManagersController = async(req: Request, res: Response) => {
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
};

export const getMyDriversController = async(req: Request, res: Response) => {
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
};

export const getMyDriversAsAdminController= async (req: Request, res: Response) => {
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

    const drivers = await Promise.all(
      allDriverIds.map(async (driverId) => {
        try {
          return await getUserById(driverId, adminToken);
        } catch (err) {
          console.warn(`⚠️ Driver ID not found in Keycloak: ${driverId}`);
          return null;
        }
      })
    );

    res.json(drivers.filter(Boolean)); // filter out nulls
  } catch (error: any) {
    console.error('Error fetching drivers as admin:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch drivers as admin' });
  }
};
export const getMyManagerWithDriversController = async (req: Request, res: Response) => {
  try {
    const kcUser = req.user as any; // decoded token injected by middleware
    const adminKcId = kcUser.sub;
    const { managerUsername } = req.params;

    const adminToken = await getAdminToken();

    // Get manager Keycloak ID
    const managerKcId = await getUserIdByUsername(managerUsername, adminToken);
    if (!managerKcId) {
       res.status(404).json({ error: 'Manager not found with provided username' });
       return;
    }

    // Check if this manager is assigned to current admin
    const assignment = await prisma.adminManager.findFirst({ where: { adminKcId, managerKcId } });
    if (!assignment) {
       res.status(403).json({ error: 'This manager is not assigned to you' });
       return;
    }

    // Fetch manager details
    const manager = await getUserById(managerKcId, adminToken);

    // Fetch driver's Keycloak IDs assigned to manager
    const driverAssignments = await prisma.managerDriver.findMany({ where: { managerKcId } });
    const drivers = await Promise.all(
      driverAssignments.map(rel => getUserById(rel.driverKcId, adminToken))
    );

    res.json({ manager, drivers });
  } catch (error: any) {
    console.error('Error fetching manager and drivers:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch manager and drivers' });
  }
};

export const getUserByIdController = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const adminToken = await getAdminToken();
    const user = await getUserById(userId, adminToken);
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const getOrgUsersController = async (req: Request, res: Response) => {
  try {
    const kcUser = req.user as any;
    const adminKcId = kcUser.sub;
    const adminToken = await getAdminToken();

    const managers = await prisma.adminManager.findMany({ where: { adminKcId } });

    const allManagerKcIds = managers.map(m => m.managerKcId);
    const allDriverKcIds: string[] = [];

    for (const manager of managers) {
      const drivers = await prisma.managerDriver.findMany({ where: { managerKcId: manager.managerKcId } });
      allDriverKcIds.push(...drivers.map(d => d.driverKcId));
    }

    const managerDetails = await Promise.all(
      allManagerKcIds.map(async (id) => {
        try {
          return await getUserById(id, adminToken);
        } catch (err) {
          console.warn(`⚠️ Manager ID not found in Keycloak: ${id}`);
          return null;
        }
      })
    );

    const driverDetails = await Promise.all(
      allDriverKcIds.map(async (id) => {
        try {
          return await getUserById(id, adminToken);
        } catch (err) {
          console.warn(`⚠️ Driver ID not found in Keycloak: ${id}`);
          return null;
        }
      })
    );

    res.json({
      managers: managerDetails.filter(Boolean),
      drivers: driverDetails.filter(Boolean),
    });
  } catch (error: any) {
    console.error('❌ Error fetching org users:', error);
    res.status(500).json({ error: 'Failed to fetch org users' });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const adminToken = await getAdminToken();

    const kcUser = req.user as any;
    const requesterRoles = kcUser.realm_access?.roles || [];

    // Get target user's roles
    const targetRoles = await getUserRoles(userId, adminToken);

    // Org-level restrictions if requester is Admin
    if (requesterRoles.includes('Admin')) {
      const requesterId = kcUser.sub;
      if (!requesterId) {
        res.status(400).json({ error: 'Requester ID is missing in token' });
        return;
      }

      const targetGroups = await getUserGroups(userId, adminToken);
      const adminGroups = await getUserGroups(requesterId, adminToken);
      const targetOrg = targetGroups.find(g => g.startsWith('/'));
      const adminOrg = adminGroups.find(g => g.startsWith('/'));

      if (!targetOrg || !adminOrg || targetOrg.split('/')[1] !== adminOrg.split('/')[1]) {
        res.status(403).json({ error: 'You cannot delete a user from another org' });
        return;
      }
    }

    // Check role-specific pre-conditions
    if (targetRoles.includes('Admin')) {
      const assignedManagers = await prisma.adminManager.findMany({ where: { adminKcId: userId } });
      if (assignedManagers.length > 0) {
        res.status(400).json({ error: 'Reassign or remove all managers under this admin before deleting' });
        return;
      }
    }

    if (targetRoles.includes('Manager')) {
      const assignedDrivers = await prisma.managerDriver.findMany({ where: { managerKcId: userId } });
      if (assignedDrivers.length > 0) {
        res.status(400).json({ error: 'Reassign or remove all drivers under this manager before deleting' });
        return;
      }
    }

    // Clean up DB relations
    await prisma.adminManager.deleteMany({ where: { adminKcId: userId } });
    await prisma.adminManager.deleteMany({ where: { managerKcId: userId } });
    await prisma.managerDriver.deleteMany({ where: { managerKcId: userId } });
    await prisma.managerDriver.deleteMany({ where: { driverKcId: userId } });

    // Delete from Keycloak
    await deleteUser(userId, adminToken);

    res.json({ message: 'User deleted successfully, and all relations removed' });
  } catch (error: any) {
    console.error('Error deleting user:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};


