import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const publicController = {
  healthCheck: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { status: "healthy", timestamp: new Date().toISOString() };
      const response = createSuccessResponse(
        result,
        "Service is healthy",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  detailedHealthCheck: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        status: "healthy",
        database: "connected",
        cache: "connected",
        uptime: "30 days",
      };
      const response = createSuccessResponse(
        result,
        "Detailed health check",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getSystemInfo: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        name: "FixMyRide",
        environment: "production",
        region: "India",
      };
      const response = createSuccessResponse(
        result,
        "System info retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getVersion: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { version: "1.0.0", build: "2024.01.01" };
      const response = createSuccessResponse(
        result,
        "Version info retrieved",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPublicServiceCenters: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "center-1",
          name: "Quick Fix Auto",
          address: "123 Main St",
          rating: 4.5,
        },
        {
          id: "center-2",
          name: "Premium Motors",
          address: "456 Oak Ave",
          rating: 4.8,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Service centers retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPublicServiceCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "Quick Fix Auto",
        address: "123 Main St",
        phone: "+1234567890",
        rating: 4.5,
        verified: true,
      };
      const response = createSuccessResponse(
        result,
        "Service center retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPublicReviews: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "review-1",
          rating: 5,
          comment: "Great service!",
          date: "2024-01-15",
        },
        {
          id: "review-2",
          rating: 4,
          comment: "Good experience",
          date: "2024-02-01",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Reviews retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  submitContactForm: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "contact-new",
        ...req.body,
        submittedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Contact form submitted successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  subscribeNewsletter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { email: req.body.email, subscribed: true };
      const response = createSuccessResponse(
        result,
        "Subscribed to newsletter successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  unsubscribeNewsletter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { email: req.body.email, subscribed: false };
      const response = createSuccessResponse(
        result,
        "Unsubscribed from newsletter successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  requestDemo: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "demo-new", ...req.body, status: "pending" };
      const response = createSuccessResponse(
        result,
        "Demo request submitted successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOnboardingStatus: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { step: 1, progress: "25%" };
      const response = createSuccessResponse(
        result,
        "Onboarding status retrieved",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/public/health", publicController.healthCheck);
router.get("/public/health/detailed", publicController.detailedHealthCheck);
router.get("/public/info", publicController.getSystemInfo);
router.get("/public/version", publicController.getVersion);
router.get("/public/service-centers", publicController.getPublicServiceCenters);
router.get(
  "/public/service-centers/:id",
  publicController.getPublicServiceCenter,
);
router.get(
  "/public/service-centers/:id/reviews",
  publicController.getPublicReviews,
);
router.post("/public/contact", publicController.submitContactForm);
router.post(
  "/public/newsletter/subscribe",
  publicController.subscribeNewsletter,
);
router.post(
  "/public/newsletter/unsubscribe",
  publicController.unsubscribeNewsletter,
);
router.get("/public/demo/request", publicController.requestDemo);
router.get("/public/onboarding/status", publicController.getOnboardingStatus);

export default router;
