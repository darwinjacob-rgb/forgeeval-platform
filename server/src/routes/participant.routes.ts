import { Router } from "express";
import {
  getParticipantDashboard,
  createParticipantSubmission,
  getParticipantSubmissions,
  getParticipantSubmissionById,
  getParticipantResults,
  getParticipantProfile,
  updateParticipantProfile,
  toggleReleaseSubmission,
  getParticipantRepositoryStatus,
} from "../controllers/participant.controller.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const router = Router();

// Participant endpoints (protected by requireAuth)
router.get("/dashboard", requireAuth, getParticipantDashboard);
router.post("/submissions", requireAuth, createParticipantSubmission);
router.get("/submissions", requireAuth, getParticipantSubmissions);
router.get("/submissions/:id", requireAuth, getParticipantSubmissionById);
router.get("/submissions/:id/repository-status", requireAuth, getParticipantRepositoryStatus);
router.get("/results", requireAuth, getParticipantResults);
router.get("/profile", requireAuth, getParticipantProfile);
router.put("/profile", requireAuth, updateParticipantProfile);

// Organizer / Admin release endpoint
router.post("/submissions/:id/release", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), toggleReleaseSubmission);

export default router;
