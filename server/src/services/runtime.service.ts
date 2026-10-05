// ====================================================
// ForgeEval — Safe Runtime & Functional Testing Service
// Phase 2 — Part 6
//
// Performs STATIC checks only on the cloned repository.
// NEVER executes submitted code on the ForgeEval host.
// NEVER installs submitted dependencies.
//
// If a demoUrl is provided and is safe to ping,
// performs a single lightweight HTTP health check.
// ====================================================

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

export interface RuntimeTestResult {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "PASS" | "FAIL" | "SKIPPED" | "ERROR";
  durationMs: number;
  httpStatus?: number;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface RuntimeAnalysisReport {
  tests: RuntimeTestResult[];
  scoreRuntime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  errorTests: number;
  detectionsReport: {
    buildSystem?: string;
    testFrameworks: string[];
    hasTests: boolean;
    hasCiConfig: boolean;
    hasDockerfile: boolean;
    hasReadme: boolean;
    entryPoints: string[];
  };
}

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", ".next",
  "vendor", ".venv", "venv", "__pycache__", "target", ".gradle",
]);

// ── Safe URL allowlist for health checks ─────────────────────────────────────
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost", "127.0.0.1", "::1", "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "10.0.0.1",
]);

function* walkFilesShallow(dir: string, maxDepth = 4, depth = 0): Generator<string> {
  if (depth > maxDepth) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* walkFilesShallow(full, maxDepth, depth + 1);
      else if (entry.isFile()) yield full;
    }
  } catch { /* skip */ }
}

function fileExists(repoDir: string, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const full = path.join(repoDir, candidate);
    if (fs.existsSync(full)) return candidate;
  }
  return null;
}

function readFileSafe(filePath: string, maxBytes = 128 * 1024): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function isSafeUrl(rawUrl: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(rawUrl);
    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) {
      return { safe: false, reason: "Non-HTTP protocol" };
    }
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) {
      return { safe: false, reason: "Private/local network address blocked" };
    }
    // Block private IP ranges
    if (/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
      return { safe: false, reason: "Private IP range blocked for security" };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }
}

async function httpHealthCheck(url: string, timeoutMs = 5000): Promise<{
  statusCode?: number;
  durationMs: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ durationMs: 0, error: "Invalid URL" });
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      timeout: timeoutMs,
      headers: { "User-Agent": "ForgeEval-Healthcheck/2.0" },
    };

    const req = lib.request(options, (res) => {
      res.resume(); // drain without reading body
      resolve({
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ durationMs: Date.now() - start, error: "Request timed out" });
    });

    req.on("error", (err) => {
      resolve({ durationMs: Date.now() - start, error: err.message });
    });

    req.end();
  });
}

// ── Test runners ──────────────────────────────────────────────────────────────

export class RuntimeService {
  public static async runAnalysis(
    submissionId: string,
    repoDir: string,
    demoUrl?: string
  ): Promise<RuntimeAnalysisReport> {
    const tests: RuntimeTestResult[] = [];

    if (!fs.existsSync(repoDir)) {
      return this.emptyReport();
    }

    const t0 = Date.now();

    // ── Test 1: README Detection ─────────────────────────────────────────────
    const readmePath = fileExists(repoDir, "README.md", "README.txt", "README.rst", "readme.md");
    tests.push({
      id: "RT-001",
      name: "README / Documentation File",
      description: "Checks that a README or documentation file exists in the repository root.",
      category: "DOCUMENTATION",
      status: readmePath ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: readmePath ? `Found: ${readmePath}` : "No README file detected in repository root.",
      metadata: { readmePath },
    });

    // ── Test 2: Build/Package Configuration ─────────────────────────────────
    const pkgJson = fileExists(repoDir, "package.json");
    const cargoToml = fileExists(repoDir, "Cargo.toml");
    const pyProject = fileExists(repoDir, "pyproject.toml", "setup.py", "setup.cfg");
    const goMod = fileExists(repoDir, "go.mod");
    const buildGradle = fileExists(repoDir, "build.gradle", "build.gradle.kts");
    const pomXml = fileExists(repoDir, "pom.xml");

    const buildFile = pkgJson || cargoToml || pyProject || goMod || buildGradle || pomXml;
    const buildSystem = pkgJson ? "Node.js/NPM" : cargoToml ? "Rust/Cargo" : pyProject ? "Python" :
      goMod ? "Go" : buildGradle ? "Java/Gradle" : pomXml ? "Java/Maven" : undefined;

    tests.push({
      id: "RT-002",
      name: "Build System Configuration",
      description: "Verifies presence of a recognised build configuration file.",
      category: "BUILD",
      status: buildFile ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: buildFile ? `Detected build system: ${buildSystem} (${buildFile})` : "No build configuration file found.",
      metadata: { buildSystem, buildFile },
    });

    // ── Test 3: Test Framework Detection ─────────────────────────────────────
    let testFrameworks: string[] = [];
    let hasTestDir = false;

    if (pkgJson) {
      const pkgContent = readFileSafe(path.join(repoDir, "package.json"));
      try {
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps["jest"]) testFrameworks.push("Jest");
        if (allDeps["vitest"]) testFrameworks.push("Vitest");
        if (allDeps["mocha"]) testFrameworks.push("Mocha");
        if (allDeps["cypress"]) testFrameworks.push("Cypress");
        if (allDeps["playwright"]) testFrameworks.push("Playwright");
        if (allDeps["jasmine"]) testFrameworks.push("Jasmine");
        if (pkg.scripts?.test && !pkg.scripts.test.includes("echo")) {
          testFrameworks.push("(custom test script)");
        }
      } catch { /* ignore */ }
    }

    if (cargoToml) {
      const cargoContent = readFileSafe(path.join(repoDir, "Cargo.toml"));
      if (cargoContent.includes("[dev-dependencies]")) testFrameworks.push("Rust (built-in tests)");
    }

    if (pyProject) {
      const pyContent = readFileSafe(path.join(repoDir, pyProject));
      if (pyContent.includes("pytest")) testFrameworks.push("pytest");
      if (pyContent.includes("unittest")) testFrameworks.push("unittest");
    }

    // Check for test directories
    for (const testDir of ["tests", "test", "__tests__", "spec", "e2e"]) {
      if (fs.existsSync(path.join(repoDir, testDir))) {
        hasTestDir = true;
        break;
      }
    }

    tests.push({
      id: "RT-003",
      name: "Test Framework & Test Suite Detection",
      description: "Detects presence of testing frameworks and test files/directories.",
      category: "TESTING",
      status: testFrameworks.length > 0 || hasTestDir ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: testFrameworks.length > 0
        ? `Detected frameworks: ${testFrameworks.join(", ")}. Test directory: ${hasTestDir ? "present" : "not found"}.`
        : hasTestDir
          ? "Test directory detected but no testing framework found in dependencies."
          : "No testing framework or test directory detected.",
      metadata: { testFrameworks, hasTestDir },
    });

    // ── Test 4: CI/CD Configuration ──────────────────────────────────────────
    const ghActionsDir = path.join(repoDir, ".github", "workflows");
    const hasGHActions = fs.existsSync(ghActionsDir) && fs.readdirSync(ghActionsDir).some((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    const hasGitlabCI = fs.existsSync(path.join(repoDir, ".gitlab-ci.yml"));
    const hasCircleCI = fs.existsSync(path.join(repoDir, ".circleci", "config.yml"));
    const hasCiConfig = hasGHActions || hasGitlabCI || hasCircleCI;
    const ciType = hasGHActions ? "GitHub Actions" : hasGitlabCI ? "GitLab CI" : hasCircleCI ? "CircleCI" : null;

    tests.push({
      id: "RT-004",
      name: "CI/CD Pipeline Configuration",
      description: "Checks for continuous integration configuration files.",
      category: "DEVOPS",
      status: hasCiConfig ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: hasCiConfig ? `CI/CD pipeline detected: ${ciType}` : "No CI/CD configuration detected (GitHub Actions, GitLab CI, CircleCI).",
      metadata: { ciType },
    });

    // ── Test 5: Docker Configuration ─────────────────────────────────────────
    const dockerfilePath = fileExists(repoDir, "Dockerfile", "docker-compose.yml", "docker-compose.yaml");
    tests.push({
      id: "RT-005",
      name: "Docker / Containerisation Configuration",
      description: "Checks for Dockerfile or docker-compose configuration.",
      category: "DEVOPS",
      status: dockerfilePath ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: dockerfilePath ? `Container configuration found: ${dockerfilePath}` : "No Dockerfile or docker-compose.yml detected.",
      metadata: { dockerfilePath },
    });

    // ── Test 6: Environment Variable Configuration ────────────────────────────
    const envExample = fileExists(repoDir, ".env.example", ".env.sample", ".env.template");
    const hasEnvActual = fileExists(repoDir, ".env"); // .env should NOT be committed
    tests.push({
      id: "RT-006",
      name: "Environment Configuration Template",
      description: "Checks for a .env.example template (indicates proper secret management).",
      category: "SECURITY",
      status: envExample ? "PASS" : hasEnvActual ? "FAIL" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: envExample
        ? `Environment template found: ${envExample}`
        : hasEnvActual
          ? "WARNING: .env file committed to repository (potential secret exposure). Missing .env.example template."
          : "No .env.example template found. Add one to document required environment variables.",
      errorMessage: hasEnvActual ? ".env file should not be committed to version control" : undefined,
      metadata: { envExample, hasEnvActual: !!hasEnvActual },
    });

    // ── Test 7: Application Entry Points ─────────────────────────────────────
    const entryPoints: string[] = [];
    const entryPointCandidates = [
      "src/main.ts", "src/index.ts", "src/app.ts", "src/server.ts",
      "index.js", "main.py", "main.go", "src/main.rs",
      "app.py", "server.py",
    ];
    for (const ep of entryPointCandidates) {
      if (fs.existsSync(path.join(repoDir, ep))) {
        entryPoints.push(ep);
      }
    }

    tests.push({
      id: "RT-007",
      name: "Application Entry Point Detection",
      description: "Detects main application entry files.",
      category: "BUILD",
      status: entryPoints.length > 0 ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: entryPoints.length > 0
        ? `Entry points found: ${entryPoints.join(", ")}`
        : "No standard entry point file detected.",
      metadata: { entryPoints },
    });

    // ── Test 8: Source Code Presence ─────────────────────────────────────────
    const srcDir = fileExists(repoDir, "src", "lib", "app");
    const hasSourceFiles = srcDir !== null;
    let codeFileCount = 0;
    if (hasSourceFiles) {
      for (const _ of walkFilesShallow(path.join(repoDir, srcDir!), 5)) {
        codeFileCount++;
        if (codeFileCount > 200) break;
      }
    }

    tests.push({
      id: "RT-008",
      name: "Source Code Structure",
      description: "Verifies meaningful source code is present (non-empty project).",
      category: "BUILD",
      status: codeFileCount >= 5 ? "PASS" : codeFileCount >= 1 ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: codeFileCount > 0
        ? `Source directory: ${srcDir}. Detected approximately ${codeFileCount} files.`
        : "No organised source directory found.",
      metadata: { srcDir, codeFileCount },
    });

    // ── Test 9: HTTP Health Check (demoUrl only, if provided) ─────────────────
    if (demoUrl) {
      const urlSafety = isSafeUrl(demoUrl);
      if (!urlSafety.safe) {
        tests.push({
          id: "RT-009",
          name: "Live Application Health Check",
          description: "Tests the running demo application via HTTP request.",
          category: "API",
          status: "SKIPPED",
          durationMs: 0,
          stdout: `Health check skipped: ${urlSafety.reason}`,
          metadata: { demoUrl, reason: urlSafety.reason },
        });
      } else {
        const healthResult = await httpHealthCheck(demoUrl, 8000);
        const ok = healthResult.statusCode && healthResult.statusCode >= 200 && healthResult.statusCode < 500;
        tests.push({
          id: "RT-009",
          name: "Live Application Health Check",
          description: `HTTP GET request to demo URL: ${demoUrl}`,
          category: "API",
          status: healthResult.error ? "ERROR" : ok ? "PASS" : "FAIL",
          durationMs: healthResult.durationMs,
          httpStatus: healthResult.statusCode,
          stdout: healthResult.statusCode
            ? `HTTP ${healthResult.statusCode} — ${healthResult.durationMs}ms`
            : undefined,
          errorMessage: healthResult.error,
          metadata: { demoUrl, statusCode: healthResult.statusCode },
        });
      }
    } else {
      tests.push({
        id: "RT-009",
        name: "Live Application Health Check",
        description: "Tests the running demo application via HTTP request.",
        category: "API",
        status: "SKIPPED",
        durationMs: 0,
        stdout: "No demo URL provided. Static analysis only.",
        metadata: {},
      });
    }

    // ── Test 10: API Route Detection ──────────────────────────────────────────
    let apiRouteCount = 0;
    const routePatterns = [
      /(?:router|app)\.[a-z]+\s*\(\s*['"`]\/[^'"`,]+/g,
      /(?:@Get|@Post|@Put|@Delete|@Patch)\s*\(\s*['"`][^'"`,]+/g,
      /(?:route|path)\s*:\s*['"`]\/[^'"`,]+/g,
    ];

    for (const filePath of walkFilesShallow(repoDir, 6)) {
      const ext = path.extname(filePath).toLowerCase();
      if (![".ts", ".js", ".py", ".go", ".java", ".rs"].includes(ext)) continue;
      const content = readFileSafe(filePath, 64 * 1024);
      if (!content) continue;
      for (const pat of routePatterns) {
        const matches = content.match(pat);
        if (matches) apiRouteCount += matches.length;
      }
      if (apiRouteCount > 50) break;
    }

    tests.push({
      id: "RT-010",
      name: "API Route Detection",
      description: "Static analysis of API route definitions in source code.",
      category: "API",
      status: apiRouteCount > 0 ? "PASS" : "FAIL",
      durationMs: Date.now() - t0,
      stdout: apiRouteCount > 0
        ? `Detected approximately ${apiRouteCount} API route definition(s) in source code.`
        : "No API route definitions detected. This may be a frontend-only or library project.",
      metadata: { apiRouteCount },
    });

    // ── Compute score and summary ─────────────────────────────────────────────
    const passedTests = tests.filter((t) => t.status === "PASS").length;
    const failedTests = tests.filter((t) => t.status === "FAIL").length;
    const skippedTests = tests.filter((t) => t.status === "SKIPPED").length;
    const errorTests = tests.filter((t) => t.status === "ERROR").length;
    const scorableTests = tests.filter((t) => t.status !== "SKIPPED");
    const scoreRuntime = scorableTests.length > 0
      ? Math.round((passedTests / scorableTests.length) * 100)
      : 0;

    return {
      tests,
      scoreRuntime,
      totalTests: tests.length,
      passedTests,
      failedTests,
      skippedTests,
      errorTests,
      detectionsReport: {
        buildSystem,
        testFrameworks,
        hasTests: testFrameworks.length > 0 || hasTestDir,
        hasCiConfig,
        hasDockerfile: !!dockerfilePath,
        hasReadme: !!readmePath,
        entryPoints,
      },
    };
  }

  private static emptyReport(): RuntimeAnalysisReport {
    return {
      tests: [{
        id: "RT-000",
        name: "Repository Access",
        description: "Check repository directory is available for analysis.",
        category: "SYSTEM",
        status: "ERROR",
        durationMs: 0,
        errorMessage: "Repository directory not available. Run repository ingestion first.",
      }],
      scoreRuntime: 0,
      totalTests: 1,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      errorTests: 1,
      detectionsReport: {
        testFrameworks: [],
        hasTests: false,
        hasCiConfig: false,
        hasDockerfile: false,
        hasReadme: false,
        entryPoints: [],
      },
    };
  }

  /**
   * Backward-compatible wrapper used by existing re-evaluate endpoint.
   */
  public static async runRuntimeTests(
    submissionId: string,
    demoUrl?: string,
    repositoryUrl?: string,
    repoDir?: string
  ): Promise<{
    scoreRuntime: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageLatencyMs: number;
    testSuiteResults: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      durationMs: number;
      memoryUsageMb: number;
    }>;
  }> {
    if (repoDir && fs.existsSync(repoDir)) {
      const report = await this.runAnalysis(submissionId, repoDir, demoUrl);
      return {
        scoreRuntime: report.scoreRuntime,
        totalTests: report.totalTests,
        passedTests: report.passedTests,
        failedTests: report.failedTests,
        averageLatencyMs: 0,
        testSuiteResults: report.tests.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          status: t.status === "PASS" ? "PASSED" : t.status === "FAIL" ? "FAILED" : t.status,
          durationMs: t.durationMs,
          memoryUsageMb: 0,
        })),
      };
    }
    // No repo dir — return minimal result
    return {
      scoreRuntime: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      averageLatencyMs: 0,
      testSuiteResults: [],
    };
  }
}
