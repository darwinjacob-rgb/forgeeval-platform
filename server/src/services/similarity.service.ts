import prisma from '../config/database.ts';

/**
 * Service that computes a simplistic code similarity score between two submissions.
 * It uses the overlap of file content hashes as a proxy for duplicated code.
 * This deterministic fallback avoids external AI calls.
 */
export class SimilarityService {
  /**
   * Compute similarity between two submissions.
   * Returns a SimilarityResult object and persists it.
   */
  public static async computeSimilarity(
    hackathonId: string,
    submissionAId: string,
    submissionBId: string
  ) {
    // Fetch file hashes for both submissions
    const [filesA, filesB] = await Promise.all([
      prisma.submissionFile.findMany({ where: { submissionId: submissionAId } }),
      prisma.submissionFile.findMany({ where: { submissionId: submissionBId } }),
    ]);

    const hashSetA = new Set(filesA.map((f) => f.contentHash).filter(Boolean));
    const hashSetB = new Set(filesB.map((f) => f.contentHash).filter(Boolean));

    const intersection = [...hashSetA].filter((h) => hashSetB.has(h)).length;
    const union = new Set([...hashSetA, ...hashSetB]).size;
    const similarityScore = union === 0 ? 0 : intersection / union; // 0‑1 range

    // Persist result (upsert to avoid duplicates)
    const existing = await prisma.similarityResult.findFirst({
      where: {
        hackathonId,
        submissionAId,
        submissionBId,
      },
    });
    if (existing) {
      return await prisma.similarityResult.update({
        where: { id: existing.id },
        data: { similarityScore, matchingFragments: [] },
      });
    }
    return await prisma.similarityResult.create({
      data: {
        hackathonId,
        submissionAId,
        submissionBId,
        similarityScore,
        matchingFragments: [],
      },
    });
  }

  /** Retrieve all similarity results for a hackathon */
  public static async listForHackathon(hackathonId: string) {
    return prisma.similarityResult.findMany({ where: { hackathonId } });
  }
}
