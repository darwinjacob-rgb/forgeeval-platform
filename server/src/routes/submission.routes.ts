import { Router } from "express";
import {
  getSubmissions,
  getSubmissionById,
  getRepositoryStatus,
  createSubmission,
  updateSubmission,
  deleteSubmission,
} from "../controllers/submission.controller.ts";
import { toggleReleaseSubmission } from "../controllers/participant.controller.ts";
import { requireAuth, optionalAuth, requireRole } from "../middleware/auth.ts";

const router = Router();

router.get("/", optionalAuth, getSubmissions);
router.get("/:id", optionalAuth, getSubmissionById);
router.get("/:id/repository-status", optionalAuth, getRepositoryStatus);
router.post("/:id/release", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), toggleReleaseSubmission);
router.post("/", requireAuth, createSubmission);
router.put("/:id", requireAuth, updateSubmission);
router.delete("/:id", requireAuth, deleteSubmission);

export default router;
