import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, validateParams, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { cacheResponse } from "../middleware/cache.middleware";
import { IdParamSchema } from "../dto/common.dto";
import {
  CreateSubscriptionPlanSchema,
  UpdateSubscriptionPlanSchema,
} from "../dto/subscription-plan.dto";
import { SubscriptionPlanController } from "../controllers/subscriptionPlan.controller";
import { subscriptionPlanService } from "../services/subscriptionPlan.service";

const router = Router();

const subscriptionPlanController = new SubscriptionPlanController(subscriptionPlanService);

// Pricing-page read: public, no auth — a prospective tenant needs to see
// plans before signing up. Same response for everyone and rarely changes,
// so it gets the longest TTL and skips varying the cache key by tenant/role.
router.get(
  "/public",
  cacheResponse({ ttlSeconds: 300, varyByAuth: false }),
  asyncHandler(async (req: Request, res: Response) => {
    await subscriptionPlanController.getPublic(req, res);
  }),
);

router.use(authenticate);

router.get(
  "/",
  cacheResponse({ ttlSeconds: 60 }),
  asyncHandler(async (req: Request, res: Response) => {
    await subscriptionPlanController.getAll(req, res);
  }),
);

router.get(
  "/compare",
  cacheResponse({ ttlSeconds: 60 }),
  asyncHandler(async (req: Request, res: Response) => {
    await subscriptionPlanController.compare(req, res);
  }),
);

router.get(
  "/slug/:slug",
  cacheResponse({ ttlSeconds: 60 }),
  asyncHandler(async (req: Request, res: Response) => {
    await subscriptionPlanController.getBySlug(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  cacheResponse({ ttlSeconds: 60 }),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionPlanController.getById(req, res);
  }),
);

router.post(
  "/",
  requireRole("admin"),
  validate(CreateSubscriptionPlanSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionPlanController.create(req, res);
  }),
);

router.put(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  validate(UpdateSubscriptionPlanSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionPlanController.update(req, res);
  }),
);

router.delete(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await subscriptionPlanController.delete(req, res);
  }),
);

export default router;
