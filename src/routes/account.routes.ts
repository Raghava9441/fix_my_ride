import { Router, Request, Response } from "express";
import { asyncHandler, HttpStatus } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  AssignRoleSchema,
  SwitchRoleSchema,
  UpdateAccountStatusSchema,
  IdParamSchema,
} from "../dto/account.dto";
import { AccountController } from "../controllers/account.controller";
import { accountService } from "../services/account.service";

const router = Router();

const accountController = new AccountController(accountService);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await accountController.getAll(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    req.params.id = req.validated?.id || req.params.id;
    await accountController.getById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateAccountSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.create(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateAccountSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.update(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.delete(req, res);
  }),
);

router.patch(
  "/:id/status",
  validateParams(IdParamSchema),
  validate(UpdateAccountStatusSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.updateStatus(req, res);
  }),
);

router.post(
  "/:id/roles",
  validateParams(IdParamSchema),
  validate(AssignRoleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.assignRole(req, res);
  }),
);

router.delete(
  "/:id/roles/:roleId",
  validateParams({
    id: IdParamSchema.shape.id,
    roleId: IdParamSchema.shape.id,
  }),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.removeRole(req, res);
  }),
);

router.get(
  "/:id/permissions",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.getPermissions(req, res);
  }),
);

router.post(
  "/switch-role",
  validate(SwitchRoleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await accountController.switchRole(req, res);
  }),
);

export default router;
