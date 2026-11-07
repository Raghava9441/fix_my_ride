import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { VoiceIntakeService } from "../services/voiceIntake.service";
import { StaffProfile } from "../models/StaffProfile";
import { AppError } from "../utils/appError";
import { HttpStatus, createSuccessResponse } from "../utils";

export class VoiceIntakeController {
  constructor(private readonly voiceIntakeService: VoiceIntakeService) {}

  async parse(req: ValidatedRequest<any>, res: Response) {
    const { transcript, draft } = req.validated;
    const result = await this.voiceIntakeService.parse(transcript, draft);

    const response = createSuccessResponse(result, "Voice input processed");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async confirm(req: ValidatedRequest<any>, res: Response) {
    const { draft, serviceCenterId: bodyCenterId } = req.validated;
    const accountId = req.user!.id;

    // A staff member can only create job cards at their own center.
    const staff = await StaffProfile.findOne({ accountId, isDeleted: false });
    const serviceCenterId = staff ? String(staff.serviceCenterId) : bodyCenterId;
    if (!serviceCenterId) {
      throw AppError.fromCode("VALIDATION_FAILED", {
        correlationId: (req as Request & { id?: string }).id,
        details: [{ field: "serviceCenterId", message: "serviceCenterId is required" }],
      });
    }

    const result = await this.voiceIntakeService.confirm({
      draft,
      serviceCenterId,
      tenantId: req.tenantId,
      createdByAccountId: accountId,
    });

    const response = createSuccessResponse(result, "Job card created", HttpStatus.CREATED);
    return res.status(response.statusCode).json(response.toJSON());
  }
}
