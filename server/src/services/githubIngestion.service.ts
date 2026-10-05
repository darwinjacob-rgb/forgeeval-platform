// ====================================================
// ForgeEval — GitHub Repository Ingestion Service
// Safe URL validation, shallow cloning, metadata collection,
// isolated temp storage, and zero code execution.
// ====================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import prisma from "../config/database.ts";
import { EvaluationPipelineService } from "./evaluationPipeline.service.ts";

const execFileAsync = promisify(execFile);

export interface GitHubUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  owner?: string;
  repo?: string;
  error?: string;
}

export interface IngestionMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  commitHash: string;
  sizeKb: number;
  fileCount: number;
  directoryCount: number;
  hasReadme: boolean;
  readmePath: string | null;
  packageManagers: string[];
  languages: string[];
  primaryLanguage: string;
  frameworks: string[];
}

export interface StructureNode {
  name: string;
  type: "file" | "dir";
  size?: string;
  children?: StructureNode[];
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".h": "C/C++ Header",
  ".hpp": "C++ Header",
  ".cs": "C#",
  ".rb": "Ruby",
  ".php": "PHP",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".scala": "Scala",
  ".sol": "Solidity",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Shell",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
};

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".turbo",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  ".idea",
  ".vscode",
  ".gradle",
]);

export class GitHubIngestionService {
  /**
   * Validate and parse a GitHub repository URL strictly.
   * Rejects path traversal, non-GitHub hosts, command injection flags, and invalid syntax.
   */
  public static validateAndParseGitHubUrl(rawUrl: string): GitHubUrlValidationResult {
    if (!rawUrl || typeof rawUrl !== "string") {
      return { valid: false, error: "Repository URL is required." };
    }

    const trimmed = rawUrl.trim();

    // Extra safety: block path traversal sequences
    if (trimmed.includes("..") || trimmed.includes("%2e%2e") || trimmed.includes("%2E%2E")) {
      return { valid: false, error: "Path traversal detected in repository URL." };
    }

    let parsed: URL;

    try {
      parsed = new URL(trimmed);
    } catch {
      return { valid: false, error: "Invalid URL format. Must be a valid URL (e.g., https://github.com/owner/repo)." };
    }

    // Must use http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Repository URL must use https:// protocol." };
    }

    // Must be github.com or www.github.com
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return { valid: false, error: "Only public GitHub repositories are supported (hostname must be github.com)." };
    }

    // Path segments: /owner/repo
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return { valid: false, error: "GitHub URL must include both owner and repository name (e.g., https://github.com/owner/repo)." };
    }

    const rawOwner = segments[0];
    let rawRepo = segments[1];

    // Strip trailing .git if present
    if (rawRepo.endsWith(".git")) {
      rawRepo = rawRepo.slice(0, -4);
    }

    // GitHub owner validation: alphanumeric and hyphens, cannot start or end with hyphen, max 39 chars
    const ownerRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    // GitHub repo validation: alphanumeric, hyphens, underscores, dots, max 100 chars, cannot start with hyphen
    const repoRegex = /^[a-zA-Z0-9_.-]+$/;

    if (!ownerRegex.test(rawOwner) || rawOwner.length > 39) {
      return { valid: false, error: "Invalid GitHub owner name in repository URL." };
    }

    if (!repoRegex.test(rawRepo) || rawRepo.length > 100 || rawRepo.startsWith("-")) {
      return { valid: false, error: "Invalid GitHub repository name in repository URL." };
    }

    // Extra safety: block path traversal sequences
    if (rawOwner.includes("..") || rawRepo.includes("..")) {
      return { valid: false, error: "Path traversal detected in repository URL." };
    }

    const normalizedUrl = `https://github.com/${rawOwner}/${rawRepo}`;

    return {
      valid: true,
      normalizedUrl,
      owner: rawOwner,
      repo: rawRepo,
    };
  }

  /**
   * Ingest repository safely in the background:
   * 1. Updates DB status to CLONING
   * 2. Shallow clones repo into isolated temp dir with zero code execution
   * 3. Updates DB status to INGESTING
   * 4. Gathers metadata, directory tree, README, languages, frameworks
   * 5. Saves metadata and updates DB status to READY
   * 6. Cleans up temp files
   */
  public static async ingestRepository(
    submissionId: string,
    githubUrl: string,
    branchPreference?: string
  ): Promise<IngestionMetadata | null> {
    const validation = this.validateAndParseGitHubUrl(githubUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      await this.markIngestionFailed(
        submissionId,
        validation.error || "Invalid GitHub repository URL provided."
      );
      return null;
    }

    const { normalizedUrl, owner = "", repo = "" } = validation;
    const tempDir = path.join(os.tmpdir(), "forgeeval-ingest", `${submissionId}-${Date.now()}`);

    try {
      // 1. Update status to CLONING
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          ingestionStatus: "CLONING",
          githubUrl: normalizedUrl,
          repoOwner: owner,
          repoName: repo,
          ingestionError: null,
        },
      });

      // Ensure base directory exists
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });

      // 2. Perform safe shallow clone (depth 1, single branch)
      // Disable interactive prompts and credentials helpers
      const cloneArgs = ["clone", "--depth", "1", "--single-branch"];
      if (branchPreference && /^[a-zA-Z0-9/_.-]+$/.test(branchPreference)) {
        cloneArgs.push("--branch", branchPreference);
      }
      cloneArgs.push(normalizedUrl, tempDir);

      try {
        await execFileAsync("git", cloneArgs, {
          timeout: 45000, // 45 seconds timeout
          env: {
            GIT_TERMINAL_PROMPT: "0",
            GIT_ASKPASS: "echo",
            HOME: os.tmpdir(),
          },
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (cloneErr: any) {
        const stderr = (cloneErr.stderr || cloneErr.message || "").toLowerCase();
        let safeError = "Failed to clone repository. Please ensure the repository is public and accessible.";

        if (
          stderr.includes("not found") ||
          stderr.includes("repository not found") ||
          stderr.includes("terminal prompt") ||
          stderr.includes("could not read username") ||
          stderr.includes("authentication failed")
        ) {
          safeError = "Repository not found or private. Private repositories are not currently supported.";
        } else if (stderr.includes("timed out") || cloneErr.killed) {
          safeError = "Repository clone timed out. Please check repository size and availability.";
        } else if (stderr.includes("remote branch") && stderr.includes("not found")) {
          safeError = `Branch '${branchPreference}' was not found in the repository.`;
        }

        await this.markIngestionFailed(submissionId, safeError);
        return null;
      }

      // 3. Update status to INGESTING
      await prisma.submission.update({
        where: { id: submissionId },
        data: { ingestionStatus: "INGESTING" },
      });

      // 4. Extract Git metadata
      let commitHash = "";
      let defaultBranch = branchPreference || "main";

      try {
        const { stdout: commitOut } = await execFileAsync("git", ["rev-parse", "HEAD"], {
          cwd: tempDir,
          timeout: 5000,
        });
        commitHash = commitOut.trim();
      } catch {
        commitHash = "unknown";
      }

      try {
        const { stdout: branchOut } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
          cwd: tempDir,
          timeout: 5000,
        });
        defaultBranch = branchOut.trim() || defaultBranch;
      } catch {
        // default remains
      }

      // 5. Inspect directory structure and collect metadata safely
      const inspection = await this.inspectDirectory(tempDir);

      // 6. Read README if available
      let readmeContent: string | null = null;
      if (inspection.readmePath) {
        try {
          const fullReadmePath = path.join(tempDir, inspection.readmePath);
          const raw = fs.readFileSync(fullReadmePath, "utf-8");
          // Cap at 30KB to avoid excessive storage
          readmeContent = raw.slice(0, 30000);
        } catch {
          readmeContent = null;
        }
      }

      // 7. Detect frameworks & dependencies from package.json or config
      const { frameworks, dependencies } = this.detectFrameworksAndDeps(tempDir);

      const metadata: IngestionMetadata = {
        owner,
        repo,
        defaultBranch,
        commitHash,
        sizeKb: Math.round(inspection.totalSizeBytes / 1024),
        fileCount: inspection.fileCount,
        directoryCount: inspection.directoryCount,
        hasReadme: Boolean(inspection.readmePath),
        readmePath: inspection.readmePath,
        packageManagers: inspection.packageManagers,
        languages: inspection.languages,
        primaryLanguage: inspection.primaryLanguage,
        frameworks,
      };

      // 8. Update database with complete metadata and mark READY
      await prisma.$transaction(async (tx) => {
        // Create frameworks records
        if (frameworks.length > 0) {
          await tx.submissionFramework.deleteMany({ where: { submissionId } });
          await tx.submissionFramework.createMany({
            data: frameworks.map((name) => ({ submissionId, name })),
          });
        }

        // Create top dependencies records
        if (dependencies.length > 0) {
          await tx.submissionDependency.deleteMany({ where: { submissionId } });
          await tx.submissionDependency.createMany({
            data: dependencies.slice(0, 25).map((d) => ({
              submissionId,
              name: d.name,
              version: d.version,
              auditStatus: "SECURE",
            })),
          });
        }

        await tx.submission.update({
          where: { id: submissionId },
          data: {
            ingestionStatus: "READY",
            ingestedAt: new Date(),
            ingestionError: null,
            githubUrl: normalizedUrl,
            repoOwner: owner,
            repoName: repo,
            commitHash,
            branch: defaultBranch,
            language: inspection.primaryLanguage,
            framework: frameworks.length > 0 ? frameworks.join(", ") : undefined,
            linesOfCode: inspection.estimatedLinesOfCode,
            readmeContent: readmeContent || undefined,
            projectStructure: inspection.structureTree as any,
            repoMetadata: metadata as any,
          },
        });
      });

      // Trigger Phase 2 Evaluation Pipeline (Requirement Mapping → Security → Runtime)
      try {
        const sub = await prisma.submission.findUnique({
          where: { id: submissionId },
          select: { problemId: true, demoUrl: true },
        });
        if (sub?.problemId) {
          console.log(`[GitHubIngestionService] Triggering Phase 2 pipeline for submission ${submissionId}`);
          EvaluationPipelineService.triggerPipeline(submissionId, sub.problemId, sub.demoUrl ?? undefined);
        }
      } catch (pipeErr) {
        console.error(`[GitHubIngestionService] Failed to trigger Phase 2 pipeline for ${submissionId}:`, pipeErr);
      }

      return metadata;
    } catch (err: any) {
      console.error(`[GitHubIngestionService] Ingestion failed for ${submissionId}:`, err);
      await this.markIngestionFailed(
        submissionId,
        "An unexpected error occurred while inspecting the repository structure."
      );
      return null;
    } finally {
      // 9. Always clean up isolated temporary storage
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanErr) {
        console.warn(`[GitHubIngestionService] Failed to clean up temp dir ${tempDir}:`, cleanErr);
      }
    }
  }

  /**
   * Helper to mark a submission ingestion as FAILED with a safe human-readable error.
   */
  private static async markIngestionFailed(submissionId: string, safeError: string) {
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          ingestionStatus: "FAILED",
          ingestedAt: new Date(),
          ingestionError: safeError,
        },
      });
    } catch (dbErr) {
      console.error(`[GitHubIngestionService] Could not update failed status for ${submissionId}:`, dbErr);
    }
  }

  /**
   * Recursively inspect repository directory up to a safe depth (max 4 levels).
   * Aggregates file count, directory count, size, language breakdown, README, and structure tree.
   */
  private static async inspectDirectory(baseDir: string) {
    let fileCount = 0;
    let directoryCount = 0;
    let totalSizeBytes = 0;
    let estimatedLinesOfCode = 0;
    let readmePath: string | null = null;

    const languageCounts: Record<string, number> = {};
    const packageManagersSet = new Set<string>();

    function walk(currentDir: string, relativePath: string, depth: number): StructureNode[] {
      if (depth > 4) return [];

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return [];
      }

      const nodes: StructureNode[] = [];

      for (const entry of entries) {
        const name = entry.name;
        const entryRelPath = relativePath ? `${relativePath}/${name}` : name;
        const fullPath = path.join(currentDir, name);

        if (entry.isDirectory()) {
          if (IGNORED_DIRECTORIES.has(name)) continue;

          directoryCount++;
          const children = walk(fullPath, entryRelPath, depth + 1);
          nodes.push({
            name,
            type: "dir",
            children: children.slice(0, 20), // Cap children per folder
          });
        } else if (entry.isFile()) {
          fileCount++;
          let size = 0;
          try {
            const stat = fs.statSync(fullPath);
            size = stat.size;
            totalSizeBytes += size;
          } catch {
            // ignore stat failure
          }

          // Check for README
          const lowerName = name.toLowerCase();
          if (!readmePath && (lowerName === "readme.md" || lowerName === "readme" || lowerName === "readme.txt" || lowerName === "readme.markdown")) {
            readmePath = entryRelPath;
          }

          // Check package manager files
          if (name === "package.json") packageManagersSet.add("npm/yarn/pnpm");
          else if (name === "Cargo.toml") packageManagersSet.add("Cargo");
          else if (name === "requirements.txt" || name === "Pipfile" || name === "pyproject.toml") packageManagersSet.add("pip/poetry");
          else if (name === "go.mod") packageManagersSet.add("Go Modules");
          else if (name === "pom.xml") packageManagersSet.add("Maven");
          else if (name === "build.gradle" || name === "build.gradle.kts") packageManagersSet.add("Gradle");
          else if (name === "Gemfile") packageManagersSet.add("Bundler");
          else if (name === "composer.json") packageManagersSet.add("Composer");

          // Language detection from extension
          const ext = path.extname(name).toLowerCase();
          if (EXTENSION_LANGUAGE_MAP[ext]) {
            const lang = EXTENSION_LANGUAGE_MAP[ext];
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;

            // Rough line estimate for code files
            if (size > 0 && size < 500000) {
              estimatedLinesOfCode += Math.round(size / 35);
            }
          }

          nodes.push({
            name,
            type: "file",
            size: formatFileSize(size),
          });
        }
      }

      return nodes;
    }

    const structureTree = walk(baseDir, "", 0);

    // Sort languages by count
    const sortedLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    const primaryLanguage = sortedLanguages[0] || "Unknown";

    return {
      fileCount,
      directoryCount,
      totalSizeBytes,
      estimatedLinesOfCode: estimatedLinesOfCode > 0 ? estimatedLinesOfCode : 120,
      readmePath,
      packageManagers: Array.from(packageManagersSet),
      languages: sortedLanguages,
      primaryLanguage,
      structureTree: structureTree.slice(0, 30),
    };
  }

  /**
   * Inspect package.json or config files to extract detected frameworks and dependencies
   */
  private static detectFrameworksAndDeps(dir: string): {
    frameworks: string[];
    dependencies: { name: string; version: string }[];
  } {
    const frameworks = new Set<string>();
    const dependencies: { name: string; version: string }[] = [];

    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, "utf-8");
        const parsed = JSON.parse(content);
        const allDeps = {
          ...parsed.dependencies,
          ...parsed.devDependencies,
        };

        for (const [name, version] of Object.entries(allDeps)) {
          dependencies.push({ name, version: String(version) });

          const lower = name.toLowerCase();
          if (lower === "react") frameworks.add("React");
          else if (lower === "next") frameworks.add("Next.js");
          else if (lower === "express") frameworks.add("Express");
          else if (lower === "vue") frameworks.add("Vue");
          else if (lower === "svelte" || lower === "@sveltejs/kit") frameworks.add("Svelte");
          else if (lower === "tailwindcss") frameworks.add("TailwindCSS");
          else if (lower === "@prisma/client" || lower === "prisma") frameworks.add("Prisma");
          else if (lower === "fastify") frameworks.add("Fastify");
          else if (lower === "@nestjs/core") frameworks.add("NestJS");
          else if (lower === "vite") frameworks.add("Vite");
        }
      } catch {
        // ignore parse errors
      }
    }

    // Python indicators
    if (fs.existsSync(path.join(dir, "requirements.txt")) || fs.existsSync(path.join(dir, "pyproject.toml"))) {
      try {
        const reqs = fs.existsSync(path.join(dir, "requirements.txt"))
          ? fs.readFileSync(path.join(dir, "requirements.txt"), "utf-8")
          : "";
        const lower = reqs.toLowerCase();
        if (lower.includes("fastapi")) frameworks.add("FastAPI");
        if (lower.includes("django")) frameworks.add("Django");
        if (lower.includes("flask")) frameworks.add("Flask");
        if (lower.includes("torch") || lower.includes("pytorch")) frameworks.add("PyTorch");
      } catch {
        // ignore
      }
    }

    // Rust indicators
    if (fs.existsSync(path.join(dir, "Cargo.toml"))) {
      try {
        const cargo = fs.readFileSync(path.join(dir, "Cargo.toml"), "utf-8").toLowerCase();
        if (cargo.includes("actix")) frameworks.add("Actix-web");
        if (cargo.includes("axum")) frameworks.add("Axum");
        if (cargo.includes("tokio")) frameworks.add("Tokio");
      } catch {
        // ignore
      }
    }

    return {
      frameworks: Array.from(frameworks),
      dependencies,
    };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
