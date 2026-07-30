import { Router } from "express";
import { permissionController } from "../controllers/permission.controller";

const router = Router();

router.get("/", permissionController.getAllPermissions);
router.get("/:id", permissionController.getPermissionById);
router.post("/", permissionController.createPermission);
router.put("/:id", permissionController.updatePermission);
router.delete("/:id", permissionController.deletePermission);
router.post("/seed", permissionController.seedDefaultPermissions);

export default router;
