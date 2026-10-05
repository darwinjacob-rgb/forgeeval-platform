export interface Problem {
  id: string;
  code: string;
  title: string;
  category: 'AI & Agents' | 'Distributed Systems' | 'FinTech' | 'Cybersecurity' | 'Web3 Infrastructure' | 'DevOps & Tooling';
  difficulty: 'CRITICAL' | 'HARD' | 'MEDIUM' | 'EASY';
  submissionsCount: number;
  requirementsCount: number;
  status: 'ACTIVE' | 'EVALUATING' | 'CONCLUDED';
  description: string;
  deadline: string;
  inputRequirements: string[];
  outputRequirements: string[];
  functionalRequirements: string[];
  technicalRequirements: string[];
  securityRequirements: string[];
  performanceRequirements: string[];
  uiUxRequirements: string[];
  docRequirements: string[];
}

export interface RequirementItem {
  id: string;
  code: string;
  category: 'Functional' | 'Security' | 'Performance' | 'UI/UX' | 'Documentation' | 'Testing';
  requirement: string;
  evidence: string;
  status: 'SATISFIED' | 'PARTIAL' | 'MISSING';
  confidence: number; // percentage 0-100
  fileMatch?: string;
  lineSpan?: string;
}

export interface Finding {
  id: string;
  code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'Security' | 'Architecture' | 'Code Quality' | 'Testing' | 'Performance';
  teamId: string;
  teamName: string;
  problemId: string;
  problemTitle: string;
  title: string;
  description: string;
  evidence: string;
  affectedFile: string;
  recommendation: string;
  status: 'OPEN' | 'VERIFIED' | 'MITIGATED' | 'DISMISSED';
}

export interface Submission {
  id: string;
  team: string;
  avatar: string;
  problemId: string;
  problemTitle: string;
  repository: string;
  branch: string;
  language: string;
  submittedAt: string;
  commitHash: string;
  status: 'ANALYZED' | 'IN_REVIEW' | 'PENDING' | 'FAILED';
  isReleased?: boolean;
  githubUrl?: string;
  repoOwner?: string;
  repoName?: string;
  ingestionStatus?: 'PENDING' | 'CLONING' | 'INGESTING' | 'READY' | 'FAILED';
  ingestedAt?: string;
  ingestionError?: string | null;
  repoMetadata?: {
    owner?: string;
    repo?: string;
    defaultBranch?: string;
    sizeKb?: number;
    fileCount?: number;
    directoryCount?: number;
    hasReadme?: boolean;
    readmePath?: string | null;
    packageManagers?: string[];
    languages?: string[];
    primaryLanguage?: string;
    frameworks?: string[];
  };
  overallScore: number;
  criteriaScores: {
    requirement: number;
    codeQuality: number;
    security: number;
    testing: number;
    documentation: number;
    uiUx: number;
  };
  metrics: {
    linesOfCode: number;
    cyclomaticComplexity: number;
    testCoverage: number;
    buildTimeSec: number;
    vulnerabilitiesCount: number;
  };
  frameworks: string[];
  dependencies: { name: string; version: string; auditStatus: 'SECURE' | 'OUTDATED' | 'VULNERABLE' }[];
  readmePreview: string;
  projectStructure: { name: string; type: 'file' | 'dir'; size?: string; children?: any[] }[];
  runtimeLogs: { timestamp: string; level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM'; message: string }[];
  exitCode: number;
  buildStatus: 'SUCCESS' | 'WARNING' | 'FAILED';
  executionTime: string;
}

export interface JudgeEvaluation {
  submissionId: string;
  judgeName: string;
  timestamp: string;
  scores: {
    requirementCompliance: number;
    codeQuality: number;
    security: number;
    testing: number;
    documentation: number;
    uiUx: number;
  };
  comments: {
    strengths: string;
    flaws: string;
    evidenceNotes: string;
  };
  finalNotes: string;
  verified: boolean;
}
