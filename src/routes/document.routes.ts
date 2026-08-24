import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import { uploadSingle } from "../middleware/upload.middleware";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  UploadDocumentSchema,
  UpdateDocumentSchema,
} from "../dto/document.dto";
import { IdParamSchema } from "../dto/account.dto";
import { DocumentController } from "../controllers/document.controller";
import { documentService } from "../services/document.service";
import { storageService } from "../services/storage.service";

const router = Router();

const documentController = new DocumentController(documentService, storageService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await documentController.getAll(req, res);
  }),
);

router.get(
  "/entity/:entityType/:entityId",
  asyncHandler(async (req: Request, res: Response) => {
    await documentController.getByEntity(req, res);
  }),
);

router.post(
  "/upload",
  uploadSingle,
  validate(UploadDocumentSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.upload(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.getById(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateDocumentSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.update(req, res);
  }),
);

router.post(
  "/:id/verify",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.verify(req, res);
  }),
);

router.post(
  "/:id/archive",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.archive(req, res);
  }),
);

router.get(
  "/:id/download",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.download(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await documentController.delete(req, res);
  }),
);

export default router;
