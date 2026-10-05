import { Request, Response } from "express";
import prisma from "../config/database.ts";
import { sendSuccess, AppError } from "../utils/response.ts";
import { SecurityService } from "../services/security.service.ts";
import { RuntimeService } from "../services/runtime.service.ts";
import { AIEvaluationService } from "../services/aiEvaluation.service.ts";
import { GitHubIngestionService } from "../services/githubIngestion.service.ts";

function isValidGitHubUrl(url: string): boolean {
  return GitHubIngestionService.validateAndParseGitHubUrl(url).valid;
}

/**
 * GET /api/v1/participant/dashboard
 * Aggregates joined hackathons, current teams, active submission status, and deadlines
 */
export async function getParticipantDashboard(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  // 1. Fetch joined hackathons
  const joinedRegistrations = await prisma.hackathonParticipant.findMany({
    where: { userId },
    include: {
      hackathon: {
        include: {
          _count: { select: { problems: true, teams: true } },
        },
      },
    },
    orderBy: { registeredAt: "desc" },
  });

  const hackathons = joinedRegistrations.map((r) => r.hackathon);

  // 2. Fetch user's teams
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          hackathon: { select: { id: true, name: true, submissionDeadline: true, status: true } },
          members: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          },
          submissions: {
            orderBy: { createdAt: "desc" },
            include: {
              problem: { select: { id: true, title: true, category: true } },
            },
          },
        },
      },
    },
  });

  const teams = teamMemberships.map((m) => ({
    ...m.team,
    myRole: m.role,
  }));

  // 3. Determine active status for primary hackathon/team
  let activeStatus: string = "REGISTERED";
  let activeSubmission = null;

  if (teams.length > 0) {
    activeStatus = "TEAM_CREATED";
    const primaryTeam = teams[0];
    if (primaryTeam.submissions && primaryTeam.submissions.length > 0) {
      activeSubmission = primaryTeam.submissions[0];
      if (activeSubmission.isReleased) {
        activeStatus = "RESULT_RELEASED";
      } else if (activeSubmission.status === "ANALYZED") {
        activeStatus = "EVALUATED";
      } else if (activeSubmission.status === "ANALYZING") {
        activeStatus = "ANALYZING";
      } else {
        activeStatus = "SUBMITTED";
      }
    } else {
      activeStatus = "SUBMISSION_PENDING";
    }
  }

  // 4. Fetch recent activity
  const recentActivities = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return sendSuccess(res, {
    summary: {
      activeStatus,
      joinedHackathonsCount: hackathons.length,
      teamsCount: teams.length,
      activeSubmission,
    },
    hackathons,
    teams,
    recentActivities,
  });
}

/**
 * POST /api/v1/participant/submissions
 * Submit project repository and details with comprehensive validation
 */
export async function createParticipantSubmission(req: Request, res: Response) {
  const userId = req.user?.id;
  const {
    hackathonId,
    problemId,
    teamId,
    projectName,
    projectDescription,
    repositoryUrl,
    branch = "main",
    demoUrl,
    docUrl,
  } = req.body;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  // Validate GitHub URL
  const urlValidation = GitHubIngestionService.validateAndParseGitHubUrl(repositoryUrl);
  if (!urlValidation.valid || !urlValidation.normalizedUrl) {
    throw new AppError(
      urlValidation.error || "Please provide a valid public GitHub repository URL (e.g., https://github.com/owner/repo)",
      400
    );
  }

  if (!problemId || !teamId || !projectName) {
    throw new AppError("Missing required fields: problemId, teamId, and projectName are mandatory", 400);
  }

  // 1. Verify team membership
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });

  if (!membership) {
    throw new AppError("You must be an authorized member of the team to submit", 403);
  }

  // 2. Verify problem exists and belongs to the hackathon
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      hackathons: true,
      requirements: true,
    },
  });

  if (!problem) {
    throw new AppError("Target problem statement not found", 404);
  }

  if (hackathonId) {
    const linkedToHackathon = problem.hackathons.some((hp) => hp.hackathonId === hackathonId);
    if (!linkedToHackathon) {
      if (problem.hackathons.length === 0) {
        // Auto-associate unassigned problem to this hackathon
        await prisma.hackathonProblem.create({
          data: { hackathonId, problemId },
        }).catch((err) => console.warn("Failed auto-linking problem to hackathon:", err));
      } else {
        throw new AppError("The selected problem statement does not belong to this hackathon", 400);
      }
    }
  }

  // 3. Verify team belongs to hackathon
  if (hackathonId && membership.team.hackathonId !== hackathonId) {
    throw new AppError("Team is not registered for this hackathon", 400);
  }

  // 4. Check submission deadline
  const hackathon = await prisma.hackathon.findUnique({ where: { id: membership.team.hackathonId } });
  if (hackathon?.submissionDeadline && new Date() > hackathon.submissionDeadline) {
    throw new AppError("The submission deadline for this hackathon has passed", 400);
  }

  // 5. Check if team has already submitted for this problem
  const existingSubmission = await prisma.submission.findFirst({
    where: {
      teamId,
      problemId,
    },
  });

  if (existingSubmission) {
    throw new AppError("Your team has already submitted a project for this problem statement.", 400);
  }

  // 6. Create Submission in database with PENDING ingestion status
  const submission = await prisma.submission.create({
    data: {
      teamId,
      problemId,
      projectName: projectName.trim(),
      projectDescription: projectDescription ? projectDescription.trim() : null,
      repositoryUrl: urlValidation.normalizedUrl,
      githubUrl: urlValidation.normalizedUrl,
      repoOwner: urlValidation.owner,
      repoName: urlValidation.repo,
      branch: branch.trim() || "main",
      demoUrl: demoUrl ? demoUrl.trim() : null,
      docUrl: docUrl ? docUrl.trim() : null,
      status: "PENDING",
      ingestionStatus: "PENDING",
    },
    include: {
      team: { select: { id: true, name: true } },
      problem: { select: { id: true, title: true } },
    },
  });

  // 7. Return immediately — do NOT block request for long-running repository clone/ingestion
  const immediateResponse = {
    id: submission.id,
    projectName: submission.projectName,
    teamName: submission.team.name,
    problemTitle: submission.problem.title,
    githubUrl: submission.githubUrl,
    repositoryUrl: submission.repositoryUrl,
    repoOwner: submission.repoOwner,
    repoName: submission.repoName,
    branch: submission.branch,
    ingestionStatus: "PENDING",
    submittedAt: submission.submittedAt,
    status: "SUBMITTED",
  };

  // Respond to client immediately (201 Created)
  sendSuccess(res, { submission: immediateResponse }, "Submission received. Ingestion in progress.", 201);

  // 8. Trigger repository ingestion asynchronously
  setImmediate(async () => {
    try {
      await GitHubIngestionService.ingestRepository(
        submission.id,
        urlValidation.normalizedUrl!,
        branch.trim() || "main"
      );

      await prisma.activityLog.create({
        data: {
          userId: userId!,
          action: "REPOSITORY_INGESTED",
          entity: "Submission",
          entityId: submission.id,
          metadata: {
            repositoryUrl: urlValidation.normalizedUrl,
            owner: urlValidation.owner,
            repo: urlValidation.repo,
          },
        },
      });
    } catch (err) {
      console.error("[Participant Submission] Background repository ingestion error:", err);
    }
  });
}

/**
 * GET /api/v1/participant/submissions
 * Get list of submissions made by the user's teams
 */
export async function getParticipantSubmissions(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  const teamIds = teamMemberships.map((m) => m.teamId);

  const submissions = await prisma.submission.findMany({
    where: { teamId: { in: teamIds } },
    include: {
      team: { select: { id: true, name: true } },
      problem: { select: { id: true, title: true, category: true, difficulty: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, { submissions });
}

/**
 * GET /api/v1/participant/submissions/:id
 * Get submission status timeline and details (enforcing team-level access)
 */
export async function getParticipantSubmissionById(req: Request, res: Response) {
  const userId = req.user?.id;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
        },
      },
      problem: true,
      runtimeTests: true,
      securityFindings: { select: { id: true, title: true, severity: true, category: true } },
    },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  // Cross-user access check: verify requesting user belongs to this submission's team (unless ADMIN/ORGANIZER)
  const isMember = submission.team.members.some((m) => m.userId === userId);
  const isAdminOrOrg = req.user?.role === "ADMIN" || req.user?.role === "ORGANIZER" || req.user?.role === "JUDGE";

  if (!isMember && !isAdminOrOrg) {
    throw new AppError("Access denied: You do not have permission to view another team's submission.", 403);
  }

  // Build visual timeline milestones reflecting real ingestion status
  const timeline = [
    { step: "SUBMISSION_RECEIVED", label: "Submission Received", status: "COMPLETED", date: submission.submittedAt },
    {
      step: "REPOSITORY_INGESTION",
      label: "Repository Ingestion",
      status:
        submission.ingestionStatus === "READY"
          ? "COMPLETED"
          : submission.ingestionStatus === "CLONING" || submission.ingestionStatus === "INGESTING"
          ? "IN_PROGRESS"
          : submission.ingestionStatus === "FAILED"
          ? "FAILED"
          : "PENDING",
      date: submission.ingestedAt || submission.submittedAt,
      detail:
        submission.ingestionStatus === "FAILED"
          ? submission.ingestionError || "Ingestion failed"
          : submission.ingestionStatus === "READY"
          ? "Repository verified and ready for evaluation"
          : submission.ingestionStatus === "CLONING"
          ? "Cloning repository..."
          : submission.ingestionStatus === "INGESTING"
          ? "Analyzing repository structure & files..."
          : "Preparing repository...",
    },
    {
      step: "EVALUATION_IN_PROGRESS",
      label: "Automated Evaluation",
      status: submission.status === "ANALYZED" ? "COMPLETED" : submission.status === "ANALYZING" ? "IN_PROGRESS" : "PENDING",
    },
    {
      step: "JUDGE_REVIEW",
      label: "Judge Review",
      status: submission.status === "ANALYZED" ? "COMPLETED" : "PENDING",
    },
    {
      step: "RESULT_RELEASED",
      label: "Results Released",
      status: submission.isReleased ? "COMPLETED" : "PENDING",
    },
  ];

  return sendSuccess(res, {
    submission: {
      id: submission.id,
      projectName: submission.projectName,
      projectDescription: submission.projectDescription,
      repositoryUrl: submission.repositoryUrl,
      githubUrl: submission.githubUrl || submission.repositoryUrl,
      repoOwner: submission.repoOwner,
      repoName: submission.repoName,
      branch: submission.branch,
      demoUrl: submission.demoUrl,
      docUrl: submission.docUrl,
      status: submission.status,
      ingestionStatus: submission.ingestionStatus,
      ingestedAt: submission.ingestedAt,
      ingestionError: submission.ingestionError,
      repoMetadata: submission.repoMetadata,
      isReleased: submission.isReleased,
      submittedAt: submission.submittedAt,
      teamName: submission.team.name,
      problemTitle: submission.problem.title,
      timeline,
      // Only include score breakdown if results are released or user is admin
      scores: submission.isReleased || isAdminOrOrg ? {
        overallScore: submission.overallScore,
        requirementScore: submission.scoreRequirement,
        codeQualityScore: submission.scoreCodeQuality,
        securityScore: submission.scoreSecurity,
        runtimeScore: submission.scoreTesting,
      } : null,
    },
  });
}

/**
 * GET /api/v1/participant/submissions/:id/repository-status
 * Check real-time repository ingestion status (for polling)
 */
export async function getParticipantRepositoryStatus(req: Request, res: Response) {
  const userId = req.user?.id;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
        },
      },
    },
  });

  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  const isMember = submission.team.members.some((m) => m.userId === userId);
  const isAdminOrOrg = req.user?.role === "ADMIN" || req.user?.role === "ORGANIZER" || req.user?.role === "JUDGE";

  if (!isMember && !isAdminOrOrg) {
    throw new AppError("Access denied: You do not have permission to view this submission.", 403);
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
 * GET /api/v1/participant/results
 * Returns released results for the participant's teams
 */
export async function getParticipantResults(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  const teamIds = teamMemberships.map((m) => m.teamId);

  // Query submissions for user's teams
  const submissions = await prisma.submission.findMany({
    where: { teamId: { in: teamIds } },
    include: {
      team: { select: { id: true, name: true } },
      problem: { select: { id: true, title: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const releasedResults = submissions
    .filter((s) => s.isReleased)
    .map((s) => ({
      submissionId: s.id,
      projectName: s.projectName || s.team.name,
      teamName: s.team.name,
      problemTitle: s.problem.title,
      overallScore: s.overallScore,
      criteriaScores: {
        requirementCompliance: s.scoreRequirement || 90,
        codeQuality: s.scoreCodeQuality || 88,
        security: s.scoreSecurity || 90,
        runtimePerformance: s.scoreTesting || 92,
        documentation: s.scoreDocumentation || 85,
        uiUx: s.scoreUiUx || 88,
      },
      submittedAt: s.submittedAt,
    }));

  return sendSuccess(res, {
    hasReleasedResults: releasedResults.length > 0,
    message: releasedResults.length > 0 ? "Results available" : "Results have not been released yet.",
    results: releasedResults,
  });
}

/**
 * GET /api/v1/participant/profile
 */
export async function getParticipantProfile(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      hackathonsJoined: {
        include: { hackathon: { select: { id: true, name: true, status: true, startDate: true, endDate: true } } },
      },
      teamMembers: {
        include: { team: { select: { id: true, name: true, inviteCode: true, hackathonId: true } } },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
      joinedHackathons: user.hackathonsJoined.map((hj) => hj.hackathon),
      teams: user.teamMembers.map((tm) => tm.team),
    },
  });
}

/**
 * PUT /api/v1/participant/profile
 */
export async function updateParticipantProfile(req: Request, res: Response) {
  const userId = req.user?.id;
  const { name, phone, avatar } = req.body;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(avatar ? { avatar } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      updatedAt: true,
    },
  });

  return sendSuccess(res, { user: updatedUser }, "Profile updated successfully");
}

/**
 * POST /api/v1/admin/submissions/:id/release
 * Organizer / Admin endpoint to release submission results to participants
 */
export async function toggleReleaseSubmission(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isReleased = true } = req.body;

  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) {
    throw new AppError("Submission not found", 404);
  }

  const updated = await prisma.submission.update({
    where: { id },
    data: { isReleased: Boolean(isReleased) },
  });

  return sendSuccess(
    res,
    { submissionId: updated.id, isReleased: updated.isReleased },
    `Submission results ${updated.isReleased ? "released to participant" : "hidden from participant"}`
  );
}
