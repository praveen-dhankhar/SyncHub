# SyncHub AI Extension — "MeetingMind"
## Complete Technical Documentation Suite (v2 — Aligned to Production SyncHub)

> **Version:** 2.0.0 | **Author:** Praveen | **Date:** June 2026
> **Classification:** Portfolio / Open Source Extension
> **Base Project:** SyncHub (Next.js 16, Express 5, Prisma 7, Neon PostgreSQL, mediasoup, Gemini 2.0 Flash)
> **Stack Addition:** pgvector (Neon), Gemini structured output (`response_schema`), Prisma migrations, new Express routes + WebSocket events

---

## 0. What Changed from v1

v1 assumed a greenfield audio pipeline (mediasoup `PlainTransport` → ffmpeg → faster-whisper → Redis workers → pgvector). After reviewing SyncHub's actual README, that pipeline **already exists in simplified form**:

| v1 Assumption | Production Reality |
|---|---|
| No transcription exists | **Web Speech API** already provides live captions + a running transcript with speaker attribution, client-side, zero cost |
| No AI summary exists | `/ai/summary` (Gemini 2.0 Flash) already generates post-meeting summaries, rate-limited at 20 req/min |
| Need new Redis/Python worker fleet | Not needed — Express backend + Gemini API is sufficient for both new features |
| Raw PostgreSQL schema | Prisma 7 schema on Neon — all new tables are Prisma models + migrations |
| Need a new audio tap + transcription model | **Out of scope for v2** — Web Speech API transcript is the input, not a new pipeline |

**v2 scope is two features only:**

1. **Structured Action Items** — reuse the existing client-side transcript as input to a new Gemini structured-output endpoint (`/ai/action-items`), streamed to a new sidebar tab via the existing WebSocket message pattern.
2. **RAG over Meeting History ("Ask SyncHub")** — add `pgvector` to the existing Neon Postgres instance, embed transcripts + summaries at meeting end via Gemini embeddings, and expose a new search page/endpoint.

This cuts total implementation time from **70–90 hours / 4–5 weeks** to **~35–45 hours / 2–2.5 weeks**, and requires **zero new infrastructure** (no Redis, no Python workers, no ffmpeg, no Docker Compose changes beyond a Prisma migration).

---

# Table of Contents

1. [Product Requirements Document (PRD)](#1-product-requirements-document)
2. [App Flow](#2-app-flow)
3. [UI/UX Brief](#3-uiux-brief)
4. [Backend Schema](#4-backend-schema)
5. [Technical Requirements Document (TRD)](#5-technical-requirements-document)
6. [Implementation Workflow](#6-implementation-workflow)

---
---

# 1. Product Requirements Document

## 1.1 Overview

**MeetingMind v2** adds two features to SyncHub, both built entirely on the existing stack:

1. **Structured Action Items** — during a call, the existing client-side running transcript (from `use-transcription.ts` / Web Speech API) is periodically sent to a new `/ai/action-items` endpoint. Gemini returns a strict JSON array (`{ text, owner, due_date, confidence }`), validated against a schema, and broadcast to all participants via the existing WebSocket message router as a new `action-items-update` message type. Items render in a new "Action Items" tab alongside the existing Chat/Whiteboard tabs.

2. **RAG over Meeting History ("Ask SyncHub")** — when a meeting ends (`POST /rooms/:id/end`), the final transcript + Gemini summary are chunked, embedded via Gemini's embedding model, and stored in a new `MeetingEmbedding` Prisma model backed by `pgvector` on Neon. A new global search page lets users ask natural-language questions across their past meetings, with Gemini synthesizing an answer from the top-matching chunks and citing the source meeting + timestamp.

## 1.2 Problem Statement

| Current Reality (SyncHub, as shipped) | What MeetingMind v2 Adds |
|---|---|
| `/ai/summary` produces one prose summary at meeting end | Structured, owner-tagged, exportable action items — both live (during call) and finalized (at end) |
| Each meeting's summary is only viewable from that meeting's modal | All past meetings become searchable via natural-language Q&A with citations |
| Transcript exists only client-side during the call (Web Speech API) | Final transcript is persisted server-side and embedded for retrieval |
| No cross-meeting memory | "What did we decide about X last week?" works across the user's meeting history |

## 1.3 Goals

**Primary Goal (Career):** Demonstrate the ability to extend a real, production-deployed full-stack app with LLM structured output and a vector-search feature — using the app's existing patterns (rate limiting, controller structure, WebSocket router, Prisma schema) rather than bolting on a separate service.

**Secondary Goal (Technical):** Show schema design for `pgvector` on a serverless Postgres (Neon), Gemini `response_schema` usage for guaranteed-JSON output, and a chunking/embedding/retrieval pipeline.

**Tertiary Goal (Product):** Turn SyncHub's meeting history from a list of summaries into a searchable knowledge base.

## 1.4 Target Users

| Persona | Description | Use Case |
|---|---|---|
| **Meeting Participant** | Anyone in a SyncHub call | Sees action items populate live in the sidebar during the call |
| **Team Lead / Host** | Reviews meetings asynchronously | Uses "Ask SyncHub" to recall decisions from past meetings without rewatching/rereading |
| **Hiring Manager / Interviewer (meta-user)** | Evaluates depth | Assesses Prisma schema design, Gemini structured output handling, pgvector retrieval, and integration with an existing rate-limited Express API |

## 1.5 Core Feature Requirements

### F1 — Structured Action Item Extraction (Live + Final)
- **F1.1:** During an active call, the client periodically (every 60s, configurable) POSTs the current running transcript (already maintained by `use-transcription.ts`) to `POST /ai/action-items`.
- **F1.2:** The endpoint calls Gemini 2.0 Flash with `response_schema` set to `ActionItemListSchema` (see §4.2), guaranteeing valid JSON — no manual parsing/retry needed (this is a key difference from the v1 Ollama/Pydantic-retry design).
- **F1.3:** Returned items are persisted to a new `ActionItem` Prisma model (linked to `Room`) and broadcast to all room participants via the existing WebSocket router as `{ type: "action-items-update", items: [...] }`.
- **F1.4:** At meeting end (`POST /rooms/:id/end`), one final extraction pass runs over the complete transcript, superseding live-pass duplicates (deduplicated by Gemini in a single full-context call — simpler than v1's `extraction_pass` flag approach, since there's no streaming worker to coordinate).
- **F1.5:** Action items appear in a new tab in the existing chat/whiteboard sidebar, and are included in the Markdown export alongside the summary.
- **F1.6:** Reuses the existing AI rate limiter (20 req/min) — no new rate-limit tier needed since action-item calls are infrequent (1/60s) relative to the limit.

### F2 — RAG over Meeting History ("Ask SyncHub")
- **F2.1:** On `POST /rooms/:id/end`, after the existing summary generation, a new step chunks the transcript (≈500-token windows, 50-token overlap) and calls Gemini's embedding endpoint (`text-embedding-004`, 768-dim) for each chunk.
- **F2.2:** Chunks + embeddings + metadata (room id, host id, timestamp range, chunk text) are written to a new `MeetingEmbedding` Prisma model with a `pgvector` column, using Neon's `pgvector` extension (enabled via a raw-SQL Prisma migration).
- **F2.3:** New page `/dashboard/ask` (alongside the existing analytics dashboard) provides a search bar. `POST /ai/ask` embeds the query, runs a `pgvector` cosine-similarity query scoped to rooms the requesting user participated in (`RoomParticipant` join), and passes the top 8 chunks to Gemini for answer synthesis with citations.
- **F2.4:** Citations link to a read-only view of the source meeting's summary/transcript (new `GET /rooms/:id/transcript` endpoint), with the cited chunk highlighted.
- **F2.5:** `/ai/ask` is covered by the existing AI rate limiter tier.

## 1.6 Non-Functional Requirements

| Requirement | Target |
|---|---|
| Action item extraction call latency | < 5s (single Gemini call, `response_schema`) |
| Action items appear in UI after extraction | < 1s (existing WebSocket broadcast path) |
| Embedding generation at meeting end | < 15s for a 60-minute transcript (chunked, batched Gemini embedding calls) |
| `/ai/ask` end-to-end latency | < 3s (embed query + pgvector search + Gemini synthesis) |
| Schema validation failure rate | 0% — `response_schema` guarantees structure; no retry logic required (vs. v1's Pydantic retry) |
| New infrastructure required | **None** — no Redis, no Python workers, no Docker changes beyond Prisma migration |
| Storage overhead per meeting | Embeddings for a 60-min transcript ≈ 10-15 chunks × 768 floats ≈ < 100KB |

## 1.7 Out of Scope (v2)

- Server-side audio transcription (faster-whisper / mediasoup `PlainTransport`) — Web Speech API transcript remains the source.
- True acoustic speaker diarization — Web Speech API attribution (already in place) is reused as-is.
- Local LLM (Ollama) provider option — Gemini is already integrated and `response_schema` (Gemini-specific) is the reason structured output is simple here; a provider abstraction is deferred to v3 if needed.
- Cross-organization search — `/ai/ask` is scoped to `RoomParticipant` rows for the requesting user only.
- Real-time RAG during a call — embedding happens only at meeting end (same rationale as v1 ADR-02, still valid).

## 1.8 Success Metrics

| Metric | How Measured |
|---|---|
| Action items demo | Live call shows action items populating in sidebar within 60s, finalized at call end, included in export |
| RAG correctness | 10 manually-verified Q&A pairs against 5+ real/test meetings, ≥ 80% relevant |
| Latency budgets met | Measured and reported in README (§1.6 targets vs. actual) |
| Zero new infra | `docker-compose.yml` diff limited to environment variables; no new services |

---
---

# 2. App Flow

## 2.1 High-Level System Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     SyncHub Frontend (Next.js 16)                     │
│  Video Grid | Whiteboard | Chat | [NEW] Action Items tab              │
│  Dashboard  | [NEW] /dashboard/ask "Ask SyncHub" page                 │
└───────────┬─────────────────────────────────────┬─────────────────────┘
            │ WebSocket (existing ws router)       │ REST (existing + new)
            ▼                                       ▼
┌─────────────────────────────────────┐  ┌──────────────────────────────────┐
│   Express Backend — Realtime Layer   │  │  Express Backend — AI Controller  │
│   realtime/router.ts                 │  │  ai.controller.ts (extended)       │
│                                       │  │                                    │
│  [NEW] "action-items-update" message │  │  POST /ai/suggest     (existing)  │
│  type added to existing router       │  │  POST /ai/summary     (existing)  │
│                                       │◄─┤  POST /ai/action-items (NEW)      │
└───────────────────────────────────────┘  │  POST /ai/ask          (NEW)      │
                                            └───────────────┬────────────────────┘
                                                            │
                                            ┌───────────────▼────────────────────┐
                                            │   Gemini 2.0 Flash API              │
                                            │   - response_schema (action items)  │
                                            │   - text-embedding-004 (chunks/query)│
                                            │   - synthesis w/ citations          │
                                            └───────────────┬────────────────────┘
                                                            │
                                            ┌───────────────▼────────────────────┐
                                            │   Neon PostgreSQL + pgvector         │
                                            │   (Prisma 7)                        │
                                            │   - ActionItem (NEW)                │
                                            │   - MeetingEmbedding (NEW)           │
                                            │   - Room, RoomParticipant (existing)│
                                            └──────────────────────────────────────┘
```

## 2.2 Call Lifecycle (Additions to Existing Flow)

```
EXISTING:  join-room → [call active, Web Speech API builds transcript client-side]
                          │
NEW:                      │ every 60s (client-side timer)
                          ▼
                  POST /ai/action-items { transcript, roomId }
                          │
                          ▼
                  Gemini (response_schema) → ActionItem[]
                          │
                          ▼
                  Persist to DB, broadcast "action-items-update" via ws router
                          │
                          ▼
                  ActionItemsTab renders (all participants)

EXISTING:  POST /rooms/:id/end
              │
              ├─► (existing) generate Gemini summary → MeetingSummaryModal
              │
NEW:          ├─► final POST /ai/action-items pass (full transcript) → dedupe/finalize
              │
              └─► NEW: chunk transcript+summary → Gemini embeddings → write MeetingEmbedding rows
```

## 2.3 "Ask SyncHub" Query Flow

```
STEP 1: User on /dashboard/ask types a query
  Input: { query: "What did we decide about the API redesign last week?" }

STEP 2: POST /ai/ask
  2a. Gemini embed(query) → query_vector (768-dim)
  2b. Prisma raw query (pgvector cosine distance):
        SELECT me.*, r."name" as room_name, r."id" as room_id
        FROM "MeetingEmbedding" me
        JOIN "Room" r ON r.id = me."roomId"
        JOIN "RoomParticipant" rp ON rp."roomId" = r.id
        WHERE rp."userId" = :currentUserId
        ORDER BY me.embedding <=> :query_vector
        LIMIT 8

STEP 3: Gemini synthesis
  Input:  { query, retrieved_chunks: [...] }
  Prompt: "Answer using only the provided meeting excerpts. Cite meeting name + timestamp."
  Output: { answer: "...", citations: [{ roomId, roomName, chunkStart, chunkEnd }] }

STEP 4: Response rendered with clickable citations
  Clicking a citation → GET /rooms/:id/transcript?highlight=chunkStart-chunkEnd
```

---
---

# 3. UI/UX Brief

## 3.1 Design Philosophy

Both features slot into SyncHub's existing component conventions — Radix UI primitives, the existing tab/panel layout in the call sidebar, the existing `MeetingSummaryModal` pattern, and the existing dashboard's card-based layout (Recharts, analytics cards). No new design system is introduced.

## 3.2 In-Call Sidebar — New "Action Items" Tab

The existing in-call sidebar already has Chat and Whiteboard as tabs (per the README's component list). MeetingMind v2 adds a third tab using the same `Tabs` (Radix) component already in use:

```
┌────────────────────────────────────────────┐
│  [ Chat ]  [ Whiteboard ]  [ Action Items ] │  ← existing Tabs component, one more entry
├────────────────────────────────────────────┤
│  ☐ Move API redesign to next sprint          │
│     Owner: Praveen · mentioned ~12 min ago   │
│                                               │
│  ☐ Finalize auth piece this sprint           │
│     Owner: Anita · mentioned ~4 min ago      │
│                                               │
│  (new items fade in — reuses existing toast/ │
│   reaction animation timing)                  │
│                                               │
│  [ Export as Markdown ]                       │
└────────────────────────────────────────────┘
```

- Checkbox is local/visual only (matches v1 spec — no sync in this version).
- "mentioned ~X min ago" — relative time since the item was extracted, computed client-side.
- Export button reuses the existing export/download pattern from `RecordingsModal`-style components.

## 3.3 Post-Call: `MeetingSummaryModal` Extension

The existing modal (Summary tab only, per README) gains two more tabs, matching the existing `Tabs` pattern:

```
┌─────────────────────────────────────────────────────┐
│  Meeting Summary                                      │
│  [ Summary ]  [ Action Items ]  [ Transcript ]        │  ← extends existing modal
├─────────────────────────────────────────────────────┤
│  (existing Gemini summary content, unchanged)         │
└─────────────────────────────────────────────────────┘
```

- **Action Items tab:** finalized list from the meeting-end extraction pass.
- **Transcript tab:** full Web Speech API transcript with speaker labels (already collected client-side; now also persisted server-side for embedding — this tab simply renders what's sent to `/ai/action-items` and the embedding step).

## 3.4 New Page: `/dashboard/ask` — "Ask SyncHub"

Placed as a new nav item alongside the existing `/dashboard` analytics page, using the same page shell (header, sidebar nav) as the dashboard:

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard   │  Ask SyncHub                              │
│  Ask SyncHub │  ┌─────────────────────────────────────┐ │  ← new nav item,
│  (NEW)       │  │ What did we decide about the API    │ │     same sidebar
│              │  │ redesign?                            │ │     style as
│              │  └─────────────────────────────────────┘ │     existing
│              │                                  [Search] │     /dashboard
│              │                                           │
│              │  Based on your meetings, the team decided │
│              │  to move the API redesign to next sprint  │
│              │  to prioritize finishing the auth work.    │
│              │                                           │
│              │  Sources:                                 │
│              │  📅 Sprint Planning — Jun 10 — 09:14      │
│              │  📅 Sprint Planning — Jun 10 — 09:31      │
└─────────────────────────────────────────────────────────┘
```

- Uses the same card/typography styles as the existing Meeting History list on `/dashboard`.
- Citations are `Link` components to `/rooms/:id/transcript?highlight=...`, opening a read-only transcript view (new page, minimal — reuses the Transcript tab component from §3.3).
- Loading state reuses the existing skeleton/spinner pattern already present in the dashboard's analytics cards.

## 3.5 Responsive Behavior

- Action Items tab: same responsive behavior as existing Chat/Whiteboard tabs (already handle mobile/tablet per README's "Responsive Design" claim) — no new breakpoints needed.
- `/dashboard/ask`: inherits the existing dashboard's responsive grid.

---
---

# 4. Backend Schema

## 4.1 Prisma Schema Additions

```prisma
// schema.prisma — additions to existing 6 models

model ActionItem {
  id          String   @id @default(cuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  text        String
  owner       String?
  dueDate     DateTime?
  confidence  Float
  extractionPass Int   @default(1)   // 1 = live pass, 2 = final pass (meeting end)
  createdAt   DateTime @default(now())

  @@index([roomId])
}

model MeetingEmbedding {
  id          String   @id @default(cuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  chunkText   String
  chunkStartMs Int?
  chunkEndMs   Int?
  primarySpeaker String?
  // pgvector column — Prisma 7 supports Unsupported() for types without native mapping
  embedding   Unsupported("vector(768)")
  createdAt   DateTime @default(now())

  @@index([roomId])
}

// Extend existing Room model with embedding status tracking
model Room {
  // ...existing fields unchanged...
  embeddingStatus String? @default("pending")  // pending | completed | failed
  actionItems     ActionItem[]
  embeddings      MeetingEmbedding[]
}
```

## 4.2 Migration (Raw SQL for pgvector — Neon-compatible)

Prisma's schema diff can't generate the `vector` extension or HNSW index, so this migration includes raw SQL alongside the generated model changes:

```sql
-- migrations/XXXX_add_meetingmind_tables/migration.sql

-- Enable pgvector (Neon supports this extension)
CREATE EXTENSION IF NOT EXISTS vector;

-- ActionItem table (generated by `prisma migrate dev` from schema above)
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractionPass" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ActionItem_roomId_idx" ON "ActionItem"("roomId");
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;

-- MeetingEmbedding table (vector column added manually post-generation)
CREATE TABLE "MeetingEmbedding" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "chunkStartMs" INTEGER,
    "chunkEndMs" INTEGER,
    "primarySpeaker" TEXT,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MeetingEmbedding_roomId_idx" ON "MeetingEmbedding"("roomId");
ALTER TABLE "MeetingEmbedding" ADD CONSTRAINT "MeetingEmbedding_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;

-- HNSW index for cosine similarity search
CREATE INDEX "MeetingEmbedding_embedding_idx" ON "MeetingEmbedding"
    USING hnsw ("embedding" vector_cosine_ops);

-- Room: track embedding status
ALTER TABLE "Room" ADD COLUMN "embeddingStatus" TEXT DEFAULT 'pending';
```

**Note on Prisma + pgvector:** Prisma Client doesn't natively query `vector` columns with type safety. The similarity search in `/ai/ask` uses `prisma.$queryRaw` with the query embedding interpolated as a parameter (see §5.4).

## 4.3 New Endpoint Contracts

### `POST /ai/action-items`

```typescript
// Request
{
  roomId: string;
  transcript: string;       // full running transcript text, speaker-labeled
  isFinal?: boolean;         // true on meeting-end pass (extractionPass = 2)
}

// Response
{
  items: ActionItem[];       // newly extracted items (deduped against existing for this room)
}
```

### `POST /ai/ask`

```typescript
// Request
{
  query: string;
}

// Response
{
  answer: string;
  citations: Array<{
    roomId: string;
    roomName: string;
    chunkStartMs: number | null;
    chunkEndMs: number | null;
    snippet: string;          // short excerpt of the cited chunk
  }>;
}
```

### `GET /rooms/:id/transcript`

```typescript
// Response — new endpoint, serves the persisted transcript for read-only viewing
{
  roomId: string;
  roomName: string;
  transcript: string;
  highlightStartMs?: number;  // from query param, for citation deep-links
  highlightEndMs?: number;
}
```

## 4.4 Gemini Structured Output Schemas

```typescript
// ai/schemas.ts

// Used with Gemini's response_schema parameter — guarantees valid JSON,
// no Pydantic-style retry loop needed (v1's biggest pain point eliminated).

export const ActionItemListSchema = {
  type: "object",
  properties: {
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          owner: { type: "string", nullable: true },
          due_date: { type: "string", nullable: true },  // ISO 8601 or null
          confidence: { type: "number" },
        },
        required: ["text", "confidence"],
      },
    },
  },
  required: ["action_items"],
};

export const RagAnswerSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          room_id: { type: "string" },
          chunk_start_ms: { type: "integer", nullable: true },
          chunk_end_ms: { type: "integer", nullable: true },
        },
        required: ["room_id"],
      },
    },
  },
  required: ["answer", "citations"],
};
```

## 4.5 Chunking Utility

```typescript
// ai/chunker.ts

interface TranscriptChunk {
  chunkText: string;
  chunkStartMs: number | null;
  chunkEndMs: number | null;
  primarySpeaker: string | null;
}

/**
 * Splits a speaker-labeled transcript string into ~500-token windows
 * with ~50-token overlap, breaking only on speaker-turn boundaries
 * (never mid-utterance). Since Web Speech API transcripts already carry
 * inline timestamps per utterance (per use-transcription.ts), those are
 * parsed and preserved as chunkStartMs/chunkEndMs.
 */
export function chunkTranscript(
  transcript: string,
  chunkTokens = 500,
  overlapTokens = 50
): TranscriptChunk[] {
  // implementation: split on speaker-turn lines, accumulate until
  // ~chunkTokens (whitespace-based estimate), retain overlapTokens
  // worth of trailing utterances in the next chunk
  // ...
}
```

---
---

# 5. Technical Requirements Document

## 5.1 System Architecture

**Pattern:** Two additive features on an existing monolithic Express backend — no new services, no new infrastructure. Both features are implemented as additional methods on the existing `ai.controller.ts`, additional Prisma models, and (for action items) one new WebSocket message type in the existing `realtime/router.ts`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EXISTING SYNCHUB (UNCHANGED)                    │
│  Next.js 16 client │ Express 5 + ws server │ mediasoup SFU │ Prisma/Neon │
│  ai.controller.ts: /ai/suggest, /ai/summary (Gemini 2.0 Flash)           │
└───────────────────────────────┬───────────────────────────────────────────┘
                                  │ extended in-place
┌─────────────────────────────────▼─────────────────────────────────────────┐
│                     MEETINGMIND v2 ADDITIONS                               │
│                                                                            │
│  ai.controller.ts (+2 methods)        realtime/router.ts (+1 msg type)   │
│  ├── actionItems(req,res)             └── "action-items-update"          │
│  └── ask(req,res)                                                          │
│                                                                            │
│  ai/schemas.ts (NEW)        ai/chunker.ts (NEW)                            │
│  ├── ActionItemListSchema   └── chunkTranscript()                         │
│  └── RagAnswerSchema                                                       │
│                                                                            │
│  prisma/schema.prisma (+2 models, +1 field on Room)                       │
│  ├── ActionItem                                                            │
│  └── MeetingEmbedding (pgvector)                                           │
│                                                                            │
│  client/app/dashboard/ask/page.tsx (NEW page)                              │
│  client/components/ActionItemsTab.tsx (NEW component)                     │
│  client/components/MeetingSummaryModal.tsx (extended: +2 tabs)            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Technology Stack (Additions Only)

| Layer | Technology | Rationale |
|---|---|---|
| Vector store | **pgvector on Neon** | Neon supports the `pgvector` extension natively — zero new infra, same connection string |
| Structured output | **Gemini `response_schema`** | Already using `@google/generative-ai`; `response_schema` guarantees valid JSON — eliminates the Pydantic-retry complexity from v1 entirely |
| Embeddings | **Gemini `text-embedding-004`** | Same provider/API key as existing summary feature; 768-dim |
| ORM for vector queries | **Prisma `$queryRaw`** | Prisma 7 doesn't have first-class `vector` type support; raw SQL with parameterized embedding array is the documented workaround |
| Realtime delivery | **Existing `ws` router** | New `action-items-update` message type follows the exact pattern of existing `chat-message`/`reaction` types |

## 5.3 Why `response_schema` Instead of v1's Pydantic-Retry Approach

**ADR-01 (v2):** v1 (Ollama-based) required `Pydantic` validation with a corrective-retry-then-skip policy because local models via JSON mode don't strictly guarantee schema conformance. Gemini's `response_schema` parameter (available on 2.0 Flash, already in use for `/ai/summary`) constrains decoding to match a JSON Schema — the API will not return malformed JSON. This removes:
- `SchemaValidationError` / retry logic
- The "skip batch on double failure" fallback
- Most of v1's §5.4 error-handling complexity for extraction

The remaining error cases (Gemini API unreachable, rate limit) are already handled by the existing `/ai/summary` error handling — `/ai/action-items` and `/ai/ask` reuse that same try/catch + rate-limiter middleware.

## 5.4 pgvector Query via Prisma `$queryRaw`

```typescript
// services/rag.service.ts

import { prisma } from "../lib/prisma";

export async function searchMeetingEmbeddings(
  queryEmbedding: number[],
  userId: string,
  topK = 8
) {
  // pgvector requires the embedding as a literal array string: '[0.1,0.2,...]'
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  return prisma.$queryRaw<
    Array<{
      id: string;
      roomId: string;
      roomName: string;
      chunkText: string;
      chunkStartMs: number | null;
      chunkEndMs: number | null;
      distance: number;
    }>
  >`
    SELECT me.id, me."roomId", r.name as "roomName", me."chunkText",
           me."chunkStartMs", me."chunkEndMs",
           me.embedding <=> ${vectorLiteral}::vector AS distance
    FROM "MeetingEmbedding" me
    JOIN "Room" r ON r.id = me."roomId"
    JOIN "RoomParticipant" rp ON rp."roomId" = r.id
    WHERE rp."userId" = ${userId}
    ORDER BY distance ASC
    LIMIT ${topK}
  `;
}
```

**ADR-02 (v2):** Embedding interpolation via `${vectorLiteral}::vector` is safe from SQL injection because `queryEmbedding` is a `number[]` produced by our own embedding call — never raw user input. If this pattern were ever extended to accept user-supplied vectors, it would need explicit numeric validation before interpolation.

## 5.5 Action Item Deduplication (Live → Final Pass)

**ADR-03 (v2):** Rather than v1's `extraction_pass` flag requiring downstream consumers to reconcile two passes, v2's final pass sends the **complete transcript plus the list of already-extracted live-pass items** to Gemini, with an instruction to return the *complete, deduplicated* final list. The final pass's `extractionPass=2` rows replace (soft-delete or supersede) pass-1 rows for that room in a single transaction:

```typescript
// On meeting end:
const liveItems = await prisma.actionItem.findMany({ where: { roomId, extractionPass: 1 } });
const finalResult = await extractActionItems({
  transcript: fullTranscript,
  existingItems: liveItems.map(i => i.text),  // included in prompt for dedup context
});

await prisma.$transaction([
  prisma.actionItem.deleteMany({ where: { roomId, extractionPass: 1 } }),
  prisma.actionItem.createMany({
    data: finalResult.action_items.map(item => ({ ...item, roomId, extractionPass: 2 })),
  }),
]);
```

This keeps the data model simple (UI always renders "current" items without filtering by pass) at the cost of one extra ~500-token prompt input on the final call — negligible given Gemini 2.0 Flash pricing.

## 5.6 Security & Privacy Requirements

| Risk | Mitigation |
|---|---|
| `/ai/action-items` and `/ai/ask` exposed without auth | Both routes use the existing `auth.middleware.ts` JWT verification, identical to other protected routes |
| RAG cross-user leakage | `searchMeetingEmbeddings` joins `RoomParticipant` on `userId` from the verified JWT — a user can only retrieve chunks from rooms they participated in |
| Transcript sent to Gemini (external API) | Already the case for `/ai/summary` — no new data-flow risk introduced; documented in existing privacy posture |
| Prompt injection via transcript content | `response_schema` constrains output structure regardless of injected instructions in transcript text; prompts use a fixed system instruction with transcript content in a clearly delimited block |
| Rate limit abuse on `/ai/action-items` (client polls every 60s) | Existing 20 req/min AI limiter already bounds this; 60s interval is well under the limit for realistic call sizes |

## 5.7 Error Handling Matrix

| Error | Where Caught | Behavior |
|---|---|---|
| Gemini API error/timeout on `/ai/action-items` | `ai.controller.ts` (existing try/catch pattern) | Return 503; client silently skips this cycle, retries next 60s interval — live extraction is best-effort |
| Gemini API error on final extraction pass | `ai.controller.ts` | Meeting end proceeds (summary still generated); `Room.embeddingStatus` unaffected; action items remain at last live-pass state |
| Gemini embedding call fails at meeting end | `rooms.controller.ts` (`end` handler) | Set `Room.embeddingStatus = "failed"`; meeting excluded from `/ai/ask` results; can be retried via a manual re-embed script |
| `$queryRaw` pgvector query fails | `rag.service.ts` | `/ai/ask` returns a graceful "couldn't search your meetings right now" message, not a 500 |
| No embeddings exist yet (new user, no past meetings) | `/ai/ask` | Returns a friendly empty-state message rather than calling Gemini with zero context |

## 5.8 Performance Budget

| Operation | Target | Hard Limit |
|---|---|---|
| `/ai/action-items` (live, 60s interval) | < 5s | 15s |
| `/ai/action-items` (final pass, full transcript) | < 8s | 20s |
| Meeting-end embedding (chunk + embed + write, 60-min transcript) | < 15s | 45s |
| `/ai/ask` (embed query + pgvector search + synthesis) | < 3s | 8s |

## 5.9 Dependencies (Additions Only)

```json
// backend/package.json — no new dependencies required beyond what's already used
// @google/generative-ai already present for /ai/summary and /ai/suggest
// pgvector requires only the Postgres extension (Neon-side), no npm package needed
// for raw vector literals via $queryRaw
```

```sql
-- One-time, run via Prisma migration (see §4.2)
CREATE EXTENSION IF NOT EXISTS vector;
```

## 5.10 Interview Talking Points

**On structured output design:**
> "I originally designed this with Pydantic schema validation and a corrective-retry loop, assuming a local model. Once I confirmed the production app already uses Gemini 2.0 Flash, I switched to `response_schema`, which constrains decoding server-side — that eliminated an entire class of error handling. Knowing when a platform feature removes the need for application-level validation is as important as building the validation."

**On schema/migration design with pgvector + Prisma:**
> "Prisma doesn't have first-class `vector` type support, so the migration includes raw SQL for the column type, the extension, and the HNSW index, while the rest of the model is Prisma-managed. Queries against the vector column go through `$queryRaw` with the embedding interpolated as a parameterized array — I documented why that's safe here (the vector is always our own embedding output, never user-supplied) since that's exactly the kind of thing a security review would flag."

**On scoping/rescoping:**
> "My first draft of this spec assumed no transcription existed and proposed a whole new audio pipeline. After checking the actual production README, I found Web Speech API transcription and Gemini summaries were already shipped. I cut the spec from a 5-week new-infrastructure project to a 2-week feature addition that reuses every existing pattern — same rate limiter, same WebSocket router, same controller file. That's the kind of rescoping a real engineering team does constantly."

---
---

# 6. Implementation Workflow

## 6.1 Repository Structure (Additions to Existing SyncHub Repo)

```
SyncHub/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # +ActionItem, +MeetingEmbedding, +Room.embeddingStatus
│   │   └── migrations/
│   │       └── XXXX_meetingmind_v2/   # NEW — raw SQL per §4.2
│   └── src/
│       ├── controllers/
│       │   ├── ai.controller.ts       # +actionItems(), +ask()  (extended, not new file)
│       │   └── room.controller.ts     # `end` handler extended: final pass + embedding step
│       ├── ai/                        # NEW
│       │   ├── schemas.ts             # ActionItemListSchema, RagAnswerSchema
│       │   └── chunker.ts             # chunkTranscript()
│       ├── services/
│       │   └── rag.service.ts         # NEW — searchMeetingEmbeddings()
│       └── realtime/
│           └── router.ts              # +"action-items-update" message type
│
├── client/
│   ├── app/
│   │   └── dashboard/
│   │       └── ask/
│   │           └── page.tsx           # NEW — "Ask SyncHub"
│   ├── components/
│   │   ├── ActionItemsTab.tsx         # NEW
│   │   └── MeetingSummaryModal.tsx    # extended: +Action Items tab, +Transcript tab
│   └── hooks/
│       └── use-action-items.ts        # NEW — 60s polling + ws listener
```

## 6.2 Week-by-Week Implementation Plan (2–2.5 weeks, 2–3 hrs/day)

### Week 1 — Structured Action Items

**Day 1: Prisma schema + migration**
- Add `ActionItem` model and `Room.embeddingStatus` field to `schema.prisma`.
- Run `npx prisma migrate dev` for `ActionItem` (no vector column yet — that's Week 2).
- Verify: `ActionItem` table exists, FK to `Room` works.

**Day 2: Gemini schema + extraction function**
- `ai/schemas.ts`: define `ActionItemListSchema`.
- Add `extractActionItems(transcript, existingItems?)` helper using `@google/generative-ai` with `response_schema: ActionItemListSchema` — mirrors the existing `/ai/summary` Gemini call pattern in `ai.controller.ts`.
- Unit test: call with a fixture transcript, assert response matches schema shape (no retry logic needed — just assert the call succeeds).

**Day 3: `POST /ai/action-items` endpoint**
- New controller method on `ai.controller.ts`, behind existing auth middleware + AI rate limiter.
- Persists returned items to `ActionItem` (extractionPass=1, upsert/append).
- Postman/curl test against a real room.

**Day 4: WebSocket broadcast**
- `realtime/router.ts`: add `"action-items-update"` message type, broadcast to all sockets in the room (same pattern as `chat-message`/`reaction`).
- Trigger broadcast from the `/ai/action-items` controller after persisting.

**Day 5: Client — polling hook + ActionItemsTab**
- `use-action-items.ts`: 60s interval posts current transcript (from existing `use-transcription.ts` state) to `/ai/action-items`; also subscribes to `action-items-update` ws messages.
- `ActionItemsTab.tsx`: renders items list, matches existing Chat/Whiteboard tab styling (Radix `Tabs`).
- Add tab to the existing sidebar `Tabs` component.

**Day 6–7: Final pass + summary modal extension + export**
- `room.controller.ts` `end` handler: call `extractActionItems` with full transcript + existing pass-1 items, replace via `$transaction` (§5.5).
- `MeetingSummaryModal.tsx`: add "Action Items" and "Transcript" tabs.
- Extend existing Markdown export to include action items section.

**Week 1 Exit Criteria:**
- [ ] During a live call, Action Items tab populates within ~60s of relevant discussion
- [ ] Ending a call produces a finalized, deduplicated action item list
- [ ] Export includes action items

---

### Week 2 — RAG over Meeting History

**Day 8: pgvector migration**
- Write raw-SQL migration (§4.2): `CREATE EXTENSION vector`, `MeetingEmbedding` table, HNSW index.
- Run against Neon dev branch; verify extension is available (Neon supports `pgvector` — confirm on the specific project's Postgres version).

**Day 9: Chunker + embedding helper**
- `ai/chunker.ts`: `chunkTranscript()` — speaker-turn-aware, ~500 tokens, 50-token overlap.
- Embedding helper using Gemini `text-embedding-004`, batched calls (Gemini supports batch embedding requests).
- Unit tests on a synthetic transcript: verify chunk boundaries respect speaker turns.

**Day 10: Wire embedding into meeting-end flow**
- `room.controller.ts` `end` handler: after summary + final action items, chunk transcript+summary, embed, write `MeetingEmbedding` rows, set `Room.embeddingStatus = "completed"` (or `"failed"` on error per §5.7).
- Manual test: end a meeting, confirm rows appear in `MeetingEmbedding` with non-null `embedding`.

**Day 11: `rag.service.ts` + `/ai/ask` endpoint**
- `searchMeetingEmbeddings()` via `$queryRaw` (§5.4).
- `POST /ai/ask`: embed query → search → Gemini synthesis with `RagAnswerSchema` → map citations to room names via a follow-up Prisma query.
- Test with a hand-written query against 2-3 seeded meetings.

**Day 12: `GET /rooms/:id/transcript` + citation deep-link**
- New read-only endpoint serving the persisted transcript, with optional `?highlight=startMs-endMs` query param.
- Minimal client page to render it with highlighted range.

**Day 13: `/dashboard/ask` page**
- New page under existing dashboard nav, matching dashboard's card/typography styles.
- Search input → `/ai/ask` → render answer + citation links.

**Day 14 (buffer): Eval set + README**
- Build the 10-Q&A eval set against 5 real/seeded meetings, score relevance (target ≥80%).
- Update README: architecture diagram (§2.1), measured latencies (§5.8 actual vs target), eval results table, "what changed from v1" note (§0) as a portfolio talking point about iterative scoping.

**Week 2 Exit Criteria:**
- [ ] "Ask SyncHub" returns relevant, cited answers for ≥80% of the 10-question eval set
- [ ] Citations link to the correct meeting transcript at the correct point
- [ ] README documents measured latencies and the v1→v2 rescoping decision

---

## 6.3 Testing Strategy

| Test Type | Framework | What It Covers |
|---|---|---|
| Unit — schemas | existing test setup (Jest/Vitest, matching repo convention) | `ActionItemListSchema`/`RagAnswerSchema` shapes match Gemini SDK expectations |
| Unit — chunker | same | Speaker-turn-aware chunking, overlap, token-window sizing on fixture transcripts |
| Integration — `/ai/action-items` | same + test DB | End-to-end: transcript in → Gemini call (mocked) → `ActionItem` rows → ws broadcast fired |
| Integration — `/ai/ask` | same + Neon dev branch with pgvector | Seed `MeetingEmbedding` rows, verify `$queryRaw` returns expected nearest neighbors |
| Integration — final-pass dedup | same | Seed pass-1 items, run final pass (mocked Gemini), verify `$transaction` replaces correctly |
| Manual/measured — RAG eval | scripted | 10 Q&A pairs scored for relevance |
| E2E — UI | Playwright (if present in existing repo) or manual | Action Items tab populates during a call; `/dashboard/ask` returns and links citations |

## 6.4 Resume Bullet (Post-Build)

> **MeetingMind v2 (SyncHub AI Extension)** — Extended a production Next.js/Express/Prisma video platform with structured action-item extraction (Gemini `response_schema`, zero-retry guaranteed-JSON output, live + finalized passes) and RAG over meeting history (`pgvector` on Neon, HNSW index, citation-grounded "Ask SyncHub" search); achieved **≥80% answer relevance** on a 10-question eval set with sub-3s query latency, shipped with zero new infrastructure by reusing the existing rate limiter, WebSocket router, and Prisma schema.

## 6.5 v3 Roadmap (Post-Hiring Enhancements)

| Feature | Complexity | Value |
|---|---|---|
| Server-side transcript persistence independent of client (currently relies on client posting transcript) | Medium | Removes dependency on client staying connected for embedding to capture full transcript |
| Streaming Gemini synthesis for `/ai/ask` (token-by-token) | Low | Better perceived latency |
| Provider abstraction (Ollama fallback for `/ai/ask` synthesis) | Medium | Privacy-sensitive deployments, mirrors PR-Agent's local-inference story |
| Cross-meeting action item tracking ("still open from last week") | Medium | Turns action items into a lightweight task tracker |
| Re-embed script for model/version upgrades | Low | Operational hygiene as `text-embedding-004` evolves |

---

*Document last updated: June 2026*
*Total estimated implementation time: 35–45 hours over 2–2.5 weeks (zero new infrastructure; builds on production SyncHub as documented in its README)*
