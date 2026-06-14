CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "summaryData" JSONB;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "ActionItem" (
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

CREATE INDEX IF NOT EXISTS "ActionItem_roomId_idx" ON "ActionItem"("roomId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ActionItem_roomId_fkey'
    ) THEN
        ALTER TABLE "ActionItem"
        ADD CONSTRAINT "ActionItem_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MeetingEmbedding" (
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

CREATE INDEX IF NOT EXISTS "MeetingEmbedding_roomId_idx" ON "MeetingEmbedding"("roomId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'MeetingEmbedding_roomId_fkey'
    ) THEN
        ALTER TABLE "MeetingEmbedding"
        ADD CONSTRAINT "MeetingEmbedding_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MeetingEmbedding_embedding_hnsw_idx"
ON "MeetingEmbedding" USING hnsw ("embedding" vector_cosine_ops);
