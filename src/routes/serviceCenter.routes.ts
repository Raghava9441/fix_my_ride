import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreateServiceCenterSchema,
  UpdateServiceCenterSchema,
  UpdateServiceSettingsSchema,
  AddServiceSchema,
  UpdateServiceSchema,
  CreateReviewSchema,
} from "../dto/service-center.dto";
import { IdParamSchema } from "../dto/account.dto";
import { authenticate } from "../middleware/auth.middleware";
import { ServiceCenterController } from "../controllers/serviceCenter.controller";
import { serviceCenterService } from "../services/serviceCenter.service";

const router = Router();

router.use(authenticate);

const serviceCenterController = new ServiceCenterController(
  serviceCenterService,
);

const IdAndServiceIdParamSchema = z.object({
  id: IdParamSchema.shape.id,
  serviceId: IdParamSchema.shape.id,
});

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await serviceCenterController.getAll(req, res);
  }),
);

router.get(
  "/nearby",
  asyncHandler(async (req: Request, res: Response) => {
    await serviceCenterController.getNearbyCenters(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    req.params.id = req.validated?.id || req.params.id;
    await serviceCenterController.getById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateServiceCenterSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.create(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateServiceCenterSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.update(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.delete(req, res);
  }),
);

router.get(
  "/:id/vehicles",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getCenterVehicles(req, res);
  }),
);

router.get(
  "/:id/staff",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getCenterStaff(req, res);
  }),
);

router.get(
  "/:id/services",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getCenterServices(req, res);
  }),
);

router.post(
  "/:id/services",
  validateParams(IdParamSchema),
  validate(AddServiceSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.addService(req, res);
  }),
);

router.put(
  "/:id/services/:serviceId",
  validateParams(IdAndServiceIdParamSchema),
  validate(UpdateServiceSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.updateService(req, res);
  }),
);

router.delete(
  "/:id/services/:serviceId",
  validateParams(IdAndServiceIdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.deleteService(req, res);
  }),
);

router.get(
  "/:id/stats",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getCenterStats(req, res);
  }),
);

router.get(
  "/:id/reviews",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getCenterReviews(req, res);
  }),
);

router.post(
  "/:id/reviews",
  validateParams(IdParamSchema),
  validate(CreateReviewSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.addReview(req, res);
  }),
);

router.post(
  "/:id/verify",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.verifyCenter(req, res);
  }),
);

router.post(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.uploadDocument(req, res);
  }),
);

router.get(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getDocuments(req, res);
  }),
);

router.get(
  "/:id/settings",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.getSettings(req, res);
  }),
);

router.put(
  "/:id/settings",
  validateParams(IdParamSchema),
  validate(UpdateServiceSettingsSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await serviceCenterController.updateSettings(req, res);
  }),
);

export default router;
