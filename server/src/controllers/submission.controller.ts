import { Request, Response } from "express";
import prisma from "../config/database.ts";
import { sendSuccess, AppError } from "../utils/response.ts";
import { createSubmissionSchema } from "../validators/index.ts";
import { GitHubIngestionService } from "../services/githubIngestion.service.ts";

/**
 * Get all submissions with filtering, sorting, and pagination
 */
export async function getSubmissions(req: Request, res: Response) {
  const { problemId, status, search, page = 1, limit = 10, sortBy = "createdAt" } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = {};
  if (problemId && typeof problemId === "string") where.problemId = problemId;
  if (status && status !== "all" && typeof status === "string") where.status = status as any;

  // Participant role restriction (IDOR protection)
  if (req.user?.role === "PARTICIPANT") {
    where.team = {
      members: {
        some: { userId: req.user.id },
      },
    };
  }

  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "scoreOverall") orderBy = { overallScore: "desc" };

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        problem: { select: { id: true, title: true, category: true } },
        team: { select: { id: true, name: true } },
        _count: { select: { securityFindings: true, runtimeTests: true, judgeScores: true } },
      },
    }),
    prisma.submission.count({ where }),
  ]);

  return sendSuccess(res, {
    submissions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
    },
  });
}

/**
 * Get single submission details by ID
 */
export async function getSubmissionById(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      problem: true,
      team: { include: { members: { include: { user: true } } } },
      securityFindings: { orderBy: { createdAt: "desc" } },
      runtimeTests: true,
      judgeScores: { include: { user: { select: { id: true, name: true, email: true } } } },
      requirementResults: { include: { requirement: true } },
    },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  // IDOR protection: if user is PARTICIPANT, verify they belong to this submission's team
  if (req.user?.role === "PARTICIPANT") {
    const isMember = submission.team.members.some((m) => m.userId === req.user?.id);
    if (!isMember) {
      throw new AppError("Access denied: You do not have permission to view another team's submission.", 403);
    }
  }

  return sendSuccess(res, { submission });
}

/**
 * Get repository ingestion status for a submission
 */
export async function getRepositoryStatus(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      team: { include: { members: { select: { userId: true } } } },
    },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  if (req.user?.role === "PARTICIPANT") {
    const isMember = submission.team.members.some((m) => m.userId === req.user?.id);
    if (!isMember) {
      throw new AppError("Access denied: You do not have permission to view this submission.", 403);
    }
  }

  return sendSuccess(res, {
    submissionId: submission.id,
    repositoryUrl: submission.repositoryUrl,
    githubUrl: submission.githubUrl || submission.repositoryUrl,
    repoOwner: submission.repoOwner,
    repoName: submission.repoName,
    branch: submission.branch,
    ingestionStatus: submission.ingestionStatus,
    ingestedAt: submission.ingestedAt,
    ingestionError: submission.ingestionError,
    repoMetadata: submission.repoMetadata,
    status: submission.status,
  });
}

/**
 * Create a new submission & trigger repository ingestion
 */
export async function createSubmission(req: Request, res: Response) {
  const validated = createSubmissionSchema.parse(req.body);

  // Validate GitHub URL
  const urlValidation = GitHubIngestionService.validateAndParseGitHubUrl(validated.repositoryUrl);
  if (!urlValidation.valid || !urlValidation.normalizedUrl) {
    throw new AppError(
      urlValidation.error || "Please provide a valid public GitHub repository URL (e.g., https://github.com/owner/repo)",
      400
    );
  }

  // Verify problem exists
  const problem = await prisma.problem.findUnique({
    where: { id: validated.problemId },
    include: { requirements: true },
  });

  if (!problem) {
    throw new AppError("Target problem statement not found", 404);
  }

  // Find or create default team if teamId not provided
  let teamId = validated.teamId;
  if (!teamId) {
    let team = await prisma.team.findFirst();
    if (!team) {
      const hackathon = await prisma.hackathon.create({
        data: {
          name: "ForgeEval Master Hackathon 2026",
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
      team = await prisma.team.create({
        data: {
          name: "CyberPulse Team",
          hackathonId: hackathon.id,
        },
      });
    }
    teamId = team.id;
  }

  // 1. Create initial submission in DB with PENDING ingestion status
  const submission = await prisma.submission.create({
    data: {
      teamId,
      problemId: validated.problemId,
      projectName: validated.projectName || "Hackathon Project",
      projectDescription: validated.projectDescription || null,
      repositoryUrl: urlValidation.normalizedUrl,
      githubUrl: urlValidation.normalizedUrl,
      repoOwner: urlValidation.owner,
      repoName: urlValidation.repo,
      branch: validated.branch || "main",
      demoUrl: validated.demoUrl || null,
      docUrl: validated.docUrl || null,
      status: "PENDING",
      ingestionStatus: "PENDING",
    },
    include: {
      problem: true,
      team: true,
    },
  });

  // 2. Trigger repository ingestion asynchronously (fire-and-forget)
  setImmediate(async () => {
    try {
      await GitHubIngestionService.ingestRepository(
        submission.id,
        urlValidation.normalizedUrl!,
        validated.branch || "main"
      );
    } catch (err) {
      console.error("[Submission Controller] Background ingestion error:", err);
    }
  });

  return sendSuccess(
    res,
    { submission },
    "Submission received and repository queued for ingestion",
    201
  );
}

/**
 * Update submission info
 */
export async function updateSubmission(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await prisma.submission.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Submission not found", 404);
  }

  const updated = await prisma.submission.update({
    where: { id },
    data: req.body,
  });

  return sendSuccess(res, { submission: updated }, "Submission updated successfully");
}

/**
 * Delete submission
 */
export async function deleteSubmission(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await prisma.submission.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Submission not found", 404);
  }

  await prisma.submission.delete({ where: { id } });

  return sendSuccess(res, null, "Submission deleted successfully");
}
