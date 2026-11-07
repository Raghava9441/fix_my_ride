import { Router, Response } from "express";
import { asyncHandler } from "../utils";
import { validate, ValidatedRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { requireStaffSide } from "../middleware/authorization.middleware";
import { ParseVoiceIntakeSchema, ConfirmVoiceIntakeSchema } from "../dto/voice-intake.dto";
import { VoiceIntakeController } from "../controllers/voiceIntake.controller";
import { voiceIntakeService } from "../services/voiceIntake.service";

const router = Router();

router.use(authenticate, requireStaffSide);

const voiceIntakeController = new VoiceIntakeController(voiceIntakeService);

// Writes nothing: merges the spoken text into the client's draft and reports
// what is still missing.
router.post(
  "/parse",
  validate(ParseVoiceIntakeSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await voiceIntakeController.parse(req, res);
  }),
);

// The only call that writes: owner + vehicle + job card.
router.post(
  "/confirm",
  validate(ConfirmVoiceIntakeSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await voiceIntakeController.confirm(req, res);
  }),
);

export default router;
