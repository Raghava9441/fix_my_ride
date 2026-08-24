import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { validateParams, ValidatedRequest } from "../middleware/validation.middleware";
import { IdParamSchema } from "../dto/account.dto";
import { AuditLogController } from "../controllers/audit.controller";
import { auditLogService } from "../services/audit.service";

const router = Router();

const ActorParamSchema = z.object({ actorId: IdParamSchema.shape.id });

const auditLogController = new AuditLogController(auditLogService);

// Audit trails span every tenant's sensitive actions — admin-only, not just authenticated.
router.use(authenticate, requireRole("admin"));

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await auditLogController.getAll(req, res);
  }),
);

router.get(
  "/summary",
  asyncHandler(async (req: Request, res: Response) => {
    await auditLogController.getActivitySummary(req, res);
  }),
);

router.get(
  "/entity/:entityType/:entityId",
  asyncHandler(async (req: Request, res: Response) => {
    await auditLogController.getByEntity(req, res);
  }),
);

router.get(
  "/actor/:actorId",
  validateParams(ActorParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await auditLogController.getByActor(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await auditLogController.getById(req, res);
  }),
);

export default router;
