import { Router } from "express";
import { ownerController } from "../controllers/owner.controller";

const router = Router();

router.get("/", ownerController.getAllOwners);
router.get("/:id", ownerController.getOwnerById);
router.put("/:id", ownerController.updateOwner);
router.delete("/:id", ownerController.deleteOwner);
router.get("/:id/vehicles", ownerController.getOwnerVehicles);
router.post("/:id/vehicles", ownerController.addVehicleToOwner);
router.get("/:id/service-history", ownerController.getServiceHistory);
router.get("/:id/expenses", ownerController.getExpenses);
router.get("/:id/notifications", ownerController.getNotifications);
router.patch(
  "/:id/notifications/:notificationId/read",
  ownerController.markNotificationRead,
);
router.delete("/:id/notifications", ownerController.deleteNotifications);
router.get("/:id/preferences", ownerController.getPreferences);
router.put("/:id/preferences", ownerController.updatePreferences);

export default router;
