import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const serviceRecordController = {
  getAllServiceRecords: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "record-1",
          vehicleId: "vehicle-1",
          serviceType: "oil-change",
          cost: 5000,
          date: "2024-01-15",
        },
        {
          id: "record-2",
          vehicleId: "vehicle-2",
          serviceType: "tire-rotation",
          cost: 3000,
          date: "2024-02-20",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Service records retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getServiceRecordById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        vehicleId: "vehicle-1",
        serviceType: "oil-change",
        cost: 5000,
        date: "2024-01-15",
        status: "completed",
      };
      const response = createSuccessResponse(
        result,
        "Service record retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createServiceRecord: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-record-id", ...req.body, status: "pending" };
      const response = createSuccessResponse(
        result,
        "Service record created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateServiceRecord: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Service record updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteServiceRecord: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Service record deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getParts: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "part-1", name: "Oil Filter", cost: 500, quantity: 1 },
        { id: "part-2", name: "Air Filter", cost: 300, quantity: 1 },
      ];
      const response = createSuccessResponse(
        result,
        "Parts retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addPart: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-part-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Part added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updatePart: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.partId, ...req.body };
      const response = createSuccessResponse(
        result,
        "Part updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  removePart: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.partId, removed: true };
      const response = createSuccessResponse(
        result,
        "Part removed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getLabor: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "labor-1",
          description: "Engine repair",
          hours: 2,
          rate: 500,
          total: 1000,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Labor records retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addLabor: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-labor-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Labor added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getDocuments: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "doc-1",
          name: "Invoice",
          type: "pdf",
          url: "/uploads/invoice.pdf",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Documents retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  uploadDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-doc-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Document uploaded successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.documentId, deleted: true };
      const response = createSuccessResponse(
        result,
        "Document deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getInvoice: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "invoice-1",
        recordId: req.params.id,
        total: 6500,
        status: "paid",
      };
      const response = createSuccessResponse(
        result,
        "Invoice retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  generateInvoice: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "invoice-new",
        recordId: req.params.id,
        generatedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Invoice generated successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  downloadInvoice: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { url: "/uploads/invoices/invoice.pdf" };
      const response = createSuccessResponse(
        result,
        "Invoice download URL retrieved",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateStatus: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, status: req.body.status };
      const response = createSuccessResponse(
        result,
        "Status updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addFeedback: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "feedback-new",
        ...req.body,
        createdAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Feedback added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getFeedback: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "feedback-1", rating: 5, comment: "Great service!" },
      ];
      const response = createSuccessResponse(
        result,
        "Feedback retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  setNextService: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        nextServiceDate: req.body.date,
        nextServiceMileage: req.body.mileage,
      };
      const response = createSuccessResponse(
        result,
        "Next service scheduled successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getNextService: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        nextServiceDate: "2024-05-01",
        nextServiceMileage: 55000,
      };
      const response = createSuccessResponse(
        result,
        "Next service information retrieved",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/service-records", serviceRecordController.getAllServiceRecords);
router.get(
  "/service-records/:id",
  serviceRecordController.getServiceRecordById,
);
router.post("/service-records", serviceRecordController.createServiceRecord);
router.put("/service-records/:id", serviceRecordController.updateServiceRecord);
router.delete(
  "/service-records/:id",
  serviceRecordController.deleteServiceRecord,
);
router.get("/service-records/:id/parts", serviceRecordController.getParts);
router.post("/service-records/:id/parts", serviceRecordController.addPart);
router.put(
  "/service-records/:id/parts/:partId",
  serviceRecordController.updatePart,
);
router.delete(
  "/service-records/:id/parts/:partId",
  serviceRecordController.removePart,
);
router.get("/service-records/:id/labor", serviceRecordController.getLabor);
router.post("/service-records/:id/labor", serviceRecordController.addLabor);
router.get(
  "/service-records/:id/documents",
  serviceRecordController.getDocuments,
);
router.post(
  "/service-records/:id/documents",
  serviceRecordController.uploadDocument,
);
router.delete(
  "/service-records/:id/documents/:documentId",
  serviceRecordController.deleteDocument,
);
router.get("/service-records/:id/invoice", serviceRecordController.getInvoice);
router.post(
  "/service-records/:id/invoice/generate",
  serviceRecordController.generateInvoice,
);
router.get(
  "/service-records/:id/invoice/download",
  serviceRecordController.downloadInvoice,
);
router.patch(
  "/service-records/:id/status",
  serviceRecordController.updateStatus,
);
router.post(
  "/service-records/:id/feedback",
  serviceRecordController.addFeedback,
);
router.get(
  "/service-records/:id/feedback",
  serviceRecordController.getFeedback,
);
router.post(
  "/service-records/:id/next-service",
  serviceRecordController.setNextService,
);
router.get(
  "/service-records/:id/next-service",
  serviceRecordController.getNextService,
);

export default router;
