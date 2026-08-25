import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { SignupOrganizationSchema } from "../dto/onboarding.dto";
import { OnboardingController } from "../controllers/onboarding.controller";
import { onboardingService } from "../services/onboarding.service";
import { NotifyFn } from "../services/auth.service";
import { enqueue } from "../services/queue.service";
import { EMAIL_QUEUE } from "../workers";

const router = Router();

// Mirrors the identical local helper in auth.routes.ts.
const notify: NotifyFn = (type, payload) => {
  void enqueue(EMAIL_QUEUE, { type, data: payload }).catch((err) => {
    console.error("Failed to enqueue notification:", err);
  });
};

const onboardingController = new OnboardingController(onboardingService, notify);

router.post(
  "/signup",
  validate(SignupOrganizationSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await onboardingController.signup(req, res);
  }),
);

router.get(
  "/status",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await onboardingController.getStatus(req, res);
  }),
);

export default router;
