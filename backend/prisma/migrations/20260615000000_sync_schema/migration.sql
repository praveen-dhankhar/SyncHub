-- Migration: Sync schema with database
-- Adds all missing columns, enums, tables, and indexes that exist in the
-- Prisma schema but were never migrated.

-- ─── ENUMS ──────────────────────────────────────────────

-- Recreate RoomType (was dropped in a previous migration)
CREATE TYPE "RoomType" AS ENUM ('ONE_TO_ONE', 'GROUP', 'VIRTUAL_ROOM');

-- Add missing values to RoomRole
ALTER TYPE "RoomRole" ADD VALUE IF NOT EXISTS 'CO_HOST';
ALTER TYPE "RoomRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- New enums
CREATE TYPE "RecordingStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
CREATE TYPE "PresentationType" AS ENUM ('SCREEN_SHARE', 'SLIDE_DECK');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM', 'AI_SUGGESTION');

-- ─── USER TABLE ─────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;

-- ─── ROOM TABLE ─────────────────────────────────────────

ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
-- Backfill updatedAt with createdAt for existing rows, then make NOT NULL
UPDATE "Room" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Room" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "type" "RoomType" NOT NULL DEFAULT 'ONE_TO_ONE';
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;
-- Backfill inviteCode with id for existing rows, then add unique constraint
UPDATE "Room" SET "inviteCode" = "id" WHERE "inviteCode" IS NULL;
ALTER TABLE "Room" ALTER COLUMN "inviteCode" SET NOT NULL;
ALTER TABLE "Room" ALTER COLUMN "inviteCode" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS "Room_inviteCode_key" ON "Room"("inviteCode");

CREATE INDEX IF NOT EXISTS "Room_inviteCode_idx" ON "Room"("inviteCode");
CREATE INDEX IF NOT EXISTS "Room_hostId_idx" ON "Room"("hostId");
CREATE INDEX IF NOT EXISTS "Room_isActive_idx" ON "Room"("isActive");

-- ─── RECORDING TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Recording" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'video/webm',
    "status" "RecordingStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Recording_roomId_idx" ON "Recording"("roomId");
CREATE INDEX IF NOT EXISTS "Recording_userId_idx" ON "Recording"("userId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Recording_roomId_fkey') THEN
        ALTER TABLE "Recording"
        ADD CONSTRAINT "Recording_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Recording_userId_fkey') THEN
        ALTER TABLE "Recording"
        ADD CONSTRAINT "Recording_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── PRESENTATION TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "Presentation" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "type" "PresentationType" NOT NULL DEFAULT 'SCREEN_SHARE',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Presentation_roomId_idx" ON "Presentation"("roomId");
CREATE INDEX IF NOT EXISTS "Presentation_userId_idx" ON "Presentation"("userId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Presentation_roomId_fkey') THEN
        ALTER TABLE "Presentation"
        ADD CONSTRAINT "Presentation_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Presentation_userId_fkey') THEN
        ALTER TABLE "Presentation"
        ADD CONSTRAINT "Presentation_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── CHAT MESSAGE TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_roomId_fkey') THEN
        ALTER TABLE "ChatMessage"
        ADD CONSTRAINT "ChatMessage_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_userId_fkey') THEN
        ALTER TABLE "ChatMessage"
        ADD CONSTRAINT "ChatMessage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
