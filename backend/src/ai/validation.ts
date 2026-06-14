export type NormalizedActionItem = {
  text: string;
  owner: string | null;
  dueDate: Date | null;
  confidence: number;
};

export type RetrievedChunk = {
  id: string;
  roomId: string;
  roomName: string | null;
  chunkText: string;
  chunkStartMs: number | null;
  chunkEndMs: number | null;
  primarySpeaker?: string | null;
  distance?: number;
};

export type NormalizedCitation = {
  roomId: string;
  roomName: string;
  chunkStartMs: number | null;
  chunkEndMs: number | null;
  snippet: string;
};

export type NormalizedRagAnswer = {
  answer: string;
  citations: NormalizedCitation[];
};

type RawActionItem = {
  text?: unknown;
  owner?: unknown;
  due_date?: unknown;
  confidence?: unknown;
};

type RawRagCitation = {
  room_id?: unknown;
  chunk_start_ms?: unknown;
  chunk_end_ms?: unknown;
};

export function transformActionItemOutput(raw: unknown): NormalizedActionItem[] {
  if (!raw || typeof raw !== "object") return [];

  const actionItems = (raw as { action_items?: unknown }).action_items;
  if (!Array.isArray(actionItems)) return [];

  const normalized: NormalizedActionItem[] = [];
  const seen = new Set<string>();

  for (const item of actionItems as RawActionItem[]) {
    if (!item || typeof item !== "object") continue;

    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;

    const dedupeKey = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const owner = typeof item.owner === "string" && item.owner.trim() ? item.owner.trim() : null;
    const dueDate = parseNullableDate(item.due_date);
    const confidence = normalizeConfidence(item.confidence);
    if (confidence === null) continue;

    normalized.push({ text, owner, dueDate, confidence });
  }

  return normalized;
}

export function transformRagAnswerOutput(raw: unknown, retrievedChunks: RetrievedChunk[]): NormalizedRagAnswer {
  const fallback: NormalizedRagAnswer = {
    answer: "I could not find that in your meeting history.",
    citations: [],
  };

  if (!raw || typeof raw !== "object") return fallback;

  const answer = typeof (raw as { answer?: unknown }).answer === "string"
    ? (raw as { answer: string }).answer.trim()
    : "";

  const rawCitations = (raw as { citations?: unknown }).citations;
  const citations = Array.isArray(rawCitations)
    ? validateCitations(rawCitations as RawRagCitation[], retrievedChunks)
    : [];

  return {
    answer: answer || fallback.answer,
    citations,
  };
}

export function validateEmbeddingVector(vector: unknown, dimensions: number): number[] {
  if (!Array.isArray(vector) || vector.length !== dimensions) {
    throw new Error(`Expected ${dimensions}-dimension embedding`);
  }

  return vector.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Embedding contains a non-finite value");
    }
    return value;
  });
}

export function formatPgVector(vector: number[]): string {
  const safeVector = vector.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding contains a non-finite value");
    }
    return Number(value);
  });

  return `[${safeVector.join(",")}]`;
}

function validateCitations(rawCitations: RawRagCitation[], retrievedChunks: RetrievedChunk[]) {
  const byExactKey = new Map<string, RetrievedChunk>();
  const chunksByRoom = new Map<string, RetrievedChunk[]>();

  for (const chunk of retrievedChunks) {
    byExactKey.set(citationKey(chunk.roomId, chunk.chunkStartMs, chunk.chunkEndMs), chunk);
    const list = chunksByRoom.get(chunk.roomId) ?? [];
    list.push(chunk);
    chunksByRoom.set(chunk.roomId, list);
  }

  const citations: NormalizedCitation[] = [];
  const seen = new Set<string>();

  for (const citation of rawCitations) {
    if (!citation || typeof citation !== "object") continue;
    if (typeof citation.room_id !== "string") continue;

    const roomId = citation.room_id;
    const startMs = nullableFiniteInteger(citation.chunk_start_ms);
    const endMs = nullableFiniteInteger(citation.chunk_end_ms);

    let chunk = byExactKey.get(citationKey(roomId, startMs, endMs));
    if (!chunk && startMs === null && endMs === null) {
      const sameRoom = chunksByRoom.get(roomId);
      if (sameRoom?.length === 1) chunk = sameRoom[0];
    }
    if (!chunk) continue;

    const key = citationKey(chunk.roomId, chunk.chunkStartMs, chunk.chunkEndMs);
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      roomId: chunk.roomId,
      roomName: chunk.roomName || "Meeting",
      chunkStartMs: chunk.chunkStartMs,
      chunkEndMs: chunk.chunkEndMs,
      snippet: createSnippet(chunk.chunkText),
    });
  }

  return citations;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function nullableFiniteInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function citationKey(roomId: string, startMs: number | null, endMs: number | null) {
  return `${roomId}:${startMs ?? "null"}:${endMs ?? "null"}`;
}

function createSnippet(text: string, maxLength = 240) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trim()}...`;
}
