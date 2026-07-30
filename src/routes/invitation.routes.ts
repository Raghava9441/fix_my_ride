import { Router } from "express";
import { invitationController } from "../controllers/invitation.controller";

const router = Router();

router.get("/", invitationController.getAllInvitations);
router.get("/me", invitationController.getMyInvitations);
router.get("/validate", invitationController.validateInvitation);
router.get("/:id", invitationController.getInvitationById);
router.post("/", invitationController.createInvitation);
router.put("/:id", invitationController.updateInvitation);
router.delete("/:id", invitationController.deleteInvitation);
router.post("/:id/accept", invitationController.acceptInvitation);
router.post("/:id/decline", invitationController.declineInvitation);
router.post("/:id/resend", invitationController.resendInvitation);
router.post("/:id/revoke", invitationController.revokeInvitation);

export default router;
