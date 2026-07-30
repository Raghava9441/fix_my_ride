import { Router } from "express";
import { staffController } from "../controllers/staff.controller";

const router = Router();

router.get("/", staffController.getAllStaff);
router.get("/:id", staffController.getStaffById);
router.post("/", staffController.createStaff);
router.put("/:id", staffController.updateStaff);
router.delete("/:id", staffController.deleteStaff);
router.get("/:id/permissions", staffController.getStaffPermissions);
router.post("/:id/permissions", staffController.addPermission);
router.delete(
  "/:id/permissions/:permissionId",
  staffController.removePermission,
);
router.get("/:id/schedule", staffController.getSchedule);
router.put("/:id/schedule", staffController.updateSchedule);
router.get("/:id/performance", staffController.getPerformance);
router.get("/:id/services", staffController.getStaffServices);

export default router;
