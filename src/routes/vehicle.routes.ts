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
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AuthorizeCenterSchema,
  UpdateCenterAccessSchema,
  UpdateOdometerSchema,
  TransferOwnershipSchema,
} from "../dto/vehicle.dto";
import { IdParamSchema } from "../dto/account.dto";
import { VehicleController } from "../controllers/vehicle.controller";
import { vehicleService } from "../services/vehicle.service";
import { documentService } from "../services/document.service";
import { reminderService } from "../services/reminder.service";

const router = Router();

const vehicleController = new VehicleController(
  vehicleService,
  documentService,
  reminderService,
);

const CenterParamSchema = z.object({
  id: IdParamSchema.shape.id,
  centerId: IdParamSchema.shape.id,
});

const DocumentParamSchema = z.object({
  id: IdParamSchema.shape.id,
  documentId: IdParamSchema.shape.id,
});

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await vehicleController.getAllVehicles(req, res);
  }),
);

router.get(
  "/search",
  asyncHandler(async (req: Request, res: Response) => {
    await vehicleController.searchVehicles(req, res);
  }),
);

router.get(
  "/registration/:regNumber",
  asyncHandler(async (req: Request, res: Response) => {
    await vehicleController.getVehicleByRegistration(req, res);
  }),
);

router.get(
  "/vin/:vin",
  asyncHandler(async (req: Request, res: Response) => {
    await vehicleController.getVehicleByVin(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getVehicleById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateVehicleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.createVehicle(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateVehicleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.updateVehicle(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.deleteVehicle(req, res);
  }),
);

router.get(
  "/:id/service-records",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getServiceRecords(req, res);
  }),
);

router.get(
  "/:id/service-centers",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getAuthorizedCenters(req, res);
  }),
);

router.post(
  "/:id/service-centers",
  validateParams(IdParamSchema),
  validate(AuthorizeCenterSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.authorizeCenter(req, res);
  }),
);

router.put(
  "/:id/service-centers/:centerId",
  validateParams(CenterParamSchema),
  validate(UpdateCenterAccessSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.updateCenterAccess(req, res);
  }),
);

router.delete(
  "/:id/service-centers/:centerId",
  validateParams(CenterParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.revokeCenterAccess(req, res);
  }),
);

router.get(
  "/:id/odometer",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getCurrentOdometer(req, res);
  }),
);

router.post(
  "/:id/odometer",
  validateParams(IdParamSchema),
  validate(UpdateOdometerSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.updateOdometer(req, res);
  }),
);

router.get(
  "/:id/odometer/history",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getOdometerHistory(req, res);
  }),
);

router.get(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getDocuments(req, res);
  }),
);

router.post(
  "/:id/documents",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.uploadDocument(req, res);
  }),
);

router.delete(
  "/:id/documents/:documentId",
  validateParams(DocumentParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.deleteDocument(req, res);
  }),
);

router.get(
  "/:id/documents/:documentId/download",
  validateParams(DocumentParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.downloadDocument(req, res);
  }),
);

router.get(
  "/:id/reminders",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getReminders(req, res);
  }),
);

router.get(
  "/:id/warranty",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getWarranty(req, res);
  }),
);

router.put(
  "/:id/warranty",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.updateWarranty(req, res);
  }),
);

router.get(
  "/:id/insurance",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getInsurance(req, res);
  }),
);

router.put(
  "/:id/insurance",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.updateInsurance(req, res);
  }),
);

router.post(
  "/:id/transfer",
  validateParams(IdParamSchema),
  validate(TransferOwnershipSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.transferOwnership(req, res);
  }),
);

router.get(
  "/:id/stats",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await vehicleController.getVehicleStats(req, res);
  }),
);

export default router;
