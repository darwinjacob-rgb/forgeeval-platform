// ====================================================
// ForgeEval — Scoring & Final Evaluation Service
// Phase 3 — Part 8
//
// Calculates evidence-based 7-dimension scores (FUNCTIONAL, TECHNICAL,
// SECURITY, PERFORMANCE, UI_UX, DOCUMENTATION, INNOVATION) using configurable weights.
// Supports Admin/Organizer weight customization, Judge score overrides,
// and updates FinalResult and Leaderboard rankings in PostgreSQL.
// ====================================================

import prisma from "../config/database.ts";

export interface DimensionWeights {
  FUNCTIONAL: number;
  TECHNICAL: number;
  SECURITY: number;
  PERFORMANCE: number;
  UI_UX: number;
  DOCUMENTATION: number;
  INNOVATION: number;
}

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  FUNCTIONAL: 0.25,
  TECHNICAL: 0.20,
  SECURITY: 0.15,
  PERFORMANCE: 0.10,
  UI_UX: 0.10,
  DOCUMENTATION: 0.10,
  INNOVATION: 0.10,
};

export interface FinalDimensionResult {
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  evidence: string[];
  isOverridden: boolean;
  judgeScore?: number | null;
}

export class ScoringService {
  /**
   * Get scoring weights configuration (default or custom per hackathon/global)
   */
  public static async getScoringConfig(hackathonId?: string): Promise<DimensionWeights> {
    try {
      const config = await prisma.scoringConfig.findFirst({
        where: hackathonId ? { hackathonId } : { id: "default" },
      });

      if (config && config.weights) {
        return config.weights as unknown as DimensionWeights;
      }
    } catch {
      /* fallback to defaults */
    }
    return DEFAULT_DIMENSION_WEIGHTS;
  }

  /**
   * Update scoring weights configuration (Admin / Organizer)
   */
  public static async updateScoringConfig(
    weights: Partial<DimensionWeights>,
    hackathonId?: string
  ): Promise<DimensionWeights> {
    const merged: DimensionWeights = {
      ...DEFAULT_DIMENSION_WEIGHTS,
      ...weights,
    };

    // Validate total weight sums to 1.0 (with 0.01 tolerance)
    const total = Object.values(merged).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1.0) > 0.01) {
      throw new Error(`Total dimension weight must equal 1.00 (100%). Current sum: ${total.toFixed(2)}`);
    }

    const id = hackathonId ? `hackathon-${hackathonId}` : "default";

    await prisma.scoringConfig.upsert({
      where: { id },
      create: {
        id,
        hackathonId: hackathonId || null,
        weights: merged as any,
      },
      update: {
        weights: merged as any,
      },
    });

    return merged;
  }

  /**
   * Compute final evidence-based evaluation & dimension scores for a submission.
   */
  public static async calculateFinalEvaluation(submissionId: string) {
    console.log(`[ScoringService] Computing final evaluation for submission ${submissionId}`);

    const [submission, aiAnalysis, judgeScores, scoringWeights] = await Promise.all([
      prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          problem: true,
          requirementResults: { include: { requirement: true } },
          securityFindings: true,
          runtimeTests: true,
          frameworks: true,
        },
      }),
      prisma.aIAnalysis.findUnique({ where: { id: submissionId } }),
      prisma.judgeScore.findMany({ where: { submissionId } }),
      this.getScoringConfig(),
    ]);

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    const assessments: any = aiAnalysis?.assessments || {};

    // 1. Calculate raw dimension scores
    const rawScores: Record<keyof DimensionWeights, { score: number; explanation: string; evidence: string[] }> = {
      FUNCTIONAL: {
        score: assessments.functional?.score ?? submission.scoreRequirement ?? 75,
        explanation: assessments.functional?.explanation ?? "Evaluated against problem requirements",
        evidence: assessments.functional?.evidence ?? [],
      },
      TECHNICAL: {
        score: assessments.technical?.score ?? 80,
        explanation: assessments.technical?.explanation ?? "Evaluated codebase complexity & layout",
        evidence: assessments.technical?.evidence ?? [],
      },
      SECURITY: {
        score: assessments.security?.score ?? submission.scoreSecurity ?? 85,
        explanation: assessments.security?.explanation ?? "Evaluated static security scan findings",
        evidence: assessments.security?.evidence ?? [],
      },
      PERFORMANCE: {
        score: assessments.codeQuality?.score ?? submission.scoreTesting ?? 85,
        explanation: "Evaluated static performance & dependency integrity",
        evidence: ["Build/static test integrity checks"],
      },
      UI_UX: {
        score: assessments.uiUx?.score ?? 80,
        explanation: assessments.uiUx?.explanation ?? "Evaluated user interface & layout requirements",
        evidence: assessments.uiUx?.evidence ?? [],
      },
      DOCUMENTATION: {
        score: assessments.documentation?.score ?? 70,
        explanation: assessments.documentation?.explanation ?? "Evaluated README & project documentation",
        evidence: assessments.documentation?.evidence ?? [],
      },
      INNOVATION: {
        score: assessments.innovation?.score ?? 80,
        explanation: assessments.innovation?.explanation ?? "Evaluated architectural innovation",
        evidence: assessments.innovation?.evidence ?? [],
      },
    };

    // 2. Process Judge Overrides if present
    const dimensionResults: Record<string, FinalDimensionResult> = {};
    const judgeOverrides: Record<string, { overrideScore: number; comment?: string }> = {};

    let totalWeightedScore = 0;
    let judgeSum = 0;
    let judgeCount = 0;

    const dimensionsList: Array<keyof DimensionWeights> = [
      "FUNCTIONAL",
      "TECHNICAL",
      "SECURITY",
      "PERFORMANCE",
      "UI_UX",
      "DOCUMENTATION",
      "INNOVATION",
    ];

    for (const dim of dimensionsList) {
      const weight = scoringWeights[dim] ?? 0.10;
      const raw = rawScores[dim];

      // Check judge override for this dimension
      const judgeItem = judgeScores.find((j) => j.dimension.toString() === dim || (dim === "TECHNICAL" && j.dimension.toString() === "CODE_QUALITY"));
      const isOverridden = !!judgeItem;

      const finalDimScore = isOverridden ? judgeItem!.score : raw.score;
      const weightedScore = Math.round(finalDimScore * weight * 100) / 100;

      if (isOverridden) {
        judgeOverrides[dim] = {
          overrideScore: judgeItem!.score,
          comment: judgeItem!.comment || undefined,
        };
        judgeSum += judgeItem!.score;
        judgeCount++;
      }

      dimensionResults[dim] = {
        score: finalDimScore,
        weight,
        weightedScore,
        explanation: isOverridden
          ? `[JUDGE OVERRIDDEN] ${judgeItem!.comment || "Score updated by evaluator"}`
          : raw.explanation,
        evidence: raw.evidence,
        isOverridden,
        judgeScore: isOverridden ? judgeItem!.score : null,
      };

      totalWeightedScore += finalDimScore * weight;
    }

    const aiOverallScore = Math.round(totalWeightedScore);
    const judgeOverallScore = judgeCount > 0 ? Math.round(judgeSum / judgeCount) : null;
    const finalScore = judgeOverallScore !== null ? judgeOverallScore : aiOverallScore;

    // Concatenate judge comments
    const judgeCommentsText = judgeScores
      .filter((j) => j.comment)
      .map((j) => `${j.dimension}: ${j.comment}`)
      .join("\n");

    // 3. Persist FinalResult to PostgreSQL
    const finalResult = await prisma.finalResult.upsert({
      where: { submissionId },
      create: {
        submissionId,
        aiScore: aiOverallScore,
        judgeScore: judgeOverallScore,
        finalScore,
        status: "COMPLETED",
        dimensionScores: dimensionResults as any,
        judgeOverrides: judgeOverrides as any,
        judgeComments: judgeCommentsText || null,
        weightsUsed: scoringWeights as any,
      },
      update: {
        aiScore: aiOverallScore,
        judgeScore: judgeOverallScore,
        finalScore,
        status: "COMPLETED",
        dimensionScores: dimensionResults as any,
        judgeOverrides: judgeOverrides as any,
        judgeComments: judgeCommentsText || null,
        weightsUsed: scoringWeights as any,
        updatedAt: new Date(),
      },
    });

    // 4. Update Submission status & denormalized aggregate scores
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "ANALYZED",
        overallScore: finalScore,
        scoreRequirement: dimensionResults.FUNCTIONAL.score,
        scoreSecurity: dimensionResults.SECURITY.score,
        scoreTesting: dimensionResults.PERFORMANCE.score,
        scoreCodeQuality: dimensionResults.TECHNICAL.score,
        scoreDocumentation: dimensionResults.DOCUMENTATION.score,
        scoreUiUx: dimensionResults.UI_UX.score,
      },
    });

    // 5. Recalculate Leaderboard Ranks
    await this.updateLeaderboardRanks(submission.problemId);

    console.log(`[ScoringService] Final evaluation persisted for submission ${submissionId}: score ${finalScore}`);
    return {
      submissionId,
      finalScore,
      aiScore: aiOverallScore,
      judgeScore: judgeOverallScore,
      dimensionScores: dimensionResults,
      judgeOverrides,
      status: "COMPLETED",
    };
  }

  /**
   * Recalculate leaderboard ranking numbers for all analyzed submissions in a problem.
   */
  public static async updateLeaderboardRanks(problemId: string) {
    try {
      const results = await prisma.finalResult.findMany({
        where: { submission: { problemId } },
        orderBy: { finalScore: "desc" },
      });

      for (let i = 0; i < results.length; i++) {
        await prisma.finalResult.update({
          where: { id: results[i].id },
          data: { rank: i + 1 },
        });
      }
    } catch (err) {
      console.warn("[ScoringService] Failed to update leaderboard ranks:", err);
    }
  }
}
