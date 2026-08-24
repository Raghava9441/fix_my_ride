import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  InvitationService,
  CreateInvitationInput,
} from "../services/invitation.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

/**
 * Maps an authenticated account's role to the `acceptedByType`/inviter-type
 * discriminator used by the Invitation model's refPath fields.
 */
function toProfileType(
  role?: string,
): "OwnerProfile" | "StaffProfile" | "Account" {
  switch (role) {
    case "owner":
      return "OwnerProfile";
    case "staff":
    case "fleet_manager":
    case "service_advisor":
      return "StaffProfile";
    default:
      return "Account";
  }
}

export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  async getAllInvitations(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      inviteeEmail: req.query.inviteeEmail as string,
      vehicleId: req.query.vehicleId as string,
      serviceCenterId: req.query.serviceCenterId as string,
      status: req.query.status as string,
    };

    const result = await this.invitationService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Invitations retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getMyInvitations(req: Request, res: Response) {
    const invitations = await this.invitationService.findByEmail(
      req.user!.email,
    );

    const response = createSuccessResponse(
      invitations,
      "My invitations retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async validateInvitation(req: Request, res: Response) {
    const token = req.query.token as string;

    const invitation = await this.invitationService.findByToken(token);

    if (!invitation) {
      const error = createErrorResponse(
        "Invitation not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        valid: invitation.isValid(),
        invitation,
      },
      "Invitation validated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getInvitationById(req: Request, res: Response) {
    const { id } = req.params;

    const invitation = await this.invitationService.findById(id);

    if (!invitation) {
      const error = createErrorResponse(
        "Invitation not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      invitation,
      "Invitation retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createInvitation(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    if (data.invitationType === "vehicle_access" && data.vehicleId) {
      const invitation = await this.invitationService.createVehicleAccess({
        inviterId: data.inviterId,
        inviterName: data.inviterName,
        email: data.inviteeEmail,
        phone: data.inviteePhone,
        name: data.inviteeName,
        vehicleId: data.vehicleId,
        serviceCenterId: data.serviceCenterId,
        role: data.role,
        accessLevel: data.accessLevel,
        permissions: data.permissions,
        message: data.message,
      });

      const response = createSuccessResponse(
        invitation,
        "Invitation created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    }

    const input: CreateInvitationInput = {
      tenantId: data.tenantId,
      inviterId: data.inviterId,
      inviterType: data.inviterType,
      inviterName: data.inviterName,
      inviteeEmail: data.inviteeEmail,
      inviteePhone: data.inviteePhone,
      inviteeName: data.inviteeName,
      invitationType: data.invitationType,
      vehicleId: data.vehicleId,
      serviceCenterId: data.serviceCenterId,
      role: data.role,
      accessLevel: data.accessLevel,
      permissions: data.permissions,
      message: data.message,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    };

    const invitation = await this.invitationService.create(input);

    const response = createSuccessResponse(
      invitation,
      "Invitation created successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateInvitation(req: ValidatedRequest<any>, res: Response) {
    // The service exposes only specific state transitions (accept/revoke/
    // sendReminder) — there is no generic field-level update method to call
    // into for arbitrary fields like `message`/`maxUses`/`expiresAt`.
    const error = createErrorResponse(
      "Updating invitation fields directly is not implemented",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async deleteInvitation(req: Request, res: Response) {
    const { id } = req.params;

    const invitation = await this.invitationService.delete(id);

    if (!invitation) {
      const error = createErrorResponse(
        "Invitation not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: invitation._id,
        deleted: true,
        deletedAt: invitation.deletedAt,
      },
      "Invitation deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async acceptInvitation(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const userType = toProfileType(req.user!.role);

    try {
      const invitation = await this.invitationService.accept(
        id,
        userId,
        userType,
      );

      const response = createSuccessResponse(
        invitation,
        "Invitation accepted successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invitation not found") {
        const apiError = createErrorResponse(
          "Invitation not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (
        error.message === "Invitation expired" ||
        error.message === "Invitation invalid"
      ) {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.GONE,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async declineInvitation(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
      const invitation = await this.invitationService.revoke(
        id,
        userId,
        "declined by invitee",
      );

      const response = createSuccessResponse(
        invitation,
        "Invitation declined successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invitation not found") {
        const apiError = createErrorResponse(
          "Invitation not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async resendInvitation(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const sent = await this.invitationService.sendReminder(id);

      if (!sent) {
        const error = createErrorResponse(
          "Maximum reminder count reached",
          HttpStatus.CONFLICT,
        );
        return res.status(error.statusCode).json(error.toJSON());
      }

      const response = createSuccessResponse(
        { id, resentAt: new Date().toISOString() },
        "Invitation resent successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invitation not found") {
        const apiError = createErrorResponse(
          "Invitation not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async revokeInvitation(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const revokedBy = req.user!.id;
    const reason = req.validated?.reason;

    try {
      const invitation = await this.invitationService.revoke(
        id,
        revokedBy,
        reason,
      );

      const response = createSuccessResponse(
        invitation,
        "Invitation revoked successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invitation not found") {
        const apiError = createErrorResponse(
          "Invitation not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }
}
