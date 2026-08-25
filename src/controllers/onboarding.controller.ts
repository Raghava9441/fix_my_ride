import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { OnboardingService } from "../services/onboarding.service";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { HttpStatus, createSuccessResponse, createErrorResponse } from "../utils";
import { NotifyFn } from "../services/auth.service";

export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly notify: NotifyFn,
  ) {}

  async signup(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;
    // Thrown AppErrors (duplicate email/slug/registration number, weak
    // password) already carry the right httpStatus/code and propagate to
    // the global error handler — no local mapping needed, same as /register.
    const result = await this.onboardingService.signup({
      ...data,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      notify: this.notify,
    });

    const response = createSuccessResponse(
      {
        id: result.account._id,
        email: result.account.email,
        organizationName: result.tenant.name,
        organizationSlug: result.tenant.slug,
        ...result.tokens,
      },
      "Application submitted — check your email to verify, and we'll review your organization shortly",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStatus(req: Request, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      const error = createErrorResponse(
        "Your account isn't associated with an organization",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const [account, tenant] = await Promise.all([
      Account.findById(req.user!.id).select("emailVerified status"),
      Tenant.findById(tenantId).select("name onboarding"),
    ]);

    if (!tenant) {
      const error = createErrorResponse("Organization not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        organizationName: tenant.name,
        emailVerified: account?.emailVerified ?? false,
        onboardingStatus: tenant.onboarding.status,
        rejectionReason: tenant.onboarding.rejectionReason,
        ready: (account?.emailVerified ?? false) && tenant.onboarding.status === "approved",
      },
      "Onboarding status retrieved",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
