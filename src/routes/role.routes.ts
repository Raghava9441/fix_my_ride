import { Router } from "express";
import { roleController } from "../controllers/role.controller";

const router = Router();

router.get("/", roleController.getAllRoles);
router.get("/:id", roleController.getRoleById);
router.post("/", roleController.createRole);
router.put("/:id", roleController.updateRole);
router.delete("/:id", roleController.deleteRole);
router.get("/:id/permissions", roleController.getRolePermissions);
router.post("/:id/permissions", roleController.addPermissionToRole);
router.delete(
  "/:id/permissions/:permissionId",
  roleController.removePermissionFromRole,
);
router.post("/:id/assign", roleController.assignRoleToUser);
router.delete(
  "/:id/assign/:accountId",
  roleController.removeRoleFromUser,
);
router.post("/seed", roleController.seedSystemRoles);

export default router;
