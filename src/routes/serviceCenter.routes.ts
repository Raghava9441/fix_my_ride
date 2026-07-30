import { Router } from "express";
import { serviceCenterController } from "../controllers/serviceCenter.controller";

const router = Router();

router.get("/", serviceCenterController.getAllServiceCenters);
router.get("/nearby", serviceCenterController.getNearbyCenters);
router.get(
  "/:id",
  serviceCenterController.getServiceCenterById,
);
router.post("/", serviceCenterController.createServiceCenter);
router.put("/:id", serviceCenterController.updateServiceCenter);
router.delete(
  "/:id",
  serviceCenterController.deleteServiceCenter,
);
router.get(
  "/:id/vehicles",
  serviceCenterController.getCenterVehicles,
);
router.get(
  "/:id/staff",
  serviceCenterController.getCenterStaff,
);
router.get(
  "/:id/services",
  serviceCenterController.getCenterServices,
);
router.post(
  "/:id/services",
  serviceCenterController.addService,
);
router.put(
  "/:id/services/:serviceId",
  serviceCenterController.updateService,
);
router.delete(
  "/:id/services/:serviceId",
  serviceCenterController.deleteService,
);
router.get(
  "/:id/stats",
  serviceCenterController.getCenterStats,
);
router.get(
  "/:id/reviews",
  serviceCenterController.getCenterReviews,
);
router.post("/:id/reviews", serviceCenterController.addReview);
router.post(
  "/:id/verify",
  serviceCenterController.verifyCenter,
);
router.post(
  "/:id/documents",
  serviceCenterController.uploadDocument,
);
router.get(
  "/:id/documents",
  serviceCenterController.getDocuments,
);
router.get(
  "/:id/settings",
  serviceCenterController.getSettings,
);
router.put(
  "/:id/settings",
  serviceCenterController.updateSettings,
);

export default router;
