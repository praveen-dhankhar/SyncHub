import { prisma } from "../lib/prisma.js";
import { formatPgVector, type RetrievedChunk } from "../ai/validation.js";

export async function searchMeetingEmbeddings(
  queryEmbedding: number[],
  userId: string,
  topK = 8,
): Promise<RetrievedChunk[]> {
  const vectorLiteral = formatPgVector(queryEmbedding);
  const limit = Math.max(1, Math.min(topK, 8));

  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      me."id",
      me."roomId",
      r."name" AS "roomName",
      me."chunkText",
      me."chunkStartMs",
      me."chunkEndMs",
      me."primarySpeaker",
      me."embedding" <=> ${vectorLiteral}::vector AS "distance"
    FROM "MeetingEmbedding" me
    JOIN "Room" r ON r."id" = me."roomId"
    WHERE r."embeddingStatus" = 'completed'
      AND (
        r."hostId" = ${userId}
        OR EXISTS (
          SELECT 1
          FROM "RoomParticipant" rp
          WHERE rp."roomId" = r."id"
            AND rp."userId" = ${userId}
        )
      )
    ORDER BY me."embedding" <=> ${vectorLiteral}::vector ASC
    LIMIT ${limit}
  `;
}
