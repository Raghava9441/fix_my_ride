import { Router, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { UpdateMyTenantSchema } from "../dto/tenant.dto";
import { TenantController } from "../controllers/tenant.controller";
import { tenantService } from "../services/tenant.service";

const router = Router();

const tenantController = new TenantController(tenantService);

router.use(authenticate);

router.get(
  "/me",
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await tenantController.getMine(req, res);
  }),
);

router.patch(
  "/me",
  requireRole("owner"),
  validate(UpdateMyTenantSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await tenantController.updateMine(req, res);
  }),
);

export default router;
