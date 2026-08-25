import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, validateParams, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { IdParamSchema } from "../dto/common.dto";
import { CreateInvoiceSchema, VoidInvoiceSchema } from "../dto/invoice.dto";
import { InvoiceController } from "../controllers/invoice.controller";
import { invoiceService } from "../services/invoice.service";

const router = Router();

const invoiceController = new InvoiceController(invoiceService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await invoiceController.getAll(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await invoiceController.getById(req, res);
  }),
);

// Invoices are created by service center staff for a customer, not
// self-service — an owner shouldn't be able to invoice themselves.
router.post(
  "/",
  requireRole("staff", "admin"),
  validate(CreateInvoiceSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invoiceController.create(req, res);
  }),
);

router.post(
  "/:id/pay",
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await invoiceController.pay(req, res);
  }),
);

router.post(
  "/:id/send",
  requireRole("staff", "admin"),
  validateParams(IdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await invoiceController.markAsSent(req, res);
  }),
);

router.post(
  "/:id/void",
  requireRole("staff", "admin"),
  validateParams(IdParamSchema),
  validate(VoidInvoiceSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invoiceController.void(req, res);
  }),
);

export default router;
