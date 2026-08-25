import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  CreateInvitationSchema,
  UpdateInvitationSchema,
  RevokeInvitationSchema,
} from "../dto/invitation.dto";
import { IdParamSchema } from "../dto/account.dto";
import { InvitationController } from "../controllers/invitation.controller";
import { invitationService } from "../services/invitation.service";
import { NotifyFn } from "../services/auth.service";
import { enqueue } from "../services/queue.service";
import { EMAIL_QUEUE } from "../workers";

const router = Router();

// Mirrors the identical local helper in auth.routes.ts / onboarding.routes.ts.
const notify: NotifyFn = (type, payload) => {
  void enqueue(EMAIL_QUEUE, { type, data: payload }).catch((err) => {
    console.error("Failed to enqueue notification:", err);
  });
};

const invitationController = new InvitationController(invitationService, notify);

// Token validation is used by an invitee clicking an email link, before they
// have a session — this must stay unauthenticated.
router.get(
  "/validate",
  asyncHandler(async (req: Request, res: Response) => {
    await invitationController.validateInvitation(req, res);
  }),
);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await invitationController.getAllInvitations(req, res);
  }),
);

router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    await invitationController.getMyInvitations(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.getInvitationById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateInvitationSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.createInvitation(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateInvitationSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.updateInvitation(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.deleteInvitation(req, res);
  }),
);

router.post(
  "/:id/accept",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.acceptInvitation(req, res);
  }),
);

router.post(
  "/:id/decline",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.declineInvitation(req, res);
  }),
);

router.post(
  "/:id/resend",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.resendInvitation(req, res);
  }),
);

router.post(
  "/:id/revoke",
  validateParams(IdParamSchema),
  validate(RevokeInvitationSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await invitationController.revokeInvitation(req, res);
  }),
);

export default router;
