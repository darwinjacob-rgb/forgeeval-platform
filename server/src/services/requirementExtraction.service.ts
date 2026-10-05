// ====================================================
// Requirement Extraction Service — Phase 1
// Extracts structured requirements from a problem statement text.
// Uses deterministic NLP-like heuristics as the primary approach.
// Falls back gracefully if AI is not configured.
// ====================================================

export interface ExtractedRequirement {
  code: string;
  title: string;
  description: string;
  category:
    | "FUNCTIONAL"
    | "TECHNICAL"
    | "SECURITY"
    | "PERFORMANCE"
    | "UI_UX"
    | "DOCUMENTATION"
    | "INNOVATION";
  priority: "HIGH" | "MEDIUM" | "LOW";
  keywords: string[];
  acceptanceCriteria: string[];
  weight: number;
}

// ── Category keyword maps ─────────────────────────────
const CATEGORY_SIGNALS: Record<string, string[]> = {
  FUNCTIONAL: [
    "user", "register", "login", "authenticate", "browse", "search", "filter",
    "create", "update", "delete", "edit", "submit", "upload", "download",
    "order", "cart", "checkout", "payment", "book", "schedule", "manage",
    "notify", "alert", "track", "dashboard", "report", "export", "import",
    "send", "receive", "chat", "message", "post", "comment", "like", "share",
    "follow", "profile", "settings", "view", "list", "display", "show",
  ],
  TECHNICAL: [
    "api", "rest", "graphql", "websocket", "microservice", "docker", "kubernetes",
    "react", "vue", "angular", "node", "express", "fastapi", "django", "spring",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "kafka",
    "typescript", "python", "java", "rust", "go", "c++", "framework",
    "architecture", "database", "orm", "migration", "deploy", "ci/cd",
    "integration", "library", "sdk", "backend", "frontend",
  ],
  SECURITY: [
    "auth", "jwt", "oauth", "permission", "role", "rbac", "encrypt",
    "ssl", "tls", "https", "csrf", "xss", "injection", "secure", "hash",
    "token", "session", "firewall", "audit", "log", "sanitize", "validate",
    "vulnerability", "threat", "secret", "password", "two-factor", "2fa",
  ],
  PERFORMANCE: [
    "latency", "throughput", "concurren", "scalab", "load", "cache",
    "performance", "optimize", "fast", "p99", "p95", "sla", "timeout",
    "memory", "cpu", "bandwidth", "rate limit", "queue", "batch", "parallel",
    "response time", "millisecond", "benchmark", "stress", "capacity",
  ],
  UI_UX: [
    "ui", "ux", "interface", "responsive", "mobile", "dark mode", "theme",
    "design", "layout", "navigation", "accessibility", "animation", "modal",
    "component", "form", "button", "table", "chart", "graph", "dashboard ui",
    "widget", "tooltip", "feedback", "loading", "skeleton", "toast", "a11y",
  ],
  DOCUMENTATION: [
    "document", "readme", "api doc", "swagger", "openapi", "comment",
    "guide", "tutorial", "example", "schema", "specification", "adr",
    "changelog", "test coverage", "wiki", "manual", "explanation",
  ],
  INNOVATION: [
    "ai", "machine learning", "ml", "deep learning", "llm", "gpt", "neural",
    "blockchain", "smart contract", "nft", "web3", "ar", "vr", "novel",
    "innovative", "unique", "creative", "advanced", "intelligent", "automate",
    "predict", "recommend", "personalize", "agent", "rag",
  ],
};

const PRIORITY_SIGNALS = {
  HIGH: ["must", "required", "mandatory", "critical", "essential", "core", "primary", "register", "login", "payment", "order", "main"],
  LOW: ["optional", "nice to have", "future", "bonus", "extra", "enhancement", "consider", "may", "might", "could"],
};

// ── Tokenise statement into candidate sentences ───────
function splitSentences(text: string): string[] {
  return text
    .split(/[.;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

// ── Detect category from text ─────────────────────────
function detectCategory(text: string): ExtractedRequirement["category"] {
  const lower = text.toLowerCase();
  let bestCat: ExtractedRequirement["category"] = "FUNCTIONAL";
  let bestScore = 0;

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS)) {
    const score = signals.filter((s) => lower.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat as ExtractedRequirement["category"];
    }
  }
  return bestCat;
}

// ── Detect priority from text ─────────────────────────
function detectPriority(text: string): ExtractedRequirement["priority"] {
  const lower = text.toLowerCase();
  if (PRIORITY_SIGNALS.LOW.some((s) => lower.includes(s))) return "LOW";
  if (PRIORITY_SIGNALS.HIGH.some((s) => lower.includes(s))) return "HIGH";
  return "MEDIUM";
}

// ── Extract key nouns as keywords ─────────────────────
function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "that", "which", "is", "are", "was", "were",
    "be", "been", "have", "has", "do", "does", "will", "would", "could",
    "should", "must", "may", "might", "can", "this", "it", "its",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w))
    .slice(0, 5);
}

// ── Generate acceptance criteria from requirement ─────
function generateAcceptanceCriteria(
  title: string,
  category: ExtractedRequirement["category"]
): string[] {
  const base = `Given ${title.toLowerCase()} is implemented`;
  const map: Record<string, string[]> = {
    FUNCTIONAL: [
      `${base}, the expected behavior executes without errors`,
      `All input validation passes and edge cases are handled`,
    ],
    TECHNICAL: [
      `${base}, the technical stack meets the specified requirements`,
      `The component integrates correctly with the overall system`,
    ],
    SECURITY: [
      `${base}, unauthorized access is rejected with appropriate error`,
      `Input is sanitized and no sensitive data is leaked`,
    ],
    PERFORMANCE: [
      `${base}, response time is within the specified threshold`,
      `The system handles the required concurrent load without degradation`,
    ],
    UI_UX: [
      `${base}, the interface renders correctly across target viewports`,
      `User interactions produce immediate, intuitive feedback`,
    ],
    DOCUMENTATION: [
      `${base}, documentation is accurate, complete, and up to date`,
      `Code examples are runnable and produce the documented output`,
    ],
    INNOVATION: [
      `${base}, it provides measurable benefit over baseline approach`,
      `The novel component is demonstrable in the submitted project`,
    ],
  };
  return map[category] ?? map["FUNCTIONAL"];
}

// ── Code prefix per category ──────────────────────────
const CODE_PREFIX: Record<string, string> = {
  FUNCTIONAL: "F",
  TECHNICAL: "T",
  SECURITY: "S",
  PERFORMANCE: "P",
  UI_UX: "U",
  DOCUMENTATION: "D",
  INNOVATION: "I",
};

// ── De-duplicate and merge similar requirements ───────
function deduplicateRequirements(
  reqs: ExtractedRequirement[]
): ExtractedRequirement[] {
  const seen = new Set<string>();
  return reqs.filter((r) => {
    const key = r.title.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main extractor ────────────────────────────────────
export class RequirementExtractionService {
  /**
   * Extract structured requirements from a raw problem statement.
   * Deterministic — works without an AI API key.
   */
  static extract(
    title: string,
    rawStatement: string
  ): ExtractedRequirement[] {
    const sentences = splitSentences(rawStatement);
    const counters: Record<string, number> = {};
    const raw: ExtractedRequirement[] = [];

    for (const sentence of sentences) {
      const category = detectCategory(sentence);
      const priority = detectPriority(sentence);

      // Build human-readable title from sentence (capitalize, truncate)
      const reqTitle = sentence
        .replace(/^(build|create|implement|develop|ensure|allow|enable|provide|the system (should|must|shall)|users (can|should|must))/i, "")
        .trim()
        .replace(/^./, (c) => c.toUpperCase())
        .substring(0, 80);

      if (!reqTitle || reqTitle.length < 5) continue;

      counters[category] = (counters[category] || 0) + 1;
      const prefix = CODE_PREFIX[category] || "F";
      const code = `${prefix}-${String(counters[category]).padStart(2, "0")}`;

      raw.push({
        code,
        title: reqTitle,
        description: sentence.trim(),
        category,
        priority,
        keywords: extractKeywords(sentence),
        acceptanceCriteria: generateAcceptanceCriteria(reqTitle, category),
        weight:
          priority === "HIGH" ? 2.0 : priority === "MEDIUM" ? 1.0 : 0.5,
      });
    }

    // Ensure at least 1 requirement per broad category if statement is short
    if (raw.length < 3) {
      raw.push(
        {
          code: "F-01",
          title: `Core Functionality — ${title}`,
          description: `The system implements the core functional requirements described in: ${rawStatement.substring(0, 200)}`,
          category: "FUNCTIONAL",
          priority: "HIGH",
          keywords: extractKeywords(title + " " + rawStatement),
          acceptanceCriteria: generateAcceptanceCriteria("core functionality", "FUNCTIONAL"),
          weight: 2.0,
        },
        {
          code: "T-01",
          title: `Technical Stack & Architecture`,
          description: `The system uses appropriate technologies and architecture for the described problem.`,
          category: "TECHNICAL",
          priority: "MEDIUM",
          keywords: ["architecture", "stack", "technology", "implementation"],
          acceptanceCriteria: generateAcceptanceCriteria("technical stack", "TECHNICAL"),
          weight: 1.0,
        }
      );
    }

    return deduplicateRequirements(raw);
  }
}
