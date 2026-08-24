import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  CreateServiceRecordSchema,
  UpdateServiceRecordSchema,
  AddPartSchema,
  UpdatePartSchema,
  UpdateStatusSchema,
  SetNextServiceSchema,
} from "../dto/service-record.dto";
import { IdParamSchema } from "../dto/account.dto";
import { ServiceRecordController } from "../controllers/serviceRecord.controller";
import { serviceRecordService } from "../services/serviceRecord.service";

const router = Router();

const serviceRecordController = new ServiceRecordController(
  serviceRecordService,
);

const IdAndPartIdParamSchema = z.object({
  id: IdParamSchema.shape.id,
  partId: IdParamSchema.shape.id,
});

const IdAndDocumentIdParamSchema = z.object({
  id: IdParamSchema.shape.id,
  documentId: IdParamSchema.shape.id,
});

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await serviceRecordController.getAll(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateServiceRecordSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.create(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateServiceRecordSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.update(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.delete(req, res);
  }),
);

router.get(
  "/:id/parts",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getParts(req, res);
  }),
);

router.post(
  "/:id/parts",
  validateParams(IdParamSchema),
  validate(AddPartSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.addPart(req, res);
  }),
);

router.put(
  "/:id/parts/:partId",
  validateParams(IdAndPartIdParamSchema),
  validate(UpdatePartSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.updatePart(req, res);
  }),
);

router.delete(
  "/:id/parts/:partId",
  validateParams(IdAndPartIdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.removePart(req, res);
  }),
);

router.get(
  "/:id/labor",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getLabor(req, res);
  }),
);

router.post(
  "/:id/labor",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.addLabor(req, res);
  }),
);

router.get(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getDocuments(req, res);
  }),
);

router.post(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.uploadDocument(req, res);
  }),
);

router.delete(
  "/:id/documents/:documentId",
  validateParams(IdAndDocumentIdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.deleteDocument(req, res);
  }),
);

router.get(
  "/:id/invoice",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getInvoice(req, res);
  }),
);

router.post(
  "/:id/invoice/generate",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.generateInvoice(req, res);
  }),
);

router.get(
  "/:id/invoice/download",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.downloadInvoice(req, res);
  }),
);

router.patch(
  "/:id/status",
  validateParams(IdParamSchema),
  validate(UpdateStatusSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.updateStatus(req, res);
  }),
);

router.post(
  "/:id/feedback",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.addFeedback(req, res);
  }),
);

router.get(
  "/:id/feedback",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getFeedback(req, res);
  }),
);

router.post(
  "/:id/next-service",
  validateParams(IdParamSchema),
  validate(SetNextServiceSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.setNextService(req, res);
  }),
);

router.get(
  "/:id/next-service",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceRecordController.getNextService(req, res);
  }),
);

export default router;
