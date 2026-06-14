export type TranscriptTurn = {
  speaker: string | null;
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type TranscriptChunk = {
  chunkText: string;
  chunkStartMs: number | null;
  chunkEndMs: number | null;
  primarySpeaker: string | null;
};

const SPEAKER_LINE = /^\s*(?:\[([^\]]+)\]\s*)?([^:\n]{1,80}):\s*(.+?)\s*$/;

export function chunkTranscript(
  transcript: string,
  chunkTokens = 500,
  overlapTokens = 50,
): TranscriptChunk[] {
  const turns = parseTranscriptTurns(transcript);
  if (turns.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let current: TranscriptTurn[] = [];
  let currentTokens = 0;

  for (const turn of turns) {
    const turnTokens = estimateTokens(turn.text);

    if (current.length > 0 && currentTokens + turnTokens > chunkTokens) {
      chunks.push(createChunk(current));
      current = trailingOverlap(current, overlapTokens);
      currentTokens = sumTokens(current);
    }

    current.push(turn);
    currentTokens += turnTokens;
  }

  if (current.length > 0) {
    chunks.push(createChunk(current));
  }

  return removeDuplicateTrailingOverlapOnlyChunks(chunks);
}

export function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  if (typeof transcript !== "string" || !transcript.trim()) return [];

  const turns: TranscriptTurn[] = [];
  const lines = transcript.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseTranscriptLine(trimmed);
    if (parsed) {
      turns.push(parsed);
      continue;
    }

    const previous = turns[turns.length - 1];
    if (previous) {
      previous.text = `${previous.text}\n${trimmed}`;
    } else {
      turns.push({ speaker: null, text: trimmed, startMs: null, endMs: null });
    }
  }

  for (let i = 0; i < turns.length; i++) {
    if (turns[i].endMs === null && turns[i].startMs !== null) {
      turns[i].endMs = turns[i + 1]?.startMs ?? turns[i].startMs;
    }
  }

  return turns.filter((turn) => turn.text.trim().length > 0);
}

export function estimateTokens(text: string): number {
  const compact = text.trim();
  if (!compact) return 0;
  return compact.split(/\s+/).length;
}

function parseTranscriptLine(line: string): TranscriptTurn | null {
  const match = line.match(SPEAKER_LINE);
  if (!match) return null;

  const timestamp = match[1] ? parseTimestampMs(match[1]) : { startMs: null, endMs: null };
  const speaker = match[2]?.trim() || null;
  const text = match[3]?.trim() || "";
  if (!text) return null;

  return {
    speaker,
    text,
    startMs: timestamp.startMs,
    endMs: timestamp.endMs,
  };
}

function parseTimestampMs(raw: string): { startMs: number | null; endMs: number | null } {
  const value = raw.trim();
  const range = value.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (range) {
    return {
      startMs: parseSingleTimestampMs(range[1]),
      endMs: parseSingleTimestampMs(range[2]),
    };
  }

  const labeled = value.match(/(?:start|ts)=([0-9:.]+)(?:\s+(?:end)=([0-9:.]+))?/i);
  if (labeled) {
    return {
      startMs: parseSingleTimestampMs(labeled[1]),
      endMs: labeled[2] ? parseSingleTimestampMs(labeled[2]) : null,
    };
  }

  const ms = parseSingleTimestampMs(value);
  return { startMs: ms, endMs: null };
}

function parseSingleTimestampMs(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const explicitMs = value.match(/^(\d+)\s*ms$/);
  if (explicitMs) return Number(explicitMs[1]);

  const numeric = value.match(/^\d+$/);
  if (numeric) return Number(value);

  const parts = value.split(":").map((part) => Number(part));
  if (parts.length >= 2 && parts.length <= 3 && parts.every((part) => Number.isFinite(part))) {
    const seconds = parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
    return Math.max(0, Math.round(seconds * 1000));
  }

  return null;
}

function trailingOverlap(turns: TranscriptTurn[], overlapTokens: number): TranscriptTurn[] {
  if (overlapTokens <= 0) return [];

  const selected: TranscriptTurn[] = [];
  let count = 0;

  for (let i = turns.length - 1; i >= 0; i--) {
    selected.unshift(turns[i]);
    count += estimateTokens(turns[i].text);
    if (count >= overlapTokens) break;
  }

  return selected;
}

function createChunk(turns: TranscriptTurn[]): TranscriptChunk {
  const chunkText = turns.map(formatTurn).join("\n");
  const speakers = new Map<string, number>();

  for (const turn of turns) {
    if (!turn.speaker) continue;
    speakers.set(turn.speaker, (speakers.get(turn.speaker) ?? 0) + estimateTokens(turn.text));
  }

  const primarySpeaker = [...speakers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const starts = turns.map((turn) => turn.startMs).filter((value): value is number => value !== null);
  const ends = turns.map((turn) => turn.endMs).filter((value): value is number => value !== null);

  return {
    chunkText,
    chunkStartMs: starts.length > 0 ? Math.min(...starts) : null,
    chunkEndMs: ends.length > 0 ? Math.max(...ends) : null,
    primarySpeaker,
  };
}

function formatTurn(turn: TranscriptTurn): string {
  const timestamp = turn.startMs !== null
    ? `[${formatTimestamp(turn.startMs)}${turn.endMs !== null && turn.endMs !== turn.startMs ? `-${formatTimestamp(turn.endMs)}` : ""}] `
    : "";
  const speaker = turn.speaker ? `${turn.speaker}: ` : "";
  return `${timestamp}${speaker}${turn.text}`;
}

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function sumTokens(turns: TranscriptTurn[]) {
  return turns.reduce((sum, turn) => sum + estimateTokens(turn.text), 0);
}

function removeDuplicateTrailingOverlapOnlyChunks(chunks: TranscriptChunk[]) {
  return chunks.filter((chunk, index) => {
    if (index === 0) return true;
    return chunk.chunkText !== chunks[index - 1].chunkText;
  });
}
