import { Router } from "express";
import {
  getProblems,
  getProblemById,
  createProblem,
  updateProblem,
  deleteProblem,
  analyzeProblemStatement,
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
} from "../controllers/problem.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ── Problem CRUD (existing, unchanged) ─────────────────
router.get("/", getProblems);
router.get("/:id", getProblemById);
router.post("/", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), createProblem);
router.put("/:id", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), updateProblem);
router.delete("/:id", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), deleteProblem);

// ── Phase 1: Requirement Extraction & Management ───────
// POST  /problems/:id/analyze       — run extraction on rawStatement
router.post("/:id/analyze", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), analyzeProblemStatement);

// GET   /problems/:id/requirements  — list extracted requirements
router.get("/:id/requirements", getRequirements);

// POST  /problems/:id/requirements  — manually add one
router.post("/:id/requirements", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), createRequirement);

// PUT   /problems/:problemId/requirements/:reqId
router.put("/:problemId/requirements/:reqId", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), updateRequirement);

// DELETE /problems/:problemId/requirements/:reqId
router.delete("/:problemId/requirements/:reqId", requireAuth, requireRole(["ADMIN", "ORGANIZER"]), deleteRequirement);

export default router;
