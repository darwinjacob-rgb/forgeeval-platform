import { Request, Response } from "express";
import prisma from "../config/database.ts";
import { sendSuccess, AppError } from "../utils/response.ts";
import { createProblemSchema, updateProblemSchema } from "../validators/index.ts";

// ====================================================
// PROBLEM CRUD
// ====================================================

export async function getProblems(req: Request, res: Response) {
  const { category, difficulty, search, status, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = {};
  if (category && category !== "all") where.category = category as string;
  if (difficulty && difficulty !== "all") where.difficulty = difficulty as any;
  if (status) where.status = status as any;
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: "insensitive" } },
      { description: { contains: search as string, mode: "insensitive" } },
      { code: { contains: search as string, mode: "insensitive" } },
    ];
  }

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true, requirements: true } } },
    }),
    prisma.problem.count({ where }),
  ]);

  return sendSuccess(res, {
    problems,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / take) },
  });
}

export async function getProblemById(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      requirements: { orderBy: { createdAt: "asc" } },
      submissions: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, overallScore: true, submittedAt: true },
      },
      _count: { select: { submissions: true, requirements: true } },
    },
  });

  if (!problem) throw new AppError("Problem statement not found", 404);
  return sendSuccess(res, { problem });
}

export async function createProblem(req: Request, res: Response) {
  const validated = createProblemSchema.parse(req.body);

  const problem = await prisma.problem.create({
    data: {
      code: `PROB-${Math.floor(100 + Math.random() * 900)}`,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      difficulty: validated.difficulty as any,
      rawStatement: (req.body as any).rawStatement ?? null,
    },
  });

  // Link problem to specified hackathon, or all active hackathons if unassigned
  const targetHackathonId = validated.hackathonId || (req.body as any).hackathonId;

  if (targetHackathonId) {
    await prisma.hackathonProblem.create({
      data: {
        hackathonId: targetHackathonId,
        problemId: problem.id,
      },
    }).catch((err) => console.warn("Failed to create HackathonProblem link:", err));
  } else {
    // If no explicit hackathonId, link to all active/draft hackathons so the problem statement is available
    const activeHackathons = await prisma.hackathon.findMany({ select: { id: true } });
    if (activeHackathons.length > 0) {
      await prisma.hackathonProblem.createMany({
        data: activeHackathons.map((h) => ({
          hackathonId: h.id,
          problemId: problem.id,
        })),
        skipDuplicates: true,
      }).catch((err) => console.warn("Failed to link problem to active hackathons:", err));
    }
  }

  return sendSuccess(res, { problem }, "Problem statement created successfully", 201);
}

export async function updateProblem(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const validated = updateProblemSchema.parse(req.body);

  const existing = await prisma.problem.findUnique({ where: { id } });
  if (!existing) throw new AppError("Problem statement not found", 404);

  const problem = await prisma.problem.update({ where: { id }, data: validated as any });
  return sendSuccess(res, { problem }, "Problem statement updated successfully");
}

export async function deleteProblem(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = await prisma.problem.findUnique({ where: { id } });
  if (!existing) throw new AppError("Problem statement not found", 404);

  await prisma.problem.delete({ where: { id } });
  return sendSuccess(res, null, "Problem statement deleted successfully");
}

// ====================================================
// PHASE 1 — REQUIREMENT EXTRACTION & MANAGEMENT
// ====================================================

/**
 * POST /problems/:id/analyze
 * Run deterministic extraction on rawStatement → persist Requirement[]
 */
export async function analyzeProblemStatement(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const problem = await prisma.problem.findUnique({ where: { id } });
  if (!problem) throw new AppError("Problem not found", 404);

  const rawStatement: string = (req.body as any).rawStatement ?? problem.rawStatement ?? problem.description ?? "";
  if (rawStatement.trim().length < 20) {
    throw new AppError("Problem statement is too short to analyze (minimum 20 characters)", 400);
  }

  // Persist the raw statement if provided in body
  if ((req.body as any).rawStatement) {
    await prisma.problem.update({ where: { id }, data: { rawStatement: (req.body as any).rawStatement, analysisStatus: "ANALYZING" } });
  } else {
    await prisma.problem.update({ where: { id }, data: { analysisStatus: "ANALYZING" } });
  }

  try {
    const { RequirementExtractionService } = await import("../services/requirementExtraction.service.ts");
    const extracted = RequirementExtractionService.extract(problem.title, rawStatement);

    const created = await Promise.all(
      extracted.map((r: any) =>
        prisma.requirement.upsert({
          where: { problemId_code: { problemId: id, code: r.code } },
          update: {
            title: r.title,
            description: r.description,
            category: r.category as any,
            priority: r.priority as any,
            keywords: r.keywords,
            acceptanceCriteria: r.acceptanceCriteria,
            weight: r.weight,
          },
          create: {
            problemId: id,
            code: r.code,
            title: r.title,
            description: r.description,
            category: r.category as any,
            priority: r.priority as any,
            keywords: r.keywords,
            acceptanceCriteria: r.acceptanceCriteria,
            weight: r.weight,
          },
        })
      )
    );

    await prisma.problem.update({ where: { id }, data: { analysisStatus: "ANALYZED" } });

    return sendSuccess(
      res,
      { requirements: created, count: created.length },
      `Extracted ${created.length} requirements`
    );
  } catch (err) {
    await prisma.problem.update({ where: { id }, data: { analysisStatus: "FAILED" } });
    throw err;
  }
}

/**
 * GET /problems/:id/requirements
 */
export async function getRequirements(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const problem = await prisma.problem.findUnique({ where: { id } });
  if (!problem) throw new AppError("Problem not found", 404);

  const requirements = await prisma.requirement.findMany({
    where: { problemId: id },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  return sendSuccess(res, { requirements, analysisStatus: problem.analysisStatus });
}

/**
 * POST /problems/:id/requirements — manually add one requirement
 */
export async function createRequirement(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, description, category, priority, keywords, acceptanceCriteria, weight } = req.body;

  if (!title || !category) throw new AppError("title and category are required", 400);

  const problem = await prisma.problem.findUnique({ where: { id } });
  if (!problem) throw new AppError("Problem not found", 404);

  const prefixMap: Record<string, string> = {
    FUNCTIONAL: "F", TECHNICAL: "T", SECURITY: "S", PERFORMANCE: "P",
    UI_UX: "U", DOCUMENTATION: "D", INNOVATION: "I", TESTING: "X",
  };
  const prefix = prefixMap[category as string] ?? "R";
  const existingCodes = await prisma.requirement.findMany({ where: { problemId: id }, select: { code: true } });
  const catCount = existingCodes.filter((r) => r.code.startsWith(prefix)).length;
  const code = `${prefix}-${String(catCount + 1).padStart(2, "0")}`;

  const newReq = await prisma.requirement.create({
    data: {
      problemId: id,
      code,
      title,
      description: description ?? "",
      category: category as any,
      priority: (priority ?? "MEDIUM") as any,
      keywords: Array.isArray(keywords) ? keywords : [],
      acceptanceCriteria: Array.isArray(acceptanceCriteria) ? acceptanceCriteria : [],
      weight: weight ?? 1.0,
    },
  });

  return sendSuccess(res, { requirement: newReq }, "Requirement created", 201);
}

/**
 * PUT /problems/:problemId/requirements/:reqId
 */
export async function updateRequirement(req: Request, res: Response) {
  const problemId = Array.isArray(req.params.problemId) ? req.params.problemId[0] : req.params.problemId;
  const reqId = Array.isArray(req.params.reqId) ? req.params.reqId[0] : req.params.reqId;
  const { title, description, category, priority, keywords, acceptanceCriteria, weight } = req.body;

  const existing = await prisma.requirement.findFirst({ where: { id: reqId, problemId } });
  if (!existing) throw new AppError("Requirement not found", 404);

  const updated = await prisma.requirement.update({
    where: { id: reqId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category: category as any }),
      ...(priority !== undefined && { priority: priority as any }),
      ...(keywords !== undefined && { keywords }),
      ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
      ...(weight !== undefined && { weight }),
    },
  });

  return sendSuccess(res, { requirement: updated }, "Requirement updated");
}

/**
 * DELETE /problems/:problemId/requirements/:reqId
 */
export async function deleteRequirement(req: Request, res: Response) {
  const problemId = Array.isArray(req.params.problemId) ? req.params.problemId[0] : req.params.problemId;
  const reqId = Array.isArray(req.params.reqId) ? req.params.reqId[0] : req.params.reqId;

  const existing = await prisma.requirement.findFirst({ where: { id: reqId, problemId } });
  if (!existing) throw new AppError("Requirement not found", 404);

  await prisma.requirement.delete({ where: { id: reqId } });
  return sendSuccess(res, null, "Requirement deleted");
}
