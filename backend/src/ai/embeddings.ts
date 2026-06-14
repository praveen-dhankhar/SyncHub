import { TaskType } from "@google/generative-ai";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { chunkTranscript, type TranscriptChunk } from "./chunker.js";
import { EMBEDDING_DIMENSIONS, GEMINI_EMBEDDING_MODEL, genAI, isGeminiConfigured } from "./gemini.js";
import { formatPgVector, validateEmbeddingVector } from "./validation.js";

export async function embedTexts(texts: string[], taskType: TaskType): Promise<number[][]> {
  const cleanTexts = texts.map((text) => text.trim()).filter(Boolean);
  if (cleanTexts.length === 0) return [];
  if (!isGeminiConfigured()) {
    throw new Error("Gemini is not configured");
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
  const response = await model.batchEmbedContents({
    requests: cleanTexts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
      taskType,
    })),
  });

  return response.embeddings.map((embedding) => validateEmbeddingVector(embedding.values, EMBEDDING_DIMENSIONS));
}

export async function embedQuery(query: string): Promise<number[]> {
  const embeddings = await embedTexts([query], TaskType.RETRIEVAL_QUERY);
  const embedding = embeddings[0];
  if (!embedding) throw new Error("Failed to generate query embedding");
  return embedding;
}

export async function replaceRoomEmbeddings(roomId: string, transcript: string, summary?: string | null) {
  const chunks = buildMeetingChunks(transcript, summary);
  if (chunks.length === 0) {
    await prisma.meetingEmbedding.deleteMany({ where: { roomId } });
    return 0;
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.chunkText), TaskType.RETRIEVAL_DOCUMENT);
  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count mismatch");
  }

  await prisma.$transaction(async (tx) => {
    await tx.meetingEmbedding.deleteMany({ where: { roomId } });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = formatPgVector(embeddings[i]);
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "MeetingEmbedding"
          ("id", "roomId", "chunkText", "chunkStartMs", "chunkEndMs", "primarySpeaker", "embedding", "createdAt")
        VALUES
          (${id}, ${roomId}, ${chunk.chunkText}, ${chunk.chunkStartMs}, ${chunk.chunkEndMs}, ${chunk.primarySpeaker}, ${vector}::vector, CURRENT_TIMESTAMP)
      `;
    }
  });

  return chunks.length;
}

export function buildMeetingChunks(transcript: string, summary?: string | null): TranscriptChunk[] {
  const parts: string[] = [];
  if (summary?.trim()) parts.push(`[0:00] Summary: ${summary.trim()}`);
  if (transcript.trim()) parts.push(transcript.trim());
  return chunkTranscript(parts.join("\n"), 500, 50);
}
