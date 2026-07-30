import { Router } from "express";
import { serviceRecordController } from "../controllers/serviceRecord.controller";

const router = Router();

router.get("/", serviceRecordController.getAllServiceRecords);
router.get(
  "/:id",
  serviceRecordController.getServiceRecordById,
);
router.post("/", serviceRecordController.createServiceRecord);
router.put("/:id", serviceRecordController.updateServiceRecord);
router.delete(
  "/:id",
  serviceRecordController.deleteServiceRecord,
);
router.get("/:id/parts", serviceRecordController.getParts);
router.post("/:id/parts", serviceRecordController.addPart);
router.put(
  "/:id/parts/:partId",
  serviceRecordController.updatePart,
);
router.delete(
  "/:id/parts/:partId",
  serviceRecordController.removePart,
);
router.get("/:id/labor", serviceRecordController.getLabor);
router.post("/:id/labor", serviceRecordController.addLabor);
router.get(
  "/:id/documents",
  serviceRecordController.getDocuments,
);
router.post(
  "/:id/documents",
  serviceRecordController.uploadDocument,
);
router.delete(
  "/:id/documents/:documentId",
  serviceRecordController.deleteDocument,
);
router.get("/:id/invoice", serviceRecordController.getInvoice);
router.post(
  "/:id/invoice/generate",
  serviceRecordController.generateInvoice,
);
router.get(
  "/:id/invoice/download",
  serviceRecordController.downloadInvoice,
);
router.patch(
  "/:id/status",
  serviceRecordController.updateStatus,
);
router.post(
  "/:id/feedback",
  serviceRecordController.addFeedback,
);
router.get(
  "/:id/feedback",
  serviceRecordController.getFeedback,
);
router.post(
  "/:id/next-service",
  serviceRecordController.setNextService,
);
router.get(
  "/:id/next-service",
  serviceRecordController.getNextService,
);

export default router;
