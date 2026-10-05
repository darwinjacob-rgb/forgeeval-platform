// ====================================================
// ForgeEval — Requirement ↔ Code Mapping Service
// Phase 2 — Part 4
//
// For each stored Requirement, statically analyses the
// ingested repository to determine SATISFIED / PARTIAL /
// MISSING / UNKNOWN status with real file evidence.
//
// Evidence types:
//   VERIFIED  — found in actual source code / files
//   CLAIMED   — only found in README / docs / comments
//   UNKNOWN   — no signal found
//
// Never fabricates files, functions, or endpoints.
// ====================================================

import fs from "node:fs";
import path from "node:path";
import prisma from "../config/database.ts";

export interface MappingEvidence {
  type: "VERIFIED" | "CLAIMED" | "UNKNOWN";
  filePath: string;
  lineNumber?: number;
  snippet?: string;
}

export interface RequirementMappingResult {
  requirementId: string;
  requirementCode: string;
  requirementTitle: string;
  requirementDescription: string;
  requirementCategory: string;
  requirementKeywords: string[];
  status: "SATISFIED" | "PARTIAL" | "MISSING" | "UNKNOWN";
  confidence: number; // 0-100
  evidence: MappingEvidence[];
  matchedFiles: string[];
  explanation: string;
}

// ── Stop words excluded from keyword search ────────────────────────────────
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "that", "which", "is", "are", "was", "were",
  "be", "been", "have", "has", "do", "does", "will", "would", "could",
  "should", "must", "may", "might", "can", "this", "it", "its", "user",
  "system", "application", "app", "feature", "should", "shall",
]);

// ── File categories used to assess evidence strength ──────────────────────
const STRONG_EVIDENCE_PATTERNS: Record<string, RegExp[]> = {
  FUNCTIONAL: [
    /(?:controller|handler|service|route|endpoint|api)\.(ts|js|py|go|rs|java)/i,
    /(?:create|get|update|delete|list|fetch|submit|upload|download)\w*\.(ts|js|py)/i,
  ],
  SECURITY: [
    /(?:auth|jwt|passport|guard|middleware|permission|rbac|role|token|login|logout|session)\.(ts|js|py)/i,
    /(?:encrypt|hash|bcrypt|argon|crypto)\.(ts|js|py)/i,
  ],
  TECHNICAL: [
    /(?:docker|kubernetes|k8s|compose|deploy|ci|cd|workflow|github[\/-]action)/i,
    /(?:database|db|migration|schema|model|entity|orm|prisma|mongoose|typeorm)\.(ts|js|py)/i,
  ],
  PERFORMANCE: [
    /(?:cache|redis|queue|worker|job|batch|concurren|throttl|rate[-_]limit)\.(ts|js|py)/i,
    /(?:benchmark|load|stress|perf)\.(ts|js|py|yml)/i,
  ],
  UI_UX: [
    /(?:component|page|view|screen|layout|modal|form|button|card|table)\.(tsx|jsx|vue|svelte)/i,
    /(?:style|theme|css|scss|tailwind|chakra|material)\.(ts|js|css|scss)/i,
  ],
  DOCUMENTATION: [
    /(?:readme|contributing|docs?|changelog|license|api[-_]docs?)\.(md|txt|rst)/i,
    /(?:swagger|openapi|postman|insomnia)\.(json|yaml|yml)/i,
  ],
  INNOVATION: [
    /(?:ai|ml|model|predict|inference|llm|gpt|openai|anthropic|langchain|rag|vector|embed)\.(ts|js|py)/i,
    /(?:blockchain|smart[-_]contract|web3|solidity|nft|defi)\.(ts|js|sol)/i,
  ],
  TESTING: [
    /(?:test|spec|__tests__|e2e|integration|unit)\.(ts|js|py|go|java)/i,
    /(?:jest|vitest|cypress|playwright|pytest|go test)\.(ts|js|config\.(ts|js))/i,
  ],
};

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", ".next",
  "vendor", ".venv", "venv", "__pycache__", "target", ".gradle",
]);

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".php", ".java", ".go", ".rs", ".cs",
]);

const DOC_EXTENSIONS = new Set([".md", ".txt", ".rst", ".rdoc"]);

// ── File system helpers ────────────────────────────────────────────────────

function* walkFiles(dir: string): Generator<string> {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* walkFiles(full);
      else if (entry.isFile()) yield full;
    }
  } catch { /* skip */ }
}

function readFileSafe(filePath: string, maxBytes = 256 * 1024): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractKeywords(texts: string[]): string[] {
  const words = new Set<string>();
  for (const text of texts) {
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      .forEach((w) => words.add(w));
  }
  return Array.from(words);
}

// ── Core mapper ────────────────────────────────────────────────────────────

export class RequirementMappingService {
  /**
   * Map all requirements of a problem against a cloned repository.
   */
  public static async mapRequirements(
    submissionId: string,
    problemId: string,
    repoDir: string
  ): Promise<RequirementMappingResult[]> {
    const requirements = await prisma.requirement.findMany({
      where: { problemId },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });

    if (requirements.length === 0) return [];
    if (!fs.existsSync(repoDir)) {
      return requirements.map((req) => ({
        requirementId: req.id,
        requirementCode: req.code,
        requirementTitle: req.title,
        requirementDescription: req.description || "",
        requirementCategory: req.category,
        requirementKeywords: req.keywords,
        status: "UNKNOWN",
        confidence: 0,
        evidence: [],
        matchedFiles: [],
        explanation: "Repository directory not available for analysis.",
      }));
    }

    // ── Index all files in the repository ──────────────────────────────────
    const allFiles: string[] = [];
    for (const f of walkFiles(repoDir)) {
      allFiles.push(f);
    }

    // ── Map each requirement ──────────────────────────────────────────────
    const results: RequirementMappingResult[] = [];

    for (const req of requirements) {
      const keywords = extractKeywords([
        req.title,
        req.description || "",
        ...req.keywords,
      ]);

      const evidence: MappingEvidence[] = [];
      const matchedFilePaths = new Set<string>();

      // ── 1. Check category-specific strong evidence patterns ──────────────
      const categoryPatterns = STRONG_EVIDENCE_PATTERNS[req.category] || [];

      for (const filePath of allFiles) {
        const relPath = path.relative(repoDir, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const isCode = CODE_EXTENSIONS.has(ext);
        const isDoc = DOC_EXTENSIONS.has(ext);

        // File name/path matches category patterns → strong structural signal
        const fileMatchesCategory = categoryPatterns.some((pat) => pat.test(relPath));

        if (fileMatchesCategory && (isCode || isDoc)) {
          const content = readFileSafe(filePath);
          if (!content) continue;

          // ── 2. Keyword match within file content ─────────────────────────
          const matchedKeywords = keywords.filter((kw) =>
            content.toLowerCase().includes(kw)
          );

          if (matchedKeywords.length > 0) {
            const evidenceType: "VERIFIED" | "CLAIMED" = isCode ? "VERIFIED" : "CLAIMED";
            const lines = content.split("\n");
            const firstMatchLine = lines.findIndex((ln) =>
              matchedKeywords.some((kw) => ln.toLowerCase().includes(kw))
            );

            evidence.push({
              type: evidenceType,
              filePath: relPath,
              lineNumber: firstMatchLine >= 0 ? firstMatchLine + 1 : undefined,
              snippet: firstMatchLine >= 0
                ? lines[firstMatchLine].trim().substring(0, 120)
                : undefined,
            });
            matchedFilePaths.add(relPath);
          }
        }
      }

      // ── 3. Broad keyword scan across all code files if few hits ──────────
      if (evidence.filter((e) => e.type === "VERIFIED").length < 2) {
        for (const filePath of allFiles) {
          const ext = path.extname(filePath).toLowerCase();
          if (!CODE_EXTENSIONS.has(ext)) continue;
          const relPath = path.relative(repoDir, filePath);
          if (matchedFilePaths.has(relPath)) continue;

          const content = readFileSafe(filePath, 128 * 1024);
          if (!content) continue;
          const lower = content.toLowerCase();

          const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
          if (matchCount >= 2) {
            const lines = content.split("\n");
            const firstMatchLine = lines.findIndex((ln) =>
              keywords.some((kw) => ln.toLowerCase().includes(kw))
            );
            evidence.push({
              type: "VERIFIED",
              filePath: relPath,
              lineNumber: firstMatchLine >= 0 ? firstMatchLine + 1 : undefined,
              snippet: firstMatchLine >= 0
                ? lines[firstMatchLine].trim().substring(0, 120)
                : undefined,
            });
            matchedFilePaths.add(relPath);
          }
        }
      }

      // ── 4. README/doc scan for CLAIMED evidence ───────────────────────────
      for (const filePath of allFiles) {
        const ext = path.extname(filePath).toLowerCase();
        if (!DOC_EXTENSIONS.has(ext)) continue;
        const relPath = path.relative(repoDir, filePath);
        if (matchedFilePaths.has(relPath)) continue;

        const content = readFileSafe(filePath);
        if (!content) continue;
        const lower = content.toLowerCase();

        const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
        if (matchCount >= 1) {
          evidence.push({
            type: "CLAIMED",
            filePath: relPath,
          });
          matchedFilePaths.add(relPath);
        }
      }

      // ── 5. Determine status and confidence ────────────────────────────────
      const verifiedCount = evidence.filter((e) => e.type === "VERIFIED").length;
      const claimedCount = evidence.filter((e) => e.type === "CLAIMED").length;
      const totalSignals = verifiedCount + claimedCount * 0.3;

      let status: "SATISFIED" | "PARTIAL" | "MISSING" | "UNKNOWN";
      let confidence: number;
      let explanation: string;

      if (verifiedCount >= 3) {
        status = "SATISFIED";
        confidence = Math.min(95, 65 + verifiedCount * 7);
        explanation = `Requirement satisfied: ${verifiedCount} source file(s) contain implementation evidence matching the requirement keywords. ${claimedCount > 0 ? `Additionally mentioned in ${claimedCount} documentation file(s).` : ""}`;
      } else if (verifiedCount >= 1) {
        status = "PARTIAL";
        confidence = Math.min(75, 40 + verifiedCount * 12 + claimedCount * 3);
        explanation = `Partial evidence found: ${verifiedCount} source file(s) match requirement keywords but coverage appears incomplete. ${claimedCount > 0 ? `Documentation mentions it in ${claimedCount} file(s).` : ""}`;
      } else if (claimedCount >= 1) {
        status = "PARTIAL";
        confidence = Math.min(35, 15 + claimedCount * 8);
        explanation = `Only documentation evidence found: Requirement is claimed in ${claimedCount} documentation file(s) but no corresponding source code implementation was detected.`;
      } else if (totalSignals === 0 && keywords.length === 0) {
        status = "UNKNOWN";
        confidence = 0;
        explanation = "Requirement has no extractable keywords to search against the codebase.";
      } else {
        status = "MISSING";
        confidence = 0;
        explanation = `No evidence found for this requirement in the repository. Searched for keywords: ${keywords.slice(0, 5).join(", ")}`;
      }

      results.push({
        requirementId: req.id,
        requirementCode: req.code,
        requirementTitle: req.title,
        requirementDescription: req.description || "",
        requirementCategory: req.category,
        requirementKeywords: req.keywords,
        status,
        confidence,
        evidence: evidence.slice(0, 10), // cap at 10 evidence items per requirement
        matchedFiles: Array.from(matchedFilePaths).slice(0, 10),
        explanation,
      });
    }

    return results;
  }

  /**
   * Persist mapping results to RequirementResult table.
   */
  public static async persistMappingResults(
    submissionId: string,
    results: RequirementMappingResult[]
  ): Promise<void> {
    // Clear old results
    await prisma.requirementResult.deleteMany({ where: { submissionId } });

    if (results.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const r of results) {
        const evidenceJson = r.evidence.map((e) => ({
          type: e.type,
          filePath: e.filePath,
          lineNumber: e.lineNumber,
          snippet: e.snippet,
        }));

        await tx.requirementResult.upsert({
          where: { submissionId_requirementId: { submissionId, requirementId: r.requirementId } },
          update: {
            status: r.status === "UNKNOWN" ? "MISSING" : r.status,
            confidence: r.confidence / 100,
            evidence: r.explanation,
            filePath: r.matchedFiles[0] || null,
            explanation: JSON.stringify({ evidence: evidenceJson, matchedFiles: r.matchedFiles }),
          },
          create: {
            submissionId,
            requirementId: r.requirementId,
            status: r.status === "UNKNOWN" ? "MISSING" : r.status,
            confidence: r.confidence / 100,
            evidence: r.explanation,
            filePath: r.matchedFiles[0] || null,
            explanation: JSON.stringify({ evidence: evidenceJson, matchedFiles: r.matchedFiles }),
          },
        });
      }
    });
  }
}
