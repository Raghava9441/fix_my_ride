import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { validateParams } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { IdParamSchema } from "../dto/common.dto";
import { PaymentController } from "../controllers/payment.controller";
import { paymentService } from "../services/payment.service";

const router = Router();

const paymentController = new PaymentController(paymentService);

router.use(authenticate);

router.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    await paymentController.getAll(req, res);
  }),
);

router.get(
  "/mine",
  asyncHandler(async (req: Request, res: Response) => {
    await paymentController.getMine(req, res);
  }),
);

router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    await paymentController.getStats(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await paymentController.getById(req, res);
  }),
);

export default router;
