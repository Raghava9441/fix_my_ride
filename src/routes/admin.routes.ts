import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { validate, validateParams } from "../middleware/validation.middleware";
import { IdParamSchema } from "../dto/common.dto";
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  UpdateTenantStatusSchema,
} from "../dto/tenant.dto";
import { AdminController } from "../controllers/admin.controller";
import { adminService } from "../services/admin.service";
import { tenantService } from "../services/tenant.service";
import { accountService } from "../services/account.service";
import { auditLogService } from "../services/audit.service";

const router = Router();

const adminController = new AdminController(
  adminService,
  tenantService,
  accountService,
  auditLogService,
);

// Everything under /api/v1/admin is platform-admin only.
router.use(authenticate, requireRole("admin"));

router.get(
  "/dashboard",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getDashboard(req, res);
  }),
);
router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getSystemStats(req, res);
  }),
);
router.get(
  "/tenants",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getAllTenants(req, res);
  }),
);
router.post(
  "/tenants",
  validate(CreateTenantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.createTenant(req, res);
  }),
);
router.get(
  "/tenants/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getTenantById(req, res);
  }),
);
router.put(
  "/tenants/:id",
  validateParams(IdParamSchema),
  validate(UpdateTenantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.updateTenant(req, res);
  }),
);
router.delete(
  "/tenants/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.deleteTenant(req, res);
  }),
);
router.patch(
  "/tenants/:id/status",
  validateParams(IdParamSchema),
  validate(UpdateTenantStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.updateTenantStatus(req, res);
  }),
);
router.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getAllUsers(req, res);
  }),
);
router.patch(
  "/users/:id/suspend",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.suspendUser(req, res);
  }),
);
router.patch(
  "/users/:id/activate",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.activateUser(req, res);
  }),
);
router.get(
  "/system/health",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getSystemHealth(req, res);
  }),
);
router.get(
  "/system/logs",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getSystemLogs(req, res);
  }),
);
router.get(
  "/system/metrics",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getSystemMetrics(req, res);
  }),
);
router.post(
  "/maintenance/clear-cache",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.clearCache(req, res);
  }),
);
router.post(
  "/maintenance/reindex-search",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.reindexSearch(req, res);
  }),
);
router.post(
  "/maintenance/backup",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.createBackup(req, res);
  }),
);
router.get(
  "/audit-logs",
  asyncHandler(async (req: Request, res: Response) => {
    await adminController.getAuditLogs(req, res);
  }),
);

export default router;
