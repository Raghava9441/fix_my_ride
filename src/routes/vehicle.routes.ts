import { Router } from "express";
import { vehicleController } from "../controllers/vehicle.controller";

const router = Router();

router.get("/", vehicleController.getAllVehicles);
router.get("/search", vehicleController.searchVehicles);
router.get(
  "/registration/:regNumber",
  vehicleController.getVehicleByRegistration,
);
router.get("/vin/:vin", vehicleController.getVehicleByVin);
router.get("/:id", vehicleController.getVehicleById);
router.post("/", vehicleController.createVehicle);
router.put("/:id", vehicleController.updateVehicle);
router.delete("/:id", vehicleController.deleteVehicle);
router.get(
  "/:id/service-records",
  vehicleController.getServiceRecords,
);
router.get(
  "/:id/service-centers",
  vehicleController.getAuthorizedCenters,
);
router.post("/:id/service-centers", vehicleController.authorizeCenter);
router.put(
  "/:id/service-centers/:centerId",
  vehicleController.updateCenterAccess,
);
router.delete(
  "/:id/service-centers/:centerId",
  vehicleController.revokeCenterAccess,
);
router.get("/:id/odometer", vehicleController.getCurrentOdometer);
router.post("/:id/odometer", vehicleController.updateOdometer);
router.get(
  "/:id/odometer/history",
  vehicleController.getOdometerHistory,
);
router.get("/:id/documents", vehicleController.getDocuments);
router.post("/:id/documents", vehicleController.uploadDocument);
router.delete(
  "/:id/documents/:documentId",
  vehicleController.deleteDocument,
);
router.get(
  "/:id/documents/:documentId/download",
  vehicleController.downloadDocument,
);
router.get("/:id/reminders", vehicleController.getReminders);
router.get("/:id/warranty", vehicleController.getWarranty);
router.put("/:id/warranty", vehicleController.updateWarranty);
router.get("/:id/insurance", vehicleController.getInsurance);
router.put("/:id/insurance", vehicleController.updateInsurance);
router.post("/:id/transfer", vehicleController.transferOwnership);
router.get("/:id/stats", vehicleController.getVehicleStats);

export default router;
