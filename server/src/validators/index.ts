import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["ADMIN", "ORGANIZER", "JUDGE", "PARTICIPANT"]).optional().default("PARTICIPANT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createProblemSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters"),
  difficulty: z.enum(["CRITICAL", "HARD", "MEDIUM", "EASY"]).optional().default("HARD"),
  category: z.string().optional().default("AI & Agents"),
  status: z.enum(["ACTIVE", "EVALUATING", "CONCLUDED"]).optional().default("ACTIVE"),
  deadline: z.string().optional(),
  rawStatement: z.string().min(20, "Statement must be at least 20 characters").optional(),
  hackathonId: z.string().optional(),
  inputRequirements: z.array(z.string()).optional().default([]),
  outputRequirements: z.array(z.string()).optional().default([]),
  functionalRequirements: z.array(z.string()).optional().default([]),
  technicalRequirements: z.array(z.string()).optional().default([]),
  securityRequirements: z.array(z.string()).optional().default([]),
  performanceRequirements: z.array(z.string()).optional().default([]),
  uiUxRequirements: z.array(z.string()).optional().default([]),
  docRequirements: z.array(z.string()).optional().default([]),
});

export const updateProblemSchema = createProblemSchema.partial();

export const createSubmissionSchema = z.object({
  teamId: z.string().optional(),
  problemId: z.string().min(1, "Problem ID is required"),
  repositoryUrl: z.string().url("Invalid repository URL"),
  branch: z.string().optional().default("main"),
  commitHash: z.string().optional(),
  language: z.string().optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().optional(),
  demoUrl: z.string().optional(),
  docUrl: z.string().optional(),
});

export const createJudgeEvaluationSchema = z.object({
  submissionId: z.string().min(1, "Submission ID is required"),
  scoreInnovation: z.number().min(0).max(100).optional().default(90),
  scoreExecution: z.number().min(0).max(100).optional().default(90),
  scorePresentation: z.number().min(0).max(100).optional().default(90),
  scoreOverall: z.number().min(0).max(100),
  feedback: z.string().optional(),
  rubricScores: z.any().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(100),
  hackathonId: z.string().min(1, "Hackathon ID is required"),
  avatar: z.string().optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.string().optional().default("MEMBER"),
});

export const createHackathonSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(200),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["DRAFT", "ACTIVE", "EVALUATING", "CONCLUDED", "ARCHIVED"]).optional().default("DRAFT"),
});

export const updateHackathonSchema = createHackathonSchema.partial();

export const judgeScoreSchema = z.object({
  submissionId: z.string().min(1, "Submission ID is required"),
  scores: z.object({
    requirementCompliance: z.number().min(0).max(100),
    codeQuality: z.number().min(0).max(100),
    security: z.number().min(0).max(100),
    testing: z.number().min(0).max(100),
    documentation: z.number().min(0).max(100),
    uiUx: z.number().min(0).max(100),
  }),
  comments: z.object({
    strengths: z.string().optional().default(""),
    flaws: z.string().optional().default(""),
    evidenceNotes: z.string().optional().default(""),
  }).optional(),
  finalNotes: z.string().optional().default(""),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});
