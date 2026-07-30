import { Router } from "express";
import { adminController } from "../controllers/admin.controller";

const router = Router();

router.get("/dashboard", adminController.getDashboard);
router.get("/stats", adminController.getSystemStats);
router.get("/tenants", adminController.getAllTenants);
router.post("/tenants", adminController.createTenant);
router.get("/tenants/:id", adminController.getTenantById);
router.put("/tenants/:id", adminController.updateTenant);
router.delete("/tenants/:id", adminController.deleteTenant);
router.patch("/tenants/:id/status", adminController.updateTenantStatus);
router.get("/users", adminController.getAllUsers);
router.patch("/users/:id/suspend", adminController.suspendUser);
router.patch("/users/:id/activate", adminController.activateUser);
router.get("/system/health", adminController.getSystemHealth);
router.get("/system/logs", adminController.getSystemLogs);
router.get("/system/metrics", adminController.getSystemMetrics);
router.post("/maintenance/clear-cache", adminController.clearCache);
router.post("/maintenance/reindex-search", adminController.reindexSearch);
router.post("/maintenance/backup", adminController.createBackup);
router.get("/audit-logs", adminController.getAuditLogs);

export default router;
