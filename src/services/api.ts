import { Problem, Submission, Finding, RequirementItem, JudgeEvaluation } from '../types';
import { INITIAL_PROBLEMS, INITIAL_SUBMISSIONS, INITIAL_REQUIREMENTS, INITIAL_FINDINGS } from '../mockData';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error?.message || 'API request failed');
  }

  return data.data;
}

// ====================================================
// AUTHENTICATION API
// ====================================================
export const authApi = {
  login: async (email: string, passwordHash: string) => {
    return apiFetch<{ user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: passwordHash }),
    });
  },

  register: async (name: string, email: string, passwordHash: string, role = 'PARTICIPANT', phone?: string) => {
    return apiFetch<{ user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: passwordHash, role, phone }),
    });
  },

  logout: async () => {
    return apiFetch('/auth/logout', { method: 'POST' });
  },

  getMe: async () => {
    return apiFetch<{ user: any }>('/auth/me');
  },
};

// ====================================================
// HACKATHONS API
// ====================================================
export const hackathonsApi = {
  getAll: async () => {
    return apiFetch<{ hackathons: any[] }>('/hackathons');
  },

  getById: async (id: string) => {
    return apiFetch<{ hackathon: any }>(`/hackathons/${id}`);
  },

  join: async (id: string) => {
    return apiFetch<{ message: string; hackathonId: string }>(`/hackathons/${id}/join`, {
      method: 'POST',
    });
  },

  getProblems: async (id: string) => {
    return apiFetch<{ problems: any[] }>(`/hackathons/${id}/problems`);
  },
};

// ====================================================
// TEAMS API
// ====================================================
export const teamsApi = {
  create: async (data: { name: string; hackathonId: string }) => {
    return apiFetch<{ team: any }>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  joinByCode: async (inviteCode: string) => {
    return apiFetch<{ teamId: string; member: any }>('/teams/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
  },

  getById: async (id: string) => {
    return apiFetch<{ team: any }>(`/teams/${id}`);
  },

  leave: async (id: string) => {
    return apiFetch<any>(`/teams/${id}/leave`, {
      method: 'POST',
    });
  },

  getMyTeams: async () => {
    return apiFetch<{ teams: any[] }>('/teams/my-teams');
  },
};

// ====================================================
// PARTICIPANT PORTAL API
// ====================================================
export const participantApi = {
  getDashboard: async () => {
    return apiFetch<{
      summary: {
        activeStatus: string;
        joinedHackathonsCount: number;
        teamsCount: number;
        activeSubmission: any;
      };
      hackathons: any[];
      teams: any[];
      recentActivities: any[];
    }>('/participant/dashboard');
  },

  createSubmission: async (data: {
    hackathonId?: string;
    problemId: string;
    teamId: string;
    projectName: string;
    projectDescription?: string;
    repositoryUrl: string;
    branch?: string;
    demoUrl?: string;
    docUrl?: string;
  }) => {
    return apiFetch<{ submission: any }>('/participant/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSubmissions: async () => {
    return apiFetch<{ submissions: any[] }>('/participant/submissions');
  },

  getSubmissionById: async (id: string) => {
    return apiFetch<{ submission: any }>(`/participant/submissions/${id}`);
  },

  getRepositoryStatus: async (id: string) => {
    return apiFetch<{
      submissionId: string;
      repositoryUrl: string;
      githubUrl: string;
      repoOwner?: string;
      repoName?: string;
      branch?: string;
      ingestionStatus: 'PENDING' | 'CLONING' | 'INGESTING' | 'READY' | 'FAILED';
      ingestedAt?: string;
      ingestionError?: string | null;
      repoMetadata?: any;
      status: string;
    }>(`/participant/submissions/${id}/repository-status`);
  },

  getResults: async () => {
    return apiFetch<{
      hasReleasedResults: boolean;
      message: string;
      results: any[];
    }>('/participant/results');
  },

  getProfile: async () => {
    return apiFetch<{ user: any }>('/participant/profile');
  },

  updateProfile: async (data: { name?: string; phone?: string; avatar?: string }) => {
    return apiFetch<{ user: any }>('/participant/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ====================================================
// PROBLEMS API (V1 & ADMIN)
// ====================================================
export const problemsApi = {
  getAll: async (params?: { category?: string; difficulty?: string; search?: string }): Promise<Problem[]> => {
    try {
      const query = new URLSearchParams(params as any).toString();
      const res = await apiFetch<{ problems: any[] }>(`/problems?${query}`);
      return res.problems.map((p) => ({
        id: p.id,
        code: p.code || p.id.slice(0, 8).toUpperCase(),
        title: p.title,
        category: p.category || 'AI & Agents',
        difficulty: p.difficulty || 'HARD',
        submissionsCount: p._count?.submissions || 0,
        requirementsCount: Array.isArray(p.requirements) ? p.requirements.length : 4,
        status: 'ACTIVE',
        description: p.description,
        deadline: '24h 00m left',
        inputRequirements: [],
        outputRequirements: [],
        functionalRequirements: p.functionalRequirements || [],
        technicalRequirements: p.technicalRequirements || [],
        securityRequirements: p.securityRequirements || [],
        performanceRequirements: p.performanceRequirements || [],
        uiUxRequirements: p.uiUxRequirements || [],
        docRequirements: p.docRequirements || [],
      }));
    } catch (err) {
      console.warn('Backend unavailable, using INITIAL_PROBLEMS fallback:', err);
      return INITIAL_PROBLEMS;
    }
  },

  getById: async (id: string): Promise<Problem | null> => {
    try {
      const res = await apiFetch<{ problem: any }>(`/problems/${id}`);
      const p = res.problem;
      return {
        id: p.id,
        code: p.code || p.id.slice(0, 8).toUpperCase(),
        title: p.title,
        category: p.category || 'AI & Agents',
        difficulty: p.difficulty || 'HARD',
        submissionsCount: p._count?.submissions || 0,
        requirementsCount: Array.isArray(p.requirements) ? p.requirements.length : 4,
        status: 'ACTIVE',
        description: p.description,
        deadline: '24h 00m left',
        inputRequirements: [],
        outputRequirements: [],
        functionalRequirements: p.functionalRequirements || [],
        technicalRequirements: p.technicalRequirements || [],
        securityRequirements: p.securityRequirements || [],
        performanceRequirements: p.performanceRequirements || [],
        uiUxRequirements: p.uiUxRequirements || [],
        docRequirements: p.docRequirements || [],
      };
    } catch (err) {
      return INITIAL_PROBLEMS.find((p) => p.id === id) || null;
    }
  },

  create: async (data: any) => {
    return apiFetch('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Phase 1 — create with raw statement (will be analyzed separately)
  createWithStatement: async (data: {
    title: string;
    description: string;
    category?: string;
    difficulty?: string;
    rawStatement: string;
    hackathonId?: string;
  }) => {
    return apiFetch<{ problem: any }>('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Phase 1 — run extraction on an existing problem
  analyze: async (problemId: string, rawStatement?: string) => {
    return apiFetch<{ requirements: any[]; count: number }>(
      `/problems/${problemId}/analyze`,
      {
        method: 'POST',
        body: JSON.stringify(rawStatement ? { rawStatement } : {}),
      }
    );
  },

  // Phase 1 — get structured requirements list
  getRequirements: async (problemId: string) => {
    return apiFetch<{ requirements: any[]; analysisStatus: string }>(
      `/problems/${problemId}/requirements`
    );
  },

  // Phase 1 — manually add one requirement
  createRequirement: async (
    problemId: string,
    data: {
      title: string;
      description?: string;
      category: string;
      priority?: string;
      keywords?: string[];
      acceptanceCriteria?: string[];
      weight?: number;
    }
  ) => {
    return apiFetch<{ requirement: any }>(`/problems/${problemId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Phase 1 — update a requirement
  updateRequirement: async (problemId: string, reqId: string, data: Partial<{
    title: string;
    description: string;
    category: string;
    priority: string;
    keywords: string[];
    acceptanceCriteria: string[];
    weight: number;
  }>) => {
    return apiFetch<{ requirement: any }>(
      `/problems/${problemId}/requirements/${reqId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
  },

  // Phase 1 — delete a requirement
  deleteRequirement: async (problemId: string, reqId: string) => {
    return apiFetch(`/problems/${problemId}/requirements/${reqId}`, {
      method: 'DELETE',
    });
  },
};

// ====================================================
// SUBMISSIONS API (V1 & ADMIN)
// ====================================================
export const submissionsApi = {
  getAll: async (params?: { problemId?: string; status?: string; search?: string }): Promise<Submission[]> => {
    try {
      const query = new URLSearchParams(params as any).toString();
      const res = await apiFetch<{ submissions: any[] }>(`/submissions?${query}`);
      return res.submissions.map((s) => ({
        id: s.id,
        team: s.projectName ? `${s.projectName} (${s.team?.name || 'CyberPulse'})` : s.team?.name || 'CyberPulse',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        problemId: s.problemId,
        problemTitle: s.problem?.title || 'Real-Time Pipeline',
        repository: s.githubUrl || s.repositoryUrl || 'https://github.com/forgeeval/aegisshield',
        githubUrl: s.githubUrl || s.repositoryUrl,
        repoOwner: s.repoOwner,
        repoName: s.repoName,
        ingestionStatus: s.ingestionStatus || 'READY',
        ingestedAt: s.ingestedAt,
        ingestionError: s.ingestionError,
        repoMetadata: s.repoMetadata || undefined,
        branch: s.branch || 'main',
        language: s.language || (s.repoMetadata?.primaryLanguage) || 'TypeScript / Rust',
        submittedAt: new Date(s.createdAt).toISOString(),
        commitHash: s.commitHash || s.id.slice(0, 7),
        status: s.status === 'ANALYZED' ? 'ANALYZED' : s.status === 'FAILED' ? 'FAILED' : 'IN_REVIEW',
        overallScore: s.overallScore || 90,
        criteriaScores: {
          requirement: s.scoreRequirement || 90,
          codeQuality: s.scoreCodeQuality || 88,
          security: s.scoreSecurity || 92,
          testing: s.scoreTesting || 90,
          documentation: s.scoreDocumentation || 85,
          uiUx: s.scoreUiUx || 88,
        },
        metrics: {
          linesOfCode: s.linesOfCode || (s.repoMetadata?.fileCount ? s.repoMetadata.fileCount * 45 : 4520),
          cyclomaticComplexity: s.cyclomaticComplexity || 12,
          testCoverage: s.testCoverage || 88,
          buildTimeSec: s.buildTimeSec || 14,
          vulnerabilitiesCount: s._count?.securityFindings || 0,
        },
        frameworks: Array.isArray(s.repoMetadata?.frameworks) && s.repoMetadata.frameworks.length > 0
          ? s.repoMetadata.frameworks
          : ['React', 'Express', 'Prisma', 'TailwindCSS'],
        dependencies: [],
        readmePreview: s.readmeContent || s.projectDescription || s.problem?.description || '',
        projectStructure: s.projectStructure || [],
        runtimeLogs: [],
        exitCode: 0,
        buildStatus: 'SUCCESS',
        executionTime: '42ms',
        isReleased: s.isReleased ?? false,
      }));
    } catch (err) {
      console.warn('Backend unavailable, using INITIAL_SUBMISSIONS fallback:', err);
      return INITIAL_SUBMISSIONS;
    }
  },

  getById: async (id: string) => {
    try {
      const res = await apiFetch<{ submission: any }>(`/submissions/${id}`);
      return res.submission;
    } catch (err) {
      return INITIAL_SUBMISSIONS.find((s) => s.id === id) || null;
    }
  },

  getRepositoryStatus: async (id: string) => {
    return apiFetch<{
      submissionId: string;
      repositoryUrl: string;
      githubUrl: string;
      repoOwner?: string;
      repoName?: string;
      branch?: string;
      ingestionStatus: 'PENDING' | 'CLONING' | 'INGESTING' | 'READY' | 'FAILED';
      ingestedAt?: string;
      ingestionError?: string | null;
      repoMetadata?: any;
      status: string;
    }>(`/submissions/${id}/repository-status`);
  },

  create: async (data: any) => {
    return apiFetch('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  releaseSubmission: async (id: string, isReleased: boolean = true) => {
    return apiFetch<{ submissionId: string; isReleased: boolean }>(`/submissions/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ isReleased }),
    });
  },
};

// ====================================================
// EVALUATIONS & FINDINGS API
// ====================================================
export const evaluationApi = {
  triggerEvaluation: async (submissionId: string) => {
    return apiFetch<{ submissionId: string; status: string }>(`/evaluations/${submissionId}/evaluate`, { method: 'POST' });
  },

  getPipelineStatus: async (submissionId: string) => {
    return apiFetch<{
      submissionId: string;
      ingestionStatus: string;
      evaluationStatus: string;
      pipeline: {
        mappingStatus: string;
        securityStatus: string;
        runtimeStatus: string;
        mappingError?: string | null;
        securityError?: string | null;
        runtimeError?: string | null;
        startedAt?: string | null;
        completedAt?: string | null;
        mappingCompletedAt?: string | null;
        securityCompletedAt?: string | null;
        runtimeCompletedAt?: string | null;
      } | null;
      scores: { requirement: number | null; security: number | null; testing: number | null; overall: number | null };
      counts: { securityFindings: number; runtimeTests: number; requirementResults: number };
    }>(`/evaluations/${submissionId}/pipeline-status`);
  },

  getRequirementMapping: async (submissionId: string) => {
    return apiFetch<{
      submissionId: string;
      scoreRequirement: number | null;
      summary: { total: number; satisfied: number; partial: number; missing: number };
      results: Array<{
        resultId: string;
        requirementId: string;
        code: string;
        title: string;
        description: string;
        category: string;
        priority: string;
        keywords: string[];
        acceptanceCriteria: string[];
        weight: number;
        status: 'SATISFIED' | 'PARTIAL' | 'MISSING' | 'UNKNOWN';
        confidence: number;
        explanation: string;
        filePath?: string | null;
        evidence: string[];
        matchedFiles: string[];
      }>;
    }>(`/evaluations/${submissionId}/requirement-mapping`);
  },

  getSecurityFindings: async (submissionId: string) => {
    return apiFetch<{
      submissionId: string;
      scoreSecurity: number | null;
      summary: { total: number; criticals: number; highs: number; mediums: number; lows: number };
      findings: Array<{
        id: string;
        severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
        category: string;
        title: string;
        description: string;
        filePath?: string;
        lineNumber?: number;
        columnNumber?: number;
        codeSnippet?: string;
        evidence: string;
        recommendation: string;
        cwe?: string;
        ruleId?: string;
        falsePositive: boolean;
        status: 'OPEN' | 'CONFIRMED' | 'RESOLVED' | 'FALSE_POSITIVE' | 'MUTED';
        createdAt: string;
      }>;
    }>(`/evaluations/${submissionId}/security-findings`);
  },

  updateFindingStatus: async (submissionId: string, findingId: string, data: { status?: string; falsePositive?: boolean }) => {
    return apiFetch<{ finding: any }>(`/evaluations/${submissionId}/security-findings/${findingId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getRuntimeResults: async (submissionId: string) => {
    return apiFetch<{
      submissionId: string;
      scoreRuntime: number | null;
      summary: { total: number; passed: number; failed: number; skipped: number };
      tests: Array<{
        id: string;
        name: string;
        description?: string;
        category: string;
        status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';
        duration?: number;
        httpStatus?: number;
        stdout?: string;
        stderr?: string;
        errorMessage?: string;
        metadata?: any;
        createdAt: string;
      }>;
    }>(`/evaluations/${submissionId}/runtime-results`);
  },

  getFinalResult: async (submissionId: string) => {
    return apiFetch<{
      finalResult: {
        submissionId: string;
        aiScore: number;
        judgeScore?: number | null;
        finalScore: number;
        rank?: number | null;
        status: string;
        dimensionScores: Record<string, {
          score: number;
          weight: number;
          weightedScore: number;
          explanation: string;
          evidence: string[];
          isOverridden: boolean;
          judgeScore?: number | null;
        }>;
        judgeOverrides?: Record<string, { overrideScore: number; comment?: string }>;
        judgeComments?: string | null;
        weightsUsed: Record<string, number>;
        generatedAt: string;
      };
    }>(`/evaluations/${submissionId}/final-result`);
  },

  getScoringConfig: async (hackathonId?: string) => {
    const q = hackathonId ? `?hackathonId=${hackathonId}` : '';
    return apiFetch<{ weights: Record<string, number> }>(`/evaluations/scoring-config${q}`);
  },

  updateScoringConfig: async (weights: Record<string, number>, hackathonId?: string) => {
    return apiFetch<{ weights: Record<string, number> }>(`/evaluations/scoring-config`, {
      method: 'POST',
      body: JSON.stringify({ weights, hackathonId }),
    });
  },

  saveJudgeOverride: async (submissionId: string, dimension: string, score: number, comment?: string) => {
    return apiFetch<{ result: any }>(`/evaluations/${submissionId}/judge-override`, {
      method: 'POST',
      body: JSON.stringify({ dimension, score, comment }),
    });
  },

  triggerReevaluate: async (id: string) => {
    return apiFetch(`/evaluations/${id}/re-evaluate`, { method: 'POST' });
  },

  getFindings: async (submissionId?: string): Promise<Finding[]> => {
    try {
      const res = await apiFetch<{ findings: any[] }>(`/evaluations/${submissionId}/security-report`);
      return res.findings.map((f, idx) => ({
        id: f.id,
        code: `FND-00${idx + 1}`,
        severity: f.severity,
        category: f.category || 'Security',
        teamId: 'team-1',
        teamName: 'CyberPulse',
        problemId: 'prob-1',
        problemTitle: 'Fraud Engine',
        title: f.title,
        description: f.description,
        evidence: f.filePath || 'src/server.ts',
        affectedFile: f.filePath || 'src/server.ts',
        recommendation: f.recommendation,
        status: f.status === 'OPEN' ? 'OPEN' : 'MITIGATED',
      }));
    } catch (err) {
      return INITIAL_FINDINGS;
    }
  },
};

// ====================================================
// JUDGE API
// ====================================================
export const judgeApi = {
  submitEvaluation: async (submissionId: string, scores: any, feedback: string) => {
    return apiFetch('/judge/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        submissionId,
        scoreInnovation: scores.innovation || 90,
        scoreExecution: scores.execution || 90,
        scorePresentation: scores.presentation || 90,
        scoreOverall: Math.round(((scores.innovation || 90) + (scores.execution || 90) + (scores.presentation || 90)) / 3),
        feedback,
      }),
    });
  },
};

// ====================================================
// LEADERBOARD & DASHBOARD STATS API
// ====================================================
export const leaderboardApi = {
  getLeaderboard: async () => {
    try {
      return await apiFetch<{ leaderboard: any[] }>('/leaderboard');
    } catch (err) {
      return [];
    }
  },

  getDashboardStats: async () => {
    try {
      return await apiFetch<{ stats: any; recentSubmissions: any[] }>('/leaderboard/dashboard-stats');
    } catch (err) {
      return null;
    }
  },
};
