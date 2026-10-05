// ====================================================
// ForgeEval — Real SAST Security Analysis Engine
// Phase 2 — Part 5
//
// Scans cloned repository files statically.
// NEVER executes submitted code.
// NEVER installs submitted dependencies.
// Masks secrets in output (never exposes raw values).
// ====================================================

import fs from "node:fs";
import path from "node:path";

export interface SASTFinding {
  ruleId: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "SECURITY" | "ARCHITECTURE" | "CODE_QUALITY" | "TESTING" | "PERFORMANCE";
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  codeSnippet: string; // always masked if containing secrets
  evidence: string;
  description: string;
  recommendation: string;
  cwe?: string;
}

export interface DependencyFinding {
  name: string;
  version: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO" | "UNKNOWN";
  reason: string;
  advisoryId?: string;
}

export interface SecurityAnalysisResult {
  findings: SASTFinding[];
  dependencyFindings: DependencyFinding[];
  scoreSecurity: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  scannedFiles: number;
}

// ── Secret pattern rules ─────────────────────────────────────────────────────
const SECRET_PATTERNS: Array<{
  ruleId: string;
  title: string;
  pattern: RegExp;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe: string;
  recommendation: string;
}> = [
  {
    ruleId: "SEC-001",
    title: "Hardcoded JWT Secret",
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*['"`](?!process\.env)[^\s'"`,]{8,}/i,
    severity: "CRITICAL",
    cwe: "CWE-798",
    recommendation: "Store JWT secrets exclusively in environment variables. Never hardcode in source.",
  },
  {
    ruleId: "SEC-002",
    title: "Hardcoded API Key",
    pattern: /(?:api[_-]?key|apikey|api_token)\s*[:=]\s*['"`](?!process\.env)[a-zA-Z0-9_\-]{16,}/i,
    severity: "CRITICAL",
    cwe: "CWE-798",
    recommendation: "Rotate the key immediately and load from environment variables.",
  },
  {
    ruleId: "SEC-003",
    title: "Hardcoded Database Password",
    pattern: /(?:db[_-]?pass(?:word)?|database[_-]?password)\s*[:=]\s*['"`](?!process\.env)[^\s'"`,]{4,}/i,
    severity: "CRITICAL",
    cwe: "CWE-798",
    recommendation: "Use DATABASE_URL or separate environment variables for credentials.",
  },
  {
    ruleId: "SEC-004",
    title: "Hardcoded AWS/Cloud Credentials",
    pattern: /(?:aws[_-]?(?:access[_-]?key|secret[_-]?(?:access[_-]?)?key)|AKIA[0-9A-Z]{16})/i,
    severity: "CRITICAL",
    cwe: "CWE-798",
    recommendation: "Revoke credentials immediately. Use IAM roles or environment-based credentials.",
  },
  {
    ruleId: "SEC-005",
    title: "Hardcoded Private Key Block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: "CRITICAL",
    cwe: "CWE-321",
    recommendation: "Remove private keys from source code entirely. Use secure key management.",
  },
  {
    ruleId: "SEC-006",
    title: "Hardcoded Password Assignment",
    pattern: /password\s*[:=]\s*['"`](?!process\.env|\$\{)[^\s'"`,]{4,}/i,
    severity: "HIGH",
    cwe: "CWE-259",
    recommendation: "Load passwords from environment variables. Avoid default passwords in source.",
  },
  {
    ruleId: "SEC-007",
    title: "Hardcoded Bearer Token",
    pattern: /(?:token|bearer|authorization)\s*[:=]\s*['"`](?:Bearer\s+)?[a-zA-Z0-9_\-.]{20,}/i,
    severity: "HIGH",
    cwe: "CWE-798",
    recommendation: "Tokens should never appear in source code. Load from env or secure vault.",
  },
];

// ── Injection / code risk patterns ───────────────────────────────────────────
const INJECTION_PATTERNS: Array<{
  ruleId: string;
  title: string;
  pattern: RegExp;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  cwe: string;
  recommendation: string;
  extensions: string[];
}> = [
  {
    ruleId: "INJ-001",
    title: "SQL Injection Risk — Raw Query with String Interpolation",
    pattern: /(?:query|execute|raw)\s*\(\s*[`'"].*?\$\{.*?\}/,
    severity: "HIGH",
    cwe: "CWE-89",
    recommendation: "Use parameterized queries or ORM query builders instead of string interpolation.",
    extensions: [".ts", ".js", ".py", ".php", ".java", ".rb"],
  },
  {
    ruleId: "INJ-002",
    title: "Command Injection Risk — exec with User Input",
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*[`'"].*?\$\{/,
    severity: "CRITICAL",
    cwe: "CWE-78",
    recommendation: "Use execFile with argument arrays instead of template-interpolated exec calls.",
    extensions: [".ts", ".js", ".py"],
  },
  {
    ruleId: "INJ-003",
    title: "Path Traversal Risk — Unsanitized File Path",
    pattern: /(?:readFile|writeFile|createReadStream|createWriteStream|readFileSync)\s*\([^)]*\+[^)]*(?:req\.|param|query)/,
    severity: "HIGH",
    cwe: "CWE-22",
    recommendation: "Sanitize and validate file paths. Use path.resolve and check against allowed directories.",
    extensions: [".ts", ".js", ".py", ".php"],
  },
  {
    ruleId: "INJ-004",
    title: "Prototype Pollution Risk",
    pattern: /\.__proto__\s*=|Object\.assign\s*\(\s*\{\s*\}\s*,.*req\.(?:body|query|params)/,
    severity: "HIGH",
    cwe: "CWE-1321",
    recommendation: "Validate and sanitize user input before object assignment. Freeze prototypes.",
    extensions: [".ts", ".js"],
  },
  {
    ruleId: "INJ-005",
    title: "XSS Risk — Dangerous innerHTML Assignment",
    pattern: /\.innerHTML\s*=(?!=)/,
    severity: "MEDIUM",
    cwe: "CWE-79",
    recommendation: "Use textContent or DOMPurify sanitization instead of innerHTML with dynamic content.",
    extensions: [".ts", ".tsx", ".js", ".jsx", ".html"],
  },
  {
    ruleId: "INJ-006",
    title: "Deserialization Risk",
    pattern: /(?:deserialize|unserialize|pickle\.loads|yaml\.load\b(?!\s*,\s*Loader\s*=))/,
    severity: "HIGH",
    cwe: "CWE-502",
    recommendation: "Use safe deserialization alternatives. For YAML, use yaml.safe_load.",
    extensions: [".ts", ".js", ".py", ".rb", ".php"],
  },
];

// ── Auth/access patterns ─────────────────────────────────────────────────────
const AUTH_PATTERNS: Array<{
  ruleId: string;
  title: string;
  pattern: RegExp;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe: string;
  recommendation: string;
}> = [
  {
    ruleId: "AUTH-001",
    title: "Wildcard CORS Configuration",
    pattern: /(?:origin\s*[:=]\s*['"`]\*['"`]|Access-Control-Allow-Origin['"`: ]*\*)/,
    severity: "HIGH",
    cwe: "CWE-346",
    recommendation: "Restrict CORS origins to specific trusted domains. Never use wildcard with credentials.",
  },
  {
    ruleId: "AUTH-002",
    title: "JWT Verification Disabled",
    pattern: /verify\s*:\s*false|algorithms\s*:\s*\[\s*['"`]none['"`]\s*\]/i,
    severity: "CRITICAL",
    cwe: "CWE-347",
    recommendation: "Never disable JWT signature verification. Always specify allowed algorithms explicitly.",
  },
  {
    ruleId: "AUTH-003",
    title: "Insecure Cookie — Missing Secure/HttpOnly Flags",
    pattern: /(?:cookie|setCookie|res\.cookie)\b[^;{]*(?:\{[^}]*\})?(?!\s*(?:.*(?:httpOnly|secure)\s*:\s*true))/,
    severity: "MEDIUM",
    cwe: "CWE-614",
    recommendation: "Set httpOnly: true and secure: true flags on all session/auth cookies.",
  },
  {
    ruleId: "AUTH-004",
    title: "Weak Hashing Algorithm",
    pattern: /(?:md5|sha1)\s*\(|createHash\s*\(\s*['"`](?:md5|sha1)['"`]\)/i,
    severity: "HIGH",
    cwe: "CWE-327",
    recommendation: "Use SHA-256 or better for general hashing. Use bcrypt/argon2 for passwords.",
  },
  {
    ruleId: "AUTH-005",
    title: "Hardcoded Admin/Debug Route",
    pattern: /(?:router|app)\.[a-z]+\s*\(\s*['"`]\/(?:admin|debug|console|backdoor|shell)\b/i,
    severity: "MEDIUM",
    cwe: "CWE-489",
    recommendation: "Remove debug/admin routes from production builds or protect with proper authentication.",
  },
];

// ── Dependency vulnerability database (known packages with CVEs) ─────────────
const KNOWN_VULNERABLE_PACKAGES: Record<string, { below: string; severity: "HIGH" | "MEDIUM"; advisory: string; reason: string }[]> = {
  "lodash":           [{ below: "4.17.21", severity: "HIGH",   advisory: "GHSA-35jh-r3h4-6jhm", reason: "Prototype pollution (CVE-2021-23337)" }],
  "axios":            [{ below: "0.21.2",  severity: "HIGH",   advisory: "GHSA-cph5-m8f7-6c5x", reason: "SSRF vulnerability (CVE-2021-3749)" }],
  "express":          [{ below: "4.17.3",  severity: "MEDIUM", advisory: "GHSA-rv95-896h-c2vc", reason: "Open redirect (CVE-2022-24999)" }],
  "jsonwebtoken":     [{ below: "9.0.0",   severity: "HIGH",   advisory: "GHSA-hjrf-2m68-5959", reason: "Verification bypass vulnerability" }],
  "node-fetch":       [{ below: "2.6.7",   severity: "HIGH",   advisory: "GHSA-r683-j2x4-v87g", reason: "Exposure of sensitive information (CVE-2022-0235)" }],
  "minimist":         [{ below: "1.2.6",   severity: "HIGH",   advisory: "GHSA-xvch-5gv4-984h", reason: "Prototype pollution (CVE-2021-44906)" }],
  "tar":              [{ below: "6.1.9",   severity: "HIGH",   advisory: "GHSA-r628-mhmh-qjhw", reason: "Path traversal (CVE-2021-37701)" }],
  "multer":           [{ below: "1.4.4",   severity: "MEDIUM", advisory: "GHSA-j6f8-3566-49p7", reason: "Denial of service via crafted upload" }],
  "serialize-javascript": [{ below: "6.0.0", severity: "HIGH", advisory: "GHSA-gx3h-v7kw-jg7f", reason: "XSS via serialized code injection" }],
};

// ── File extension sets ───────────────────────────────────────────────────────
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".php", ".java", ".go", ".rs",
  ".cs", ".cpp", ".c", ".h",
]);

const CONFIG_EXTENSIONS = new Set([
  ".json", ".yaml", ".yml", ".env", ".toml", ".ini", ".cfg",
]);

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", ".next",
  "vendor", ".venv", "venv", "__pycache__", "target", ".gradle",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskSecret(line: string): string {
  // Mask anything that looks like a credential value
  return line.replace(
    /([:=]\s*['"`]?)([a-zA-Z0-9+/=_\-]{8,})/g,
    (_, prefix, secret) => `${prefix}${"*".repeat(Math.min(secret.length, 12))}`
  );
}

function versionLessThan(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/[^0-9.]/g, "").split(".").map(Number);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return false;
}

function* walkFiles(dir: string): Generator<string> {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkFiles(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  } catch {
    // skip unreadable directories
  }
}

function readFileSafe(filePath: string, maxBytes = 512 * 1024): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

// ── Main engine ───────────────────────────────────────────────────────────────
export class SecurityService {
  /**
   * Perform real static analysis on a cloned repository directory.
   * Safe — never executes submitted code, never installs submitted packages.
   */
  public static async analyzeDirectory(
    repoDir: string,
    submissionId: string
  ): Promise<SecurityAnalysisResult> {
    const findings: SASTFinding[] = [];
    const dependencyFindings: DependencyFinding[] = [];
    let scannedFiles = 0;

    if (!fs.existsSync(repoDir)) {
      return this.emptyResult();
    }

    // ── Scan all files ───────────────────────────────────────────────────────
    for (const filePath of walkFiles(repoDir)) {
      const ext = path.extname(filePath).toLowerCase();
      const isCode = CODE_EXTENSIONS.has(ext);
      const isConfig = CONFIG_EXTENSIONS.has(ext);
      if (!isCode && !isConfig) continue;

      const content = readFileSafe(filePath);
      if (!content) continue;

      scannedFiles++;
      const relPath = path.relative(repoDir, filePath);
      const lines = content.split("\n");

      // ── Secret detection (applies to all file types) ─────────────────────
      for (const rule of SECRET_PATTERNS) {
        lines.forEach((line, idx) => {
          if (rule.pattern.test(line)) {
            const masked = maskSecret(line.trim());
            findings.push({
              ruleId: rule.ruleId,
              title: rule.title,
              severity: rule.severity,
              category: "SECURITY",
              filePath: relPath,
              lineNumber: idx + 1,
              codeSnippet: masked,
              evidence: `Pattern matched at ${relPath}:${idx + 1}`,
              description: `Potential hardcoded credential detected at line ${idx + 1}. The value has been masked for security.`,
              recommendation: rule.recommendation,
              cwe: rule.cwe,
            });
          }
        });
      }

      // ── Injection patterns (code files only) ─────────────────────────────
      if (isCode) {
        for (const rule of INJECTION_PATTERNS) {
          if (rule.extensions.includes(ext)) {
            lines.forEach((line, idx) => {
              if (rule.pattern.test(line)) {
                findings.push({
                  ruleId: rule.ruleId,
                  title: rule.title,
                  severity: rule.severity,
                  category: "SECURITY",
                  filePath: relPath,
                  lineNumber: idx + 1,
                  codeSnippet: line.trim().substring(0, 150),
                  evidence: `Unsafe pattern at ${relPath}:${idx + 1}`,
                  description: `Potentially unsafe code pattern detected. Line: "${line.trim().substring(0, 100)}"`,
                  recommendation: rule.recommendation,
                  cwe: rule.cwe,
                });
              }
            });
          }
        }

        // ── Auth/access patterns ──────────────────────────────────────────
        for (const rule of AUTH_PATTERNS) {
          lines.forEach((line, idx) => {
            if (rule.pattern.test(line)) {
              findings.push({
                ruleId: rule.ruleId,
                title: rule.title,
                severity: rule.severity,
                category: "SECURITY",
                filePath: relPath,
                lineNumber: idx + 1,
                codeSnippet: line.trim().substring(0, 150),
                evidence: `Configuration issue at ${relPath}:${idx + 1}`,
                description: `Security misconfiguration detected. Review the highlighted configuration.`,
                recommendation: rule.recommendation,
                cwe: rule.cwe,
              });
            }
          });
        }
      }

      // ── Dependency scanning (package.json, requirements.txt, etc.) ───────
      if (path.basename(filePath) === "package.json" && !filePath.includes("node_modules")) {
        try {
          const pkgJson = JSON.parse(content);
          const allDeps = {
            ...(pkgJson.dependencies || {}),
            ...(pkgJson.devDependencies || {}),
          };
          for (const [name, rawVersion] of Object.entries(allDeps)) {
            const version = String(rawVersion).replace(/[^0-9.]/g, "");
            const vuln = KNOWN_VULNERABLE_PACKAGES[name];
            if (vuln) {
              for (const v of vuln) {
                if (version && versionLessThan(version, v.below)) {
                  dependencyFindings.push({
                    name,
                    version: String(rawVersion),
                    severity: v.severity,
                    reason: v.reason,
                    advisoryId: v.advisory,
                  });
                }
              }
            }
          }
        } catch {
          // unparseable package.json — skip
        }
      }

      // ── Python requirements.txt scanning ─────────────────────────────────
      if (path.basename(filePath) === "requirements.txt") {
        lines.forEach((line) => {
          const match = line.match(/^([a-zA-Z0-9_-]+)(?:[=<>!]+)?([\d.]+)?/);
          if (match) {
            const name = match[1].toLowerCase();
            const version = match[2] || "";
            // Minimal Python vuln check
            if (name === "pyyaml" && version && versionLessThan(version, "5.4")) {
              dependencyFindings.push({
                name,
                version: line.trim(),
                severity: "HIGH",
                reason: "Arbitrary code execution via unsafe YAML load (CVE-2020-14343)",
                advisoryId: "CVE-2020-14343",
              });
            }
            if (name === "pillow" && version && versionLessThan(version, "9.0.0")) {
              dependencyFindings.push({
                name,
                version: line.trim(),
                severity: "HIGH",
                reason: "Multiple vulnerabilities in old Pillow versions",
                advisoryId: "GHSA-77gc-v2xv-rvvh",
              });
            }
          }
        });
      }

      // ── .env file checks ──────────────────────────────────────────────────
      if (path.basename(filePath) === ".env" && !filePath.includes(".example")) {
        findings.push({
          ruleId: "SEC-ENV-001",
          title: ".env File Committed to Repository",
          severity: "HIGH",
          category: "SECURITY",
          filePath: relPath,
          codeSnippet: "[masked — .env file detected]",
          evidence: `.env file found committed at ${relPath}`,
          description: "A .env file was found committed in the repository. This can expose secrets to anyone who accesses the repository.",
          recommendation: "Add .env to .gitignore and remove from repository history. Use .env.example for templates.",
          cwe: "CWE-312",
        });
      }
    }

    // ── Deduplicate findings (same rule + file + line) ────────────────────
    const seen = new Set<string>();
    const deduped = findings.filter((f) => {
      const key = `${f.ruleId}:${f.filePath}:${f.lineNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Score calculation ─────────────────────────────────────────────────
    const criticalCount = deduped.filter((f) => f.severity === "CRITICAL").length;
    const highCount = deduped.filter((f) => f.severity === "HIGH").length;
    const mediumCount = deduped.filter((f) => f.severity === "MEDIUM").length;
    const lowCount = deduped.filter((f) => f.severity === "LOW").length;
    const infoCount = deduped.filter((f) => f.severity === "INFO").length;

    const depHighCount = dependencyFindings.filter((d) => d.severity === "HIGH").length;
    const depMedCount = dependencyFindings.filter((d) => d.severity === "MEDIUM").length;

    const penalty =
      criticalCount * 30 + highCount * 15 + mediumCount * 7 + lowCount * 2 +
      depHighCount * 10 + depMedCount * 4;
    const scoreSecurity = Math.max(10, 100 - penalty);

    return {
      findings: deduped,
      dependencyFindings,
      scoreSecurity,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      scannedFiles,
    };
  }

  /**
   * Fallback for submissions without a cloned directory.
   * Returns empty result rather than fabricating findings.
   */
  private static emptyResult(): SecurityAnalysisResult {
    return {
      findings: [],
      dependencyFindings: [],
      scoreSecurity: 100,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      scannedFiles: 0,
    };
  }

  /**
   * Backward-compatible wrapper: still accepts submissionId + repositoryUrl
   * but now reads repoDir from metadata. Used by existing re-evaluate endpoint.
   */
  public static async analyzeSubmission(
    submissionId: string,
    _repositoryUrl?: string,
    repoDir?: string
  ): Promise<{
    scoreSecurity: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    findings: Array<{
      title: string;
      severity: string;
      category: string;
      location: string;
      description: string;
      recommendation: string;
      status: "OPEN";
    }>;
  }> {
    if (repoDir && fs.existsSync(repoDir)) {
      const result = await this.analyzeDirectory(repoDir, submissionId);
      return {
        scoreSecurity: result.scoreSecurity,
        criticalCount: result.criticalCount,
        highCount: result.highCount,
        mediumCount: result.mediumCount,
        lowCount: result.lowCount,
        findings: result.findings.map((f) => ({
          title: f.title,
          severity: f.severity,
          category: f.category,
          location: f.filePath + (f.lineNumber ? `:${f.lineNumber}` : ""),
          description: f.description,
          recommendation: f.recommendation,
          status: "OPEN" as const,
        })),
      };
    }
    // No repo directory — return empty
    return {
      scoreSecurity: 85,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      findings: [],
    };
  }
}
