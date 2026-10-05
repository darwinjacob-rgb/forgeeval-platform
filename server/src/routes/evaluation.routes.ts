import { Router } from "express";
import {
  triggerEvaluation,
  getPipelineStatus,
  getRequirementMapping,
  getSecurityFindings,
  updateFindingStatus,
  getRuntimeResults,
  getFinalResult,
  getScoringConfig,
  updateScoringConfig,
  saveJudgeOverride,
  reevaluateSubmission,
  getAIEvaluationDetails,
  getSecurityReport,
  getRuntimeReport,
} from "../controllers/evaluation.controller.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

// Phase 3 Scoring Weight Configuration
router.get("/scoring-config", getScoringConfig);
router.post("/scoring-config", requireAuth, updateScoringConfig);

// Phase 2 Pipeline Endpoints
router.post("/:id/evaluate", triggerEvaluation);
router.get("/:id/pipeline-status", getPipelineStatus);
router.get("/:id/requirement-mapping", getRequirementMapping);
router.get("/:id/security-findings", getSecurityFindings);
router.patch("/:id/security-findings/:findingId", requireAuth, updateFindingStatus);
router.get("/:id/runtime-results", getRuntimeResults);

// Phase 3 Evaluation Results & Judge Override Endpoints
router.get("/:id/final-result", getFinalResult);
router.post("/:id/judge-override", requireAuth, saveJudgeOverride);

// Legacy & Re-evaluation endpoints
router.post("/:id/re-evaluate", requireAuth, reevaluateSubmission);
router.get("/:id/ai-details", getAIEvaluationDetails);
router.get("/:id/security-report", getSecurityReport);
router.get("/:id/runtime-report", getRuntimeReport);

export default router;
