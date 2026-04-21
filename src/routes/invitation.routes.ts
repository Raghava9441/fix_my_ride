import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const invitationController = {
  getAllInvitations: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "invitation-1",
          email: "john@example.com",
          role: "staff",
          status: "pending",
          expiresAt: "2024-04-30",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Invitations retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getMyInvitations: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "invitation-1",
          from: "admin@example.com",
          role: "staff",
          status: "pending",
        },
      ];
      const response = createSuccessResponse(
        result,
        "My invitations retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  validateInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { valid: true, token: req.query.token };
      const response = createSuccessResponse(
        result,
        "Invitation validated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getInvitationById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        email: "john@example.com",
        role: "staff",
        status: "pending",
      };
      const response = createSuccessResponse(
        result,
        "Invitation retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "new-invitation-id",
        ...req.body,
        status: "pending",
        token: "dummy-token-123",
      };
      const response = createSuccessResponse(
        result,
        "Invitation created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Invitation updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, deleted: true };
      const response = createSuccessResponse(
        result,
        "Invitation deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  acceptInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Invitation accepted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  declineInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        status: "declined",
        declinedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Invitation declined successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  resendInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, resentAt: new Date().toISOString() };
      const response = createSuccessResponse(
        result,
        "Invitation resent successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  revokeInvitation: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        status: "revoked",
        revokedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Invitation revoked successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/invitations", invitationController.getAllInvitations);
router.get("/invitations/me", invitationController.getMyInvitations);
router.get("/invitations/validate", invitationController.validateInvitation);
router.get("/invitations/:id", invitationController.getInvitationById);
router.post("/invitations", invitationController.createInvitation);
router.put("/invitations/:id", invitationController.updateInvitation);
router.delete("/invitations/:id", invitationController.deleteInvitation);
router.post("/invitations/:id/accept", invitationController.acceptInvitation);
router.post("/invitations/:id/decline", invitationController.declineInvitation);
router.post("/invitations/:id/resend", invitationController.resendInvitation);
router.post("/invitations/:id/revoke", invitationController.revokeInvitation);

export default router;
