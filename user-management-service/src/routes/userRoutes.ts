import express from 'express';
import {
  createAdminController,
  createManagerController,
  createDriverController,
  assignManagerController,
  assignDriverController,
  getMyManagersController,
  getMyDriversController,
  getMyDriversAsAdminController,
  getMyManagerWithDriversController,
  getUserByIdController,
  getOrgUsersController,
  deleteUserController
} from '../controllers/userController';
import { checkRole } from '../middleware/checkRole';

const router = express.Router();

// -------- CREATE Users --------
router.post('/create-admin', checkRole(['Super_Admin']), createAdminController);
router.post('/create-manager', checkRole(['Super_Admin', 'Admin']), createManagerController);
router.post('/create-driver', checkRole(['Super_Admin', 'Admin']), createDriverController);

// -------- ASSIGN Relationships --------
router.post('/assign-manager', checkRole(['Super_Admin', 'Admin']), assignManagerController);
router.post('/assign-driver', checkRole(['Super_Admin', 'Admin']), assignDriverController);

// -------- FETCH My Users --------
router.get('/my-managers', checkRole(['Admin']), getMyManagersController);
router.get('/my-drivers', checkRole(['Manager']), getMyDriversController);
router.get('/my-drivers-as-admin', checkRole(['Admin']), getMyDriversAsAdminController);
router.get('/my-manager/:managerUsername', checkRole(['Admin']), getMyManagerWithDriversController);

// -------- USER Details --------
router.get('/users/:id', checkRole(['Super_Admin', 'Admin', 'Manager', 'Driver']), getUserByIdController);
router.get('/org-users', checkRole(['Admin']), getOrgUsersController);

// -------- DELETE User --------
router.delete('/users/:id', checkRole(['Super_Admin', 'Admin']), deleteUserController);

export default router;
