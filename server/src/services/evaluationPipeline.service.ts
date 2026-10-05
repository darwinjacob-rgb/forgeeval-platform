// ====================================================
// ForgeEval — Phase 2 Evaluation Pipeline Orchestrator
//
// Coordinates: Requirement Mapping → Security Analysis → Runtime Testing
// Each component runs independently, persists its status, and handles
// its own failures without crashing the pipeline.
//
// NEVER executes submitted code on the host.
// NEVER blocks the participant submission request.
// ====================================================

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import prisma from "../config/database.ts";
import { SecurityService } from "./security.service.ts";
import { RequirementMappingService } from "./requirementMapping.service.ts";
import { RuntimeService } from "./runtime.service.ts";

export class EvaluationPipelineService {
  /**
   * Find the cloned repo directory for a submission (if it still exists on disk).
   * The ingestion service stores repos at:
   *   os.tmpdir()/forgeeval-ingest/{submissionId}-{timestamp}
   * We search for the most recent one.
   */
  private static findRepoDir(submissionId: string): string | null {
    const baseDir = path.join(os.tmpdir(), "forgeeval-ingest");
    if (!fs.existsSync(baseDir)) return null;

    try {
      const entries = fs.readdirSync(baseDir);
      const matching = entries
        .filter((e) => e.startsWith(submissionId))
        .map((e) => ({
          name: e,
          full: path.join(baseDir, e),
          mtime: fs.statSync(path.join(baseDir, e)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return matching[0]?.full ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Ensure an EvaluationPipeline record exists for the submission.
   */
  private static async ensurePipelineRecord(submissionId: string) {
    return prisma.evaluationPipeline.upsert({
      where: { submissionId },
      create: { submissionId },
      update: {},
    });
  }

  /**
   * Trigger the full Phase 2 evaluation pipeline asynchronously.
   * Returns immediately after scheduling — does not block.
   */
  public static triggerPipeline(submissionId: string, problemId: string, demoUrl?: string): void {
    setImmediate(() => {
      EvaluationPipelineService.runPipeline(submissionId, problemId, demoUrl).catch(
        (err) => console.error(`[Pipeline] Fatal error for ${submissionId}:`, err)
      );
    });
  }

  /**
   * Full pipeline execution — runs all three components with independent error handling.
   */
  public static async runPipeline(
    submissionId: string,
    problemId: string,
    demoUrl?: string
  ): Promise<void> {
    console.log(`[Pipeline] Starting Phase 2 evaluation for submission ${submissionId}`);

    // Initialise pipeline record
    await this.ensurePipelineRecord(submissionId);
    await prisma.evaluationPipeline.update({
      where: { submissionId },
      data: { startedAt: new Date() },
    });

    // Locate the cloned repository
    const repoDir = this.findRepoDir(submissionId);
    if (!repoDir) {
      console.warn(`[Pipeline] No cloned repo dir found for ${submissionId}. Analysis will run without file access.`);
    } else {
      console.log(`[Pipeline] Using repo dir: ${repoDir}`);
    }

    // ── Run all 3 Phase 2 components independently ──────────────────────────
    await Promise.allSettled([
      this.runRequirementMapping(submissionId, problemId, repoDir),
      this.runSecurityAnalysis(submissionId, repoDir),
      this.runRuntimeAnalysis(submissionId, repoDir, demoUrl),
    ]);

    // ── Phase 3: AI Evaluation & Synthesis + Scoring & Final Result ──────────
    try {
      console.log(`[Pipeline] Triggering Phase 3 AI Evaluation & Synthesis for ${submissionId}`);
      const { AIEvaluationService } = await import("./aiEvaluation.service.ts");
      const { ScoringService } = await import("./scoring.service.ts");

      await AIEvaluationService.evaluateSubmission(submissionId, problemId);
      await ScoringService.calculateFinalEvaluation(submissionId);
    } catch (phase3Err) {
      console.error(`[Pipeline] Phase 3 error for ${submissionId}:`, phase3Err);
    }

    // ── Mark pipeline complete ───────────────────────────────────────────────
    await prisma.evaluationPipeline.update({
      where: { submissionId },
      data: { completedAt: new Date() },
    });

    // ── Update submission status to ANALYZED ─────────────────────────────────
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "ANALYZED" },
    });

    console.log(`[Pipeline] Complete Phase 1-3 pipeline executed successfully for ${submissionId}`);
  }

  // ── Component 1: Requirement Mapping ─────────────────────────────────────

  private static async runRequirementMapping(
    submissionId: string,
    problemId: string,
    repoDir: string | null
  ): Promise<void> {
    try {
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { mappingStatus: "RUNNING" },
      });

      const mappingResults = await RequirementMappingService.mapRequirements(
        submissionId,
        problemId,
        repoDir || "__NOT_FOUND__"
      );

      await RequirementMappingService.persistMappingResults(submissionId, mappingResults);

      // Compute requirement score
      const satisfiedCount = mappingResults.filter((r) => r.status === "SATISFIED").length;
      const partialCount = mappingResults.filter((r) => r.status === "PARTIAL").length;
      const total = mappingResults.length;
      const scoreRequirement = total > 0
        ? Math.round((satisfiedCount * 100 + partialCount * 50) / total)
        : 0;

      await prisma.submission.update({
        where: { id: submissionId },
        data: { scoreRequirement },
      });

      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { mappingStatus: "COMPLETED", mappingCompletedAt: new Date(), mappingError: null },
      });

      console.log(`[Pipeline][Mapping] Completed for ${submissionId}: ${mappingResults.length} requirements mapped`);
    } catch (err: any) {
      const errMsg = err?.message || "Unknown mapping error";
      console.error(`[Pipeline][Mapping] Error for ${submissionId}: ${errMsg}`);
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { mappingStatus: "FAILED", mappingError: errMsg.substring(0, 500) },
      }).catch(() => {});
    }
  }

  // ── Component 2: Security Analysis ───────────────────────────────────────

  private static async runSecurityAnalysis(
    submissionId: string,
    repoDir: string | null
  ): Promise<void> {
    try {
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { securityStatus: "RUNNING" },
      });

      let result;
      if (repoDir && fs.existsSync(repoDir)) {
        result = await SecurityService.analyzeDirectory(repoDir, submissionId);
      } else {
        result = {
          findings: [], dependencyFindings: [], scoreSecurity: 100,
          criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, scannedFiles: 0,
        };
      }

      // Clear old findings and persist new ones
      await prisma.$transaction(async (tx) => {
        await tx.securityFinding.deleteMany({ where: { submissionId } });

        const allFindings = [
          ...result.findings.map((f) => ({
            submissionId,
            severity: f.severity as any,
            category: "SECURITY" as any,
            title: f.title,
            description: f.description,
            filePath: f.filePath || null,
            lineNumber: f.lineNumber || null,
            columnNumber: f.columnNumber || null,
            codeSnippet: f.codeSnippet || null,
            evidence: f.evidence || null,
            recommendation: f.recommendation || null,
            cwe: f.cwe || null,
            ruleId: f.ruleId || null,
            status: "OPEN" as any,
          })),
          // Dependency findings stored as MEDIUM/HIGH security findings
          ...result.dependencyFindings.map((d) => ({
            submissionId,
            severity: d.severity === "HIGH" ? ("HIGH" as any) : ("MEDIUM" as any),
            category: "SECURITY" as any,
            title: `Vulnerable Dependency: ${d.name}`,
            description: d.reason,
            filePath: "package.json",
            lineNumber: null,
            columnNumber: null,
            codeSnippet: `${d.name}@${d.version}`,
            evidence: d.advisoryId ? `Advisory: ${d.advisoryId}` : d.reason,
            recommendation: `Upgrade ${d.name} to a patched version. Check ${d.advisoryId || "the package advisory"} for details.`,
            cwe: "CWE-1026",
            ruleId: `DEP-${d.name.toUpperCase().replace(/[^A-Z]/g, "")}`,
            status: "OPEN" as any,
          })),
        ];

        if (allFindings.length > 0) {
          await tx.securityFinding.createMany({ data: allFindings });
        }

        await tx.submission.update({
          where: { id: submissionId },
          data: {
            scoreSecurity: result.scoreSecurity,
            vulnerabilitiesCount: result.criticalCount + result.highCount,
          },
        });
      });

      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { securityStatus: "COMPLETED", securityCompletedAt: new Date(), securityError: null },
      });

      console.log(`[Pipeline][Security] Completed for ${submissionId}: ${result.findings.length + result.dependencyFindings.length} findings, score=${result.scoreSecurity}`);
    } catch (err: any) {
      const errMsg = err?.message || "Unknown security error";
      console.error(`[Pipeline][Security] Error for ${submissionId}: ${errMsg}`);
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { securityStatus: "FAILED", securityError: errMsg.substring(0, 500) },
      }).catch(() => {});
    }
  }

  // ── Component 3: Runtime Testing ─────────────────────────────────────────

  private static async runRuntimeAnalysis(
    submissionId: string,
    repoDir: string | null,
    demoUrl?: string
  ): Promise<void> {
    try {
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { runtimeStatus: "RUNNING" },
      });

      let report;
      if (repoDir && fs.existsSync(repoDir)) {
        report = await RuntimeService.runAnalysis(submissionId, repoDir, demoUrl);
      } else {
        report = RuntimeService["emptyReport"]();
      }

      await prisma.$transaction(async (tx) => {
        await tx.runtimeTest.deleteMany({ where: { submissionId } });

        if (report.tests.length > 0) {
          await tx.runtimeTest.createMany({
            data: report.tests.map((t) => ({
              submissionId,
              name: t.name,
              description: t.description,
              category: t.category,
              status: t.status === "PASS" ? "PASSED" : t.status === "FAIL" ? "FAILED" : t.status === "ERROR" ? "FAILED" : "SKIPPED",
              duration: t.durationMs,
              httpStatus: t.httpStatus ?? null,
              stdout: t.stdout ?? null,
              stderr: t.stderr ?? null,
              errorMessage: t.errorMessage ?? null,
              metadata: t.metadata ? (t.metadata as any) : undefined,
            })),
          });
        }

        await tx.submission.update({
          where: { id: submissionId },
          data: { scoreTesting: report.scoreRuntime },
        });
      });

      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { runtimeStatus: "COMPLETED", runtimeCompletedAt: new Date(), runtimeError: null },
      });

      console.log(`[Pipeline][Runtime] Completed for ${submissionId}: ${report.passedTests}/${report.totalTests} passed, score=${report.scoreRuntime}`);
    } catch (err: any) {
      const errMsg = err?.message || "Unknown runtime error";
      console.error(`[Pipeline][Runtime] Error for ${submissionId}: ${errMsg}`);
      await prisma.evaluationPipeline.update({
        where: { submissionId },
        data: { runtimeStatus: "FAILED", runtimeError: errMsg.substring(0, 500) },
      }).catch(() => {});
    }
  }
}
