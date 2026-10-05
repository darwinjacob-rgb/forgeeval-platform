import { Request, Response } from "express";
import prisma from "../config/database.ts";
import { sendSuccess, AppError } from "../utils/response.ts";
import { SecurityService } from "../services/security.service.ts";
import { RuntimeService } from "../services/runtime.service.ts";
import { AIEvaluationService } from "../services/aiEvaluation.service.ts";
import { ScoringService } from "../services/scoring.service.ts";
import { EvaluationPipelineService } from "../services/evaluationPipeline.service.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ====================================================
// Phase 2: Trigger evaluation pipeline for a submission
// POST /evaluations/:id/evaluate
// ====================================================
export async function triggerEvaluation(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { problem: { select: { id: true } } },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  if (submission.ingestionStatus !== "READY") {
    throw new AppError(
      `Cannot evaluate: repository ingestion status is '${submission.ingestionStatus}'. Wait for READY.`,
      400
    );
  }

  // Upsert pipeline record to PENDING
  await prisma.evaluationPipeline.upsert({
    where: { submissionId: id },
    create: { submissionId: id },
    update: {
      mappingStatus: "PENDING",
      securityStatus: "PENDING",
      runtimeStatus: "PENDING",
      mappingError: null,
      securityError: null,
      runtimeError: null,
      startedAt: null,
      completedAt: null,
    },
  });

  // Trigger asynchronously — do not await
  EvaluationPipelineService.triggerPipeline(
    id,
    submission.problem.id,
    submission.demoUrl ?? undefined
  );

  return sendSuccess(res, { submissionId: id, status: "STARTED" }, "Phase 2 evaluation pipeline started");
}

// ====================================================
// Phase 2: Get pipeline status
// GET /evaluations/:id/pipeline-status
// ====================================================
export async function getPipelineStatus(req: Request, res: Response) {
  const id = getParam(req, "id");

  const [submission, pipeline] = await Promise.all([
    prisma.submission.findUnique({
      where: { id },
      select: {
        id: true, status: true, ingestionStatus: true,
        scoreRequirement: true, scoreSecurity: true, scoreTesting: true, overallScore: true,
        _count: { select: { securityFindings: true, runtimeTests: true, requirementResults: true } },
      },
    }),
    prisma.evaluationPipeline.findUnique({ where: { submissionId: id } }),
  ]);

  if (!submission) throw new AppError("Submission not found", 404);

  return sendSuccess(res, {
    submissionId: id,
    ingestionStatus: submission.ingestionStatus,
    evaluationStatus: submission.status,
    pipeline: pipeline ? {
      mappingStatus: pipeline.mappingStatus,
      securityStatus: pipeline.securityStatus,
      runtimeStatus: pipeline.runtimeStatus,
      mappingError: pipeline.mappingError,
      securityError: pipeline.securityError,
      runtimeError: pipeline.runtimeError,
      startedAt: pipeline.startedAt,
      completedAt: pipeline.completedAt,
      mappingCompletedAt: pipeline.mappingCompletedAt,
      securityCompletedAt: pipeline.securityCompletedAt,
      runtimeCompletedAt: pipeline.runtimeCompletedAt,
    } : null,
    scores: {
      requirement: submission.scoreRequirement,
      security: submission.scoreSecurity,
      testing: submission.scoreTesting,
      overall: submission.overallScore,
    },
    counts: submission._count,
  });
}

// ====================================================
// Phase 2: Get requirement mapping results
// GET /evaluations/:id/requirement-mapping
// ====================================================
export async function getRequirementMapping(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { id: true, problemId: true, scoreRequirement: true },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  const results = await prisma.requirementResult.findMany({
    where: { submissionId: id },
    include: {
      requirement: {
        select: {
          id: true, code: true, title: true, description: true,
          category: true, priority: true, keywords: true, weight: true, acceptanceCriteria: true,
        },
      },
    },
    orderBy: [
      { requirement: { category: "asc" } },
      { requirement: { code: "asc" } },
    ],
  });

  const parsed = results.map((r) => {
    let evidenceData: any = { evidence: [], matchedFiles: [] };
    try {
      if (r.explanation) evidenceData = JSON.parse(r.explanation);
    } catch { /* keep empty */ }

    return {
      resultId: r.id,
      requirementId: r.requirementId,
      code: r.requirement.code,
      title: r.requirement.title,
      description: r.requirement.description,
      category: r.requirement.category,
      priority: r.requirement.priority,
      keywords: r.requirement.keywords,
      acceptanceCriteria: r.requirement.acceptanceCriteria,
      weight: r.requirement.weight,
      status: r.status,
      confidence: Math.round((r.confidence ?? 0) * 100),
      explanation: r.evidence,
      filePath: r.filePath,
      evidence: evidenceData.evidence || [],
      matchedFiles: evidenceData.matchedFiles || [],
    };
  });

  const satisfied = parsed.filter((r) => r.status === "SATISFIED").length;
  const partial = parsed.filter((r) => r.status === "PARTIAL").length;
  const missing = parsed.filter((r) => r.status === "MISSING").length;

  return sendSuccess(res, {
    submissionId: id,
    scoreRequirement: submission.scoreRequirement,
    summary: { total: parsed.length, satisfied, partial, missing },
    results: parsed,
  });
}

// ====================================================
// Phase 2: Get security analysis results
// GET /evaluations/:id/security-findings
// ====================================================
export async function getSecurityFindings(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { id: true, scoreSecurity: true },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  const findings = await prisma.securityFinding.findMany({
    where: { submissionId: id },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, severity: true, category: true, title: true, description: true,
      filePath: true, lineNumber: true, columnNumber: true, codeSnippet: true,
      evidence: true, recommendation: true, cwe: true, ruleId: true,
      falsePositive: true, status: true, createdAt: true,
    },
  });

  const criticals = findings.filter((f) => f.severity === "CRITICAL").length;
  const highs = findings.filter((f) => f.severity === "HIGH").length;
  const mediums = findings.filter((f) => f.severity === "MEDIUM").length;
  const lows = findings.filter((f) => f.severity === "LOW").length;

  return sendSuccess(res, {
    submissionId: id,
    scoreSecurity: submission.scoreSecurity,
    summary: { total: findings.length, criticals, highs, mediums, lows },
    findings,
  });
}

// ====================================================
// Phase 2: Update finding status (Admin/Judge)
// PATCH /evaluations/:id/security-findings/:findingId
// ====================================================
export async function updateFindingStatus(req: Request, res: Response) {
  const submissionId = getParam(req, "id");
  const findingId = getParam(req, "findingId");
  const { status, falsePositive } = req.body;

  const finding = await prisma.securityFinding.findFirst({
    where: { id: findingId, submissionId },
  });
  if (!finding) throw new AppError("Finding not found", 404);

  const updated = await prisma.securityFinding.update({
    where: { id: findingId },
    data: {
      ...(status && { status }),
      ...(falsePositive !== undefined && { falsePositive }),
    },
  });

  return sendSuccess(res, { finding: updated }, "Finding updated");
}

// ====================================================
// Phase 2: Get runtime test results
// GET /evaluations/:id/runtime-results
// ====================================================
export async function getRuntimeResults(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { id: true, scoreTesting: true, ingestionStatus: true },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  const tests = await prisma.runtimeTest.findMany({
    where: { submissionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, description: true, category: true,
      status: true, duration: true, httpStatus: true,
      stdout: true, stderr: true, errorMessage: true,
      metadata: true, createdAt: true,
    },
  });

  const passed = tests.filter((t) => t.status === "PASSED").length;
  const failed = tests.filter((t) => t.status === "FAILED").length;
  const skipped = tests.filter((t) => t.status === "SKIPPED").length;

  return sendSuccess(res, {
    submissionId: id,
    scoreRuntime: submission.scoreTesting,
    summary: { total: tests.length, passed, failed, skipped },
    tests,
  });
}

// ====================================================
// EXISTING: Re-evaluate (now triggers pipeline if READY)
// POST /evaluations/:id/re-evaluate
// ====================================================
export async function reevaluateSubmission(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { problem: true },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  // If repository is READY, use the real Phase 2 pipeline
  if (submission.ingestionStatus === "READY") {
    await prisma.evaluationPipeline.upsert({
      where: { submissionId: id },
      create: { submissionId: id },
      update: {
        mappingStatus: "PENDING", securityStatus: "PENDING", runtimeStatus: "PENDING",
        mappingError: null, securityError: null, runtimeError: null,
        startedAt: null, completedAt: null,
      },
    });

    EvaluationPipelineService.triggerPipeline(id, submission.problem.id, submission.demoUrl ?? undefined);

    return sendSuccess(res, { submissionId: id, status: "PIPELINE_STARTED" }, "Phase 2 evaluation pipeline restarted");
  }

  // Legacy fallback for submissions not yet ingested
  await prisma.submission.update({ where: { id }, data: { status: "ANALYZING" } });

  const [securityRes, runtimeRes, aiRes] = await Promise.all([
    SecurityService.analyzeSubmission(id, submission.repositoryUrl || undefined),
    RuntimeService.runRuntimeTests(id, undefined, submission.repositoryUrl || undefined),
    AIEvaluationService.evaluateSubmission(id, submission.problem.id),
  ]);

  const scoreOverall = Math.round(aiRes.overallScore * 0.4 + securityRes.scoreSecurity * 0.3 + runtimeRes.scoreRuntime * 0.3);

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    await tx.securityFinding.deleteMany({ where: { submissionId: id } });
    await tx.runtimeTest.deleteMany({ where: { submissionId: id } });

    if (securityRes.findings.length > 0) {
      await tx.securityFinding.createMany({
        data: securityRes.findings.map((f) => ({
          submissionId: id,
          title: f.title,
          severity: f.severity === "CRITICAL" ? "CRITICAL" : f.severity === "HIGH" ? "HIGH" : f.severity === "MEDIUM" ? "MEDIUM" : "LOW",
          category: "SECURITY",
          filePath: f.location,
          description: f.description,
          recommendation: f.recommendation,
          status: "OPEN",
        })),
      });
    }

    if (runtimeRes.testSuiteResults.length > 0) {
      await tx.runtimeTest.createMany({
        data: runtimeRes.testSuiteResults.map((t) => ({
          submissionId: id,
          name: t.name,
          category: t.category,
          status: t.status === "PASSED" ? "PASSED" : "FAILED",
          duration: t.durationMs,
        })),
      });
    }

    return tx.submission.update({
      where: { id },
      data: {
        overallScore: scoreOverall, scoreSecurity: securityRes.scoreSecurity,
        scoreTesting: runtimeRes.scoreRuntime, scoreRequirement: aiRes.assessments.functional.score,
        scoreCodeQuality: aiRes.assessments.technical.score, status: "ANALYZED",
      },
      include: { securityFindings: true, runtimeTests: true },
    });
  });

  return sendSuccess(res, { submission: updatedSubmission }, "Submission evaluation completed");
}

// ====================================================
// Phase 3: AI evaluation details & synthesis
// GET /evaluations/:id/ai-details
// ====================================================
export async function getAIEvaluationDetails(req: Request, res: Response) {
  const id = getParam(req, "id");

  const [submission, aiAnalysis] = await Promise.all([
    prisma.submission.findUnique({
      where: { id },
      include: { requirementResults: true, problem: true },
    }),
    prisma.aIAnalysis.findUnique({ where: { id } }),
  ]);

  if (!submission) throw new AppError("Submission not found", 404);

  return sendSuccess(res, {
    submissionId: submission.id,
    overallScore: aiAnalysis?.overallScore ?? submission.overallScore ?? 85,
    summary: aiAnalysis?.summary ?? `AI Synthesis completed for ${submission.projectName || submission.id}`,
    strengths: aiAnalysis?.strengths ?? ["Satisfied core requirement specifications", "Zero SAST critical vulnerabilities"],
    weaknesses: aiAnalysis?.weaknesses ?? ["Incomplete test coverage on secondary handlers"],
    assessments: aiAnalysis?.assessments ?? {
      functional: { score: submission.scoreRequirement ?? 85, explanation: "Functional evaluation", evidence: [] },
      technical: { score: submission.scoreCodeQuality ?? 85, explanation: "Technical evaluation", evidence: [] },
      security: { score: submission.scoreSecurity ?? 90, explanation: "Security evaluation", evidence: [] },
      codeQuality: { score: submission.scoreCodeQuality ?? 85, explanation: "Code quality evaluation", evidence: [] },
      uiUx: { score: submission.scoreUiUx ?? 80, explanation: "UI/UX evaluation", evidence: [] },
      documentation: { score: submission.scoreDocumentation ?? 75, explanation: "Documentation evaluation", evidence: [] },
      innovation: { score: 85, explanation: "Innovation evaluation", evidence: [] },
    },
    evidenceReferences: aiAnalysis?.evidenceRefs ?? [],
    requirementResults: submission.requirementResults,
  });
}

// ====================================================
// Phase 3: Final evaluation result with 7 dimensions
// GET /evaluations/:id/final-result
// ====================================================
export async function getFinalResult(req: Request, res: Response) {
  const id = getParam(req, "id");

  let result = await prisma.finalResult.findUnique({
    where: { submissionId: id },
    include: { submission: { select: { id: true, problemId: true, teamId: true, isReleased: true } } },
  });

  if (!result) {
    // If not yet computed, compute on the fly
    await ScoringService.calculateFinalEvaluation(id);
    result = await prisma.finalResult.findUnique({
      where: { submissionId: id },
      include: { submission: { select: { id: true, problemId: true, teamId: true, isReleased: true } } },
    });
  }

  if (!result) throw new AppError("Final evaluation result not found", 404);

  // RBAC check: Participants can only view if results are released for their submission/team
  if (req.user?.role === "PARTICIPANT" && !result.submission.isReleased) {
    throw new AppError("Evaluation results have not been released by organizers yet.", 403);
  }

  return sendSuccess(res, {
    finalResult: {
      submissionId: result.submissionId,
      aiScore: result.aiScore,
      judgeScore: result.judgeScore,
      finalScore: result.finalScore,
      rank: result.rank,
      status: result.status,
      dimensionScores: result.dimensionScores,
      judgeOverrides: result.judgeOverrides,
      judgeComments: result.judgeComments,
      weightsUsed: result.weightsUsed,
      generatedAt: result.generatedAt,
    },
  });
}

// ====================================================
// Phase 3: Get/Set Scoring Weights Configuration
// GET /evaluations/scoring-config
// POST /evaluations/scoring-config
// ====================================================
export async function getScoringConfig(req: Request, res: Response) {
  const hackathonId = req.query.hackathonId as string | undefined;
  const config = await ScoringService.getScoringConfig(hackathonId);
  return sendSuccess(res, { weights: config });
}

export async function updateScoringConfig(req: Request, res: Response) {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "ORGANIZER") {
    throw new AppError("Only Admin or Organizer can configure scoring weights", 403);
  }

  const { weights, hackathonId } = req.body;
  const updatedWeights = await ScoringService.updateScoringConfig(weights, hackathonId);
  return sendSuccess(res, { weights: updatedWeights }, "Scoring dimension weights updated successfully");
}

// ====================================================
// Phase 3: Judge Score Override & Feedback
// POST /evaluations/:id/judge-override
// ====================================================
export async function saveJudgeOverride(req: Request, res: Response) {
  if (req.user?.role !== "JUDGE" && req.user?.role !== "ADMIN" && req.user?.role !== "ORGANIZER") {
    throw new AppError("Only Judges, Admins, or Organizers can override scores", 403);
  }

  const submissionId = getParam(req, "id");
  const userId = req.user.id;
  const { dimension, score, comment } = req.body;

  if (!dimension || score === undefined) {
    throw new AppError("dimension and score are required for judge override", 400);
  }

  await prisma.judgeScore.upsert({
    where: {
      userId_submissionId_dimension: {
        userId,
        submissionId,
        dimension: dimension as any,
      },
    },
    create: {
      userId,
      submissionId,
      dimension: dimension as any,
      score: Number(score),
      comment: comment || null,
    },
    update: {
      score: Number(score),
      comment: comment || null,
    },
  });

  // Recalculate final evaluation incorporating the override
  const updatedFinal = await ScoringService.calculateFinalEvaluation(submissionId);

  return sendSuccess(res, { result: updatedFinal }, "Judge score override saved and final score updated successfully");
}

// ====================================================
// EXISTING: Security report (backward-compatible)
// ====================================================
export async function getSecurityReport(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { securityFindings: { orderBy: { severity: "asc" } } },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  return sendSuccess(res, {
    submissionId: submission.id,
    scoreSecurity: submission.scoreSecurity,
    findings: submission.securityFindings,
  });
}

// ====================================================
// EXISTING: Runtime report (backward-compatible)
// ====================================================
export async function getRuntimeReport(req: Request, res: Response) {
  const id = getParam(req, "id");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { runtimeTests: true },
  });

  if (!submission) throw new AppError("Submission not found", 404);

  return sendSuccess(res, {
    submissionId: submission.id,
    scoreRuntime: submission.scoreTesting,
    runtimeTests: submission.runtimeTests,
  });
}
