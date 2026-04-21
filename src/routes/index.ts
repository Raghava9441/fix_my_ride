import { Router } from 'express';

import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import ownerRoutes from './owner.routes';
import staffRoutes from './staff.routes';
import vehicleRoutes from './vehicle.routes';
import serviceRecordRoutes from './serviceRecord.routes';
import serviceCenterRoutes from './serviceCenter.routes';
import reminderRoutes from './reminder.routes';
import invitationRoutes from './invitation.routes';
import permissionRoutes from './permission.routes';
import roleRoutes from './role.routes';
import reportRoutes from './report.routes';
import adminRoutes from './admin.routes';
import publicRoutes from './public.routes';

const router = Router();

// Public routes (no auth)
router.use('/public', publicRoutes);

// Protected routes
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/owners', ownerRoutes);
router.use('/staff', staffRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/service-records', serviceRecordRoutes);
router.use('/service-centers', serviceCenterRoutes);
router.use('/reminders', reminderRoutes);
router.use('/invitations', invitationRoutes);
router.use('/permissions', permissionRoutes);
router.use('/roles', roleRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);

export default router;