import { Router } from "express";
import { publicController } from "../controllers/public.controller";

const router = Router();

router.get("/health", publicController.healthCheck);
router.get("/health/detailed", publicController.detailedHealthCheck);
router.get("/info", publicController.getSystemInfo);
router.get("/version", publicController.getVersion);
router.get("/service-centers", publicController.getPublicServiceCenters);
router.get(
  "/service-centers/:id",
  publicController.getPublicServiceCenter,
);
router.get(
  "/service-centers/:id/reviews",
  publicController.getPublicReviews,
);
router.post("/contact", publicController.submitContactForm);
router.post(
  "/newsletter/subscribe",
  publicController.subscribeNewsletter,
);
router.post(
  "/newsletter/unsubscribe",
  publicController.unsubscribeNewsletter,
);
router.get("/demo/request", publicController.requestDemo);
router.get("/onboarding/status", publicController.getOnboardingStatus);

export default router;
