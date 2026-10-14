/**
 * ForgeEval — Prisma Seed Script (Idempotent)
 *
 * Safe to run multiple times — uses upsert / find-or-create on every model.
 * NEVER deletes or resets existing database data.
 *
 * Run from the `server` directory:
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Starting ForgeEval idempotent seed...");

  // ── 1. Users (upsert on unique email) ─────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@forgeeval.com" },
    update: {},
    create: {
      email: "admin@forgeeval.com",
      passwordHash,
      name: "Dr. Sarah Jenkins",
      role: "ADMIN",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    },
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@forgeeval.com" },
    update: {},
    create: {
      email: "organizer@forgeeval.com",
      passwordHash,
      name: "Morgan Stone",
      role: "ORGANIZER",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
    },
  });

  const judge = await prisma.user.upsert({
    where: { email: "judge@forgeeval.com" },
    update: {},
    create: {
      email: "judge@forgeeval.com",
      passwordHash,
      name: "Alex Vance",
      role: "JUDGE",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
  });

  const participant1 = await prisma.user.upsert({
    where: { email: "dev@forgeeval.com" },
    update: {},
    create: {
      email: "dev@forgeeval.com",
      passwordHash,
      name: "Elena Rostova",
      role: "PARTICIPANT",
      phone: "+1-555-0192",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
  });

  const participant2 = await prisma.user.upsert({
    where: { email: "participant2@forgeeval.com" },
    update: {},
    create: {
      email: "participant2@forgeeval.com",
      passwordHash,
      name: "Marcus Chen",
      role: "PARTICIPANT",
      phone: "+1-555-0144",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    },
  });

  console.log("  ✓ Users upserted (1 Admin, 1 Organizer, 1 Judge, 2 Participants)");

  // ── 2. Hackathon (find-or-create — no @unique on name) ────────────────────
  const HACKATHON_NAME = "Global AI Agents & Infrastructure Summit 2026";

  let hackathon1 = await prisma.hackathon.findFirst({
    where: { name: HACKATHON_NAME },
  });

  if (!hackathon1) {
    const now = new Date();
    hackathon1 = await prisma.hackathon.create({
      data: {
        name: HACKATHON_NAME,
        theme: "Autonomous Agents & High-Throughput Distributed Compute",
        description:
          "Build state-of-the-art verifiable intelligence architectures and low-latency streaming inference pipelines.",
        rules:
          "Submissions must be original work with an active GitHub repository, automated tests, and clear README.",
        eligibility: "Open to developers and engineering teams worldwide.",
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        submissionDeadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });
    console.log(`  ✓ Hackathon created (id: ${hackathon1.id})`);
  } else {
    console.log(`  ✓ Hackathon already exists — skipping create (id: ${hackathon1.id})`);
  }

  // ── 3. HackathonParticipants (upsert on @@unique([hackathonId, userId])) ──
  await prisma.hackathonParticipant.upsert({
    where: { hackathonId_userId: { hackathonId: hackathon1.id, userId: participant1.id } },
    update: {},
    create: { hackathonId: hackathon1.id, userId: participant1.id },
  });

  await prisma.hackathonParticipant.upsert({
    where: { hackathonId_userId: { hackathonId: hackathon1.id, userId: participant2.id } },
    update: {},
    create: { hackathonId: hackathon1.id, userId: participant2.id },
  });

  // ── 4. Problems (upsert on @unique code) ──────────────────────────────────
  const problem1 = await prisma.problem.upsert({
    where: { code: "PROB-01" },
    update: {},
    create: {
      code: "PROB-01",
      title: "Real-Time AI Fraud Detection Pipeline",
      description:
        "Build a zero-trust stream processing pipeline that ingests transaction logs and detects fraudulent patterns under 50ms latency using hybrid ML inference models.",
      category: "FinTech",
      difficulty: "HARD",
      status: "ACTIVE",
      functionalRequirements: ["Sub-50ms transaction latency", "Kafka stream ingest", "Dynamic scoring engine"],
      technicalRequirements: ["TypeScript / Rust / Python core", "Automated unit and integration test coverage > 80%"],
      securityRequirements: ["Zero-trust payload encryption", "Strict CORS and secret management"],
      performanceRequirements: ["5,000 TPS sustained throughput under benchmark load"],
      uiUxRequirements: ["Responsive status monitoring dashboard with micro-second latency display"],
      docRequirements: ["Comprehensive architecture README, API specs, and deployment guide"],
    },
  });

  const problem2 = await prisma.problem.upsert({
    where: { code: "PROB-02" },
    update: {},
    create: {
      code: "PROB-02",
      title: "Decentralized Autonomous Evaluation Engine",
      description:
        "Design a verifiable evaluation smart contract system and zero-knowledge proof verification protocol for automated hackathon scoring.",
      category: "Web3 Infrastructure",
      difficulty: "HARD",
      status: "ACTIVE",
      functionalRequirements: ["ZK-proof verification for rubric items", "Gas-optimized smart contract"],
      securityRequirements: ["Formal verification report", "Anti-sybil identity binding"],
    },
  });

  console.log("  ✓ Problems upserted (PROB-01, PROB-02)");

  // ── 5. HackathonProblem links (upsert on @@unique([hackathonId, problemId])) ─
  await prisma.hackathonProblem.upsert({
    where: { hackathonId_problemId: { hackathonId: hackathon1.id, problemId: problem1.id } },
    update: {},
    create: { hackathonId: hackathon1.id, problemId: problem1.id },
  });

  await prisma.hackathonProblem.upsert({
    where: { hackathonId_problemId: { hackathonId: hackathon1.id, problemId: problem2.id } },
    update: {},
    create: { hackathonId: hackathon1.id, problemId: problem2.id },
  });

  console.log("  ✓ Problems linked to hackathon");

  // ── 6. Teams (find-or-create on @unique inviteCode) ───────────────────────
  let team1 = await prisma.team.findUnique({ where: { inviteCode: "FORGE-7X92" } });
  if (!team1) {
    team1 = await prisma.team.create({
      data: {
        name: "CyberPulse",
        inviteCode: "FORGE-7X92",
        hackathonId: hackathon1.id,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });
  }

  let team2 = await prisma.team.findUnique({ where: { inviteCode: "FORGE-8K31" } });
  if (!team2) {
    team2 = await prisma.team.create({
      data: {
        name: "NeuralSquad",
        inviteCode: "FORGE-8K31",
        hackathonId: hackathon1.id,
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      },
    });
  }

  // ── 7. TeamMembers (upsert on @@unique([teamId, userId])) ─────────────────
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team1.id, userId: participant1.id } },
    update: {},
    create: { teamId: team1.id, userId: participant1.id, role: "CAPTAIN" },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team2.id, userId: participant2.id } },
    update: {},
    create: { teamId: team2.id, userId: participant2.id, role: "CAPTAIN" },
  });

  console.log("  ✓ Teams upserted with members (FORGE-7X92, FORGE-8K31)");

  // ── 8. Submissions (find-or-create on teamId + problemId) ─────────────────
  let sub1 = await prisma.submission.findFirst({
    where: { teamId: team1.id, problemId: problem1.id },
  });
  if (!sub1) {
    sub1 = await prisma.submission.create({
      data: {
        teamId: team1.id,
        problemId: problem1.id,
        projectName: "AegisShield",
        projectDescription:
          "High-throughput real-time zero-trust anomaly detection with Rust and eBPF instrumentation.",
        repositoryUrl: "https://github.com/forgeeval/aegisshield-core",
        branch: "main",
        demoUrl: "https://aegisshield.demo.forgeeval.dev",
        docUrl: "https://docs.aegisshield.dev",
        language: "TypeScript / Rust",
        status: "ANALYZED",
        overallScore: 94,
        scoreCodeQuality: 92,
        scoreSecurity: 91,
        scoreTesting: 95,
        scoreRequirement: 96,
        scoreDocumentation: 90,
        scoreUiUx: 94,
        isReleased: true,
      },
    });
    console.log(`  ✓ Submission 'AegisShield' created (id: ${sub1.id})`);
  } else {
    console.log(`  ✓ Submission 'AegisShield' already exists — skipping`);
  }

  let sub2 = await prisma.submission.findFirst({
    where: { teamId: team2.id, problemId: problem1.id },
  });
  if (!sub2) {
    sub2 = await prisma.submission.create({
      data: {
        teamId: team2.id,
        problemId: problem1.id,
        projectName: "SentinAI",
        projectDescription: "Distributed streaming anomaly scanner with secure enclave execution.",
        repositoryUrl: "https://github.com/forgeeval/sentin-ai",
        branch: "main",
        demoUrl: "https://sentinai.demo.forgeeval.dev",
        language: "Python / Go",
        status: "ANALYZED",
        overallScore: 88,
        scoreCodeQuality: 87,
        scoreSecurity: 84,
        scoreTesting: 91,
        scoreRequirement: 90,
        scoreDocumentation: 85,
        scoreUiUx: 88,
        isReleased: false,
      },
    });
    console.log(`  ✓ Submission 'SentinAI' created (id: ${sub2.id})`);
  } else {
    console.log(`  ✓ Submission 'SentinAI' already exists — skipping`);
  }

  // ── 9. SecurityFinding (find-or-create on submissionId + title) ───────────
  const existingFinding = await prisma.securityFinding.findFirst({
    where: { submissionId: sub1.id, title: "Permissive CORS Wildcard configuration" },
  });
  if (!existingFinding) {
    await prisma.securityFinding.create({
      data: {
        submissionId: sub1.id,
        title: "Permissive CORS Wildcard configuration",
        severity: "LOW",
        category: "SECURITY",
        filePath: "src/server.ts",
        lineNumber: 42,
        description: "Access-Control-Allow-Origin header is set to '*'.",
        recommendation: "Restrict CORS origins strictly to client application domains.",
        status: "OPEN",
      },
    });
  }

  // ── 10. RuntimeTest (find-or-create on submissionId + name) ───────────────
  const existingTest = await prisma.runtimeTest.findFirst({
    where: { submissionId: sub1.id, name: "Transaction Log Parsing Benchmark" },
  });
  if (!existingTest) {
    await prisma.runtimeTest.create({
      data: {
        submissionId: sub1.id,
        name: "Transaction Log Parsing Benchmark",
        description: "Verifies processing latency under 50ms",
        status: "PASSED",
        duration: 38,
      },
    });
  }

  // ── 11. JudgeScore (upsert on @@unique([userId, submissionId, dimension])) ─
  await prisma.judgeScore.upsert({
    where: {
      userId_submissionId_dimension: {
        userId: judge.id,
        submissionId: sub1.id,
        dimension: "TECHNICAL",
      },
    },
    update: {},
    create: {
      submissionId: sub1.id,
      userId: judge.id,
      dimension: "TECHNICAL",
      score: 94,
      comment: "Outstanding project execution! Highly scalable Rust pipeline.",
    },
  });

  console.log("  ✓ Security finding, runtime test, and judge score upserted");
  console.log("");
  console.log("🎉  Seed complete — no existing data was deleted or overwritten.");
  console.log("    Demo credentials (password: password123):");
  console.log("      admin@forgeeval.com       → ADMIN");
  console.log("      organizer@forgeeval.com   → ORGANIZER");
  console.log("      judge@forgeeval.com       → JUDGE");
  console.log("      dev@forgeeval.com         → PARTICIPANT (Elena Rostova)");
  console.log("      participant2@forgeeval.com → PARTICIPANT (Marcus Chen)");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
