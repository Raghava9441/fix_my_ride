import { Router, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, validateParams, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { IdParamSchema } from "../dto/common.dto";
import { CreateSubscriptionSchema, CancelSubscriptionSchema } from "../dto/subscription.dto";
import { SubscriptionController } from "../controllers/subscription.controller";
import { subscriptionService } from "../services/subscription.service";

const router = Router();

const subscriptionController = new SubscriptionController(subscriptionService);

router.use(authenticate);

router.get(
  "/me",
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionController.getMine(req, res);
  }),
);

router.post(
  "/subscribe",
  requireRole("owner"),
  validate(CreateSubscriptionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionController.subscribe(req, res);
  }),
);

router.post(
  "/:id/cancel",
  requireRole("owner", "admin"),
  validateParams(IdParamSchema),
  validate(CancelSubscriptionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionController.cancel(req, res);
  }),
);

export default router;
