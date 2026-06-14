import { prisma } from "../lib/prisma.js";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import { extractActionItems } from "../ai/action-items.js";
import { replaceRoomEmbeddings } from "../ai/embeddings.js";
import { generateMeetingSummaryData, normalizeSummary, type MeetingSummaryData } from "../ai/summary.js";
import { replaceActionItems } from "../services/action-items.service.js";
import { broadcastActionItemsUpdate } from "../realtime/services/live-room.service.js";

// ─── Helper ─────────────────────────────────────────────
// Generates a short, human-friendly invite code.
// Uses base36 (0-9 + a-z) for readability. 6 chars = 2.1 billion combos.
// Example output: "a7k3m2"
function generateInviteCode(): string {
  return randomBytes(4).toString("hex").slice(0, 6);
}

function parseHighlightRange(query: Request["query"]): { startMs: number; endMs: number } | null | "invalid" {
  const highlight = typeof query.highlight === "string" ? query.highlight : null;
  const explicitStart = typeof query.highlightStartMs === "string" ? query.highlightStartMs : null;
  const explicitEnd = typeof query.highlightEndMs === "string" ? query.highlightEndMs : null;

  let startRaw: string | null = explicitStart;
  let endRaw: string | null = explicitEnd;

  if (highlight && (!startRaw || !endRaw)) {
    const [start, end] = highlight.split("-");
    startRaw = start ?? null;
    endRaw = end ?? null;
  }

  if (!startRaw && !endRaw) return null;
  if (!startRaw || !endRaw) return "invalid";

  const startMs = Number(startRaw);
  const endMs = Number(endRaw);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "invalid";
  if (startMs < 0 || endMs < 0 || endMs < startMs) return "invalid";

  return { startMs: Math.trunc(startMs), endMs: Math.trunc(endMs) };
}

// Default max participants per room type.
// These are sensible defaults; the host can override on creation.
const DEFAULT_MAX_PARTICIPANTS: Record<string, number> = {
  ONE_TO_ONE: 2,
  GROUP: 10,
  VIRTUAL_ROOM: 20,
};

const MAX_TRANSCRIPT_CHARS = 200_000;

// ─── CREATE ROOM ────────────────────────────────────────
// POST /rooms
// Body: { name?, type?, maxParticipants?, scheduledAt? }
//
// LOGIC:
// 1. Extract the authenticated user's ID (set by auth middleware)
// 2. Determine maxParticipants based on room type (or use provided value)
// 3. Generate a unique invite code for shareable links
// 4. Create the room in DB with the host as the first participant
// 5. Return the room object including the invite code
export const createRoom = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const {
    name,
    type = "ONE_TO_ONE",
    maxParticipants,
    scheduledAt,
  } = req.body;

  // Use provided max or fall back to the default for this room type
  const effectiveMax = maxParticipants ?? DEFAULT_MAX_PARTICIPANTS[type] ?? 2;

  try {
    const room = await prisma.room.create({
      data: {
        name: name || null,
        type,
        maxParticipants: effectiveMax,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        inviteCode: generateInviteCode(),
        hostId: userId,
        // Automatically add the creator as a HOST participant
        participants: {
          create: {
            userId,
            role: "HOST",
          },
        },
      },
      // Return the full room with participant details
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    console.log(`Room created: ${room.id} (type: ${room.type}, invite: ${room.inviteCode})`);
    return res.status(201).json(room);
  } catch (err) {
    console.error("Failed to create room:", err);
    return res.status(500).json({ error: "Failed to create room" });
  }
};

// ─── GET ROOM ───────────────────────────────────────────
// GET /rooms/:id
//
// Returns full room details including all participants.
// Used when the frontend loads the call page.
export const getRoom = async (req: Request, res: Response) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        host: {
          select: { id: true, username: true, avatar: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json(room);
  } catch (err) {
    console.error("Failed to get room:", err);
    return res.status(500).json({ error: "Failed to get room" });
  }
};

// ─── GET ROOM TRANSCRIPT ────────────────────────────────
// GET /rooms/:id/transcript
export const getRoomTranscript = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;

  try {
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        OR: [
          { hostId: userId },
          { participants: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        transcript: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const range = parseHighlightRange(req.query);
    if (range === "invalid") {
      return res.status(400).json({ message: "Invalid highlight range" });
    }

    return res.json({
      roomId: room.id,
      roomName: room.name || "Meeting",
      transcript: room.transcript || "",
      ...(range ? { highlightStartMs: range.startMs, highlightEndMs: range.endMs } : {}),
    });
  } catch (err) {
    console.error("Failed to get transcript:", err);
    return res.status(500).json({ error: "Failed to get transcript" });
  }
};

// ─── JOIN ROOM (by ID) ──────────────────────────────────
// POST /rooms/:id/join
//
// LOGIC:
// 1. Check if room exists and is still active
// 2. Check if room is full (compare participant count vs maxParticipants)
// 3. Check if user is already in the room (prevent duplicates)
// 4. If all good → create a RoomParticipant record with PARTICIPANT role
//
// WHY PARTICIPANT role by default?
// When someone joins via link/invite, they get PARTICIPANT (full voice/video).
// The host can later downgrade them to VIEWER or promote to CO_HOST.
// For VIRTUAL_ROOM type, we might default to VIEWER in the future
// (attendees watch until host enables them).
export const joinRoom = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: {
            // Only count ACTIVE participants (not ones who already left)
            participants: { where: { leftAt: null } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.isActive) {
      return res.status(400).json({ message: "This meeting has ended" });
    }

    // Check if user is already a participant FIRST —
    // they should always be allowed to re-join regardless of room capacity
    const existingParticipant = await prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (existingParticipant) {
      return res.json({ message: "Already in this room", participant: existingParticipant });
    }

    // Only check capacity for genuinely NEW participants
    if (room._count.participants >= room.maxParticipants) {
      return res.status(400).json({ message: "Room is full" });
    }

    const participant = await prisma.roomParticipant.create({
      data: {
        roomId,
        userId,
        role: "PARTICIPANT",
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return res.status(201).json(participant);
  } catch (err) {
    console.error("Failed to join room:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

// ─── JOIN ROOM (by Invite Code) ─────────────────────────
// POST /rooms/join/:inviteCode
//
// This is the shareable link flow:
// User receives a link like `onestudio.app/join/a7k3m2`
// Frontend calls this endpoint to join using the invite code
// Same validation as joinRoom, but lookup is by inviteCode instead of ID.
export const joinByInviteCode = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { inviteCode } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { inviteCode },
      include: {
        _count: {
          select: {
            participants: { where: { leftAt: null } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    if (!room.isActive) {
      return res.status(400).json({ message: "This meeting has ended" });
    }

    // Check if user is already a participant FIRST
    const existingParticipant = await prisma.roomParticipant.findFirst({
      where: { roomId: room.id, userId, leftAt: null },
    });

    if (existingParticipant) {
      return res.json({ message: "Already in this room", roomId: room.id, id: room.id, type: room.type, participant: existingParticipant });
    }

    // Only check capacity for genuinely NEW participants
    if (room._count.participants >= room.maxParticipants) {
      return res.status(400).json({ message: "Room is full" });
    }

    const participant = await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId,
        role: "PARTICIPANT",
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return res.status(201).json({ roomId: room.id, id: room.id, type: room.type, participant });
  } catch (err) {
    console.error("Failed to join by invite:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

// ─── LEAVE ROOM ─────────────────────────────────────────
// POST /rooms/:id/leave
//
// LOGIC:
// 1. Find the user's active participation (where leftAt is null)
// 2. Set leftAt to now — we don't DELETE the record because we
//    want to keep the history (who was in the meeting, when they left)
// 3. If the host leaves, we could either:
//    a) End the meeting (current approach)
//    b) Transfer host to a co-host or next participant (future)
export const leaveRoom = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;

  try {
    // Find the user's active participation
    const participant = await prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (!participant) {
      return res.status(400).json({ message: "Not in this room" });
    }

    // Mark as left (don't delete — preserve history)
    await prisma.roomParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    return res.json({ message: "Left the room" });
  } catch (err) {
    console.error("Failed to leave room:", err);
    return res.status(500).json({ error: "Failed to leave room" });
  }
};

// ─── END ROOM ───────────────────────────────────────────
// POST /rooms/:id/end
//
// Only the HOST can end a meeting. This:
// 1. Sets isActive=false and endedAt=now on the Room
// 2. Sets leftAt=now on ALL remaining participants
// The WebSocket handler will separately notify all connected
// peers to disconnect.
export const endRoom = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const roomId = req.params.id;
  const transcript = typeof req.body?.transcript === "string" ? req.body.transcript.trim() : "";
  const duration = typeof req.body?.duration === "string" ? req.body.duration : undefined;
  const participantCount = typeof req.body?.participantCount === "number" ? req.body.participantCount : undefined;
  const suppliedSummary = req.body?.summaryData ? normalizeSummary(req.body.summaryData) : null;

  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return res.status(400).json({ message: "Invalid transcript" });
  }

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Only the host can end the meeting
    if (room.hostId !== userId) {
      return res.status(403).json({ message: "Only the host can end the meeting" });
    }

    const now = new Date();
    const summaryData = suppliedSummary ?? await generateOptionalSummary(transcript, duration, participantCount);
    const finalTranscript = transcript || room.transcript || "";
    const finalSummary = summaryData?.summary || room.summary || "";

    // Use a transaction to ensure both updates happen atomically
    await prisma.$transaction([
      // Mark the room as ended
      prisma.room.update({
        where: { id: roomId },
        data: {
          isActive: false,
          endedAt: now,
          transcript: finalTranscript || null,
          summary: finalSummary || null,
          summaryData: summaryData || room.summaryData || undefined,
          embeddingStatus: finalTranscript ? "pending" : room.embeddingStatus,
        },
      }),
      // Mark all remaining participants as left
      prisma.roomParticipant.updateMany({
        where: { roomId, leftAt: null },
        data: { leftAt: now },
      }),
    ]);

    await runMeetingMindFinalization(roomId, finalTranscript, finalSummary);

    const actionItems = await prisma.actionItem.findMany({
      where: { roomId },
      orderBy: [{ extractionPass: "desc" }, { createdAt: "asc" }],
    });
    const updatedRoom = await prisma.room.findUnique({
      where: { id: roomId },
      select: { embeddingStatus: true },
    });

    return res.json({ message: "Meeting ended", actionItems, embeddingStatus: updatedRoom?.embeddingStatus ?? room.embeddingStatus });
  } catch (err) {
    console.error("Failed to end room:", err);
    return res.status(500).json({ error: "Failed to end meeting" });
  }
};

async function generateOptionalSummary(
  transcript: string,
  duration?: string,
  participantCount?: number,
): Promise<MeetingSummaryData | null> {
  if (!transcript) return null;
  try {
    return await generateMeetingSummaryData(transcript, duration, participantCount);
  } catch (error: any) {
    console.error("Meeting summary finalization failed:", error.message);
    return null;
  }
}

async function runMeetingMindFinalization(roomId: string, transcript: string, summary: string) {
  if (!transcript.trim()) return;

  try {
    const liveItems = await prisma.actionItem.findMany({
      where: { roomId, extractionPass: 1 },
      orderBy: { createdAt: "asc" },
    });
    const finalItems = await extractActionItems({
      transcript,
      existingItems: liveItems.map((item) => item.text),
      isFinal: true,
    });
    const items = await replaceActionItems(roomId, 2, finalItems);
    broadcastActionItemsUpdate(roomId, items);
  } catch (error: any) {
    console.error("Final action item extraction failed:", error.message);
  }

  try {
    await replaceRoomEmbeddings(roomId, transcript, summary);
    await prisma.room.update({
      where: { id: roomId },
      data: { embeddingStatus: "completed" },
    });
  } catch (error: any) {
    console.error("Meeting embedding finalization failed:", error.message);
    await prisma.room.update({
      where: { id: roomId },
      data: { embeddingStatus: "failed" },
    }).catch((updateError: any) => console.error("Failed to update embedding status:", updateError.message));
  }
}

// ─── LIST USER'S ROOMS ──────────────────────────────────
// GET /rooms
// Query: ?active=true  → only active rooms
//        ?active=false → only ended rooms (history)
//        (no param)    → all rooms
//
// Returns rooms where the user is either host or participant.
// Sorted by most recent first.
export const getUserRooms = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const activeFilter = req.query.active;

  try {
    // Build the where clause dynamically
    const where: any = {
      OR: [
        { hostId: userId },
        { participants: { some: { userId } } },
      ],
    };

    if (activeFilter === "true") where.isActive = true;
    if (activeFilter === "false") where.isActive = false;

    const rooms = await prisma.room.findMany({
      where,
      include: {
        host: {
          select: { id: true, username: true, avatar: true },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(rooms);
  } catch (err) {
    console.error("Failed to list rooms:", err);
    return res.status(500).json({ error: "Failed to list rooms" });
  }
};

// ─── USER MEETING STATS ─────────────────────────────────
// GET /rooms/stats
// Returns personalized dashboard analytics
export const getUserStats = async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    // Get all rooms this user participated in
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { hostId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        host: { select: { id: true, username: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalMeetings = rooms.length;
    let totalDurationMs = 0;
    const meetingsByType: Record<string, number> = {};
    const dailyActivity: Record<string, number> = {};

    // Compute stats from ALL rooms
    const allMeetings = rooms.map((room) => {
      let durationMs = 0;
      if (room.endedAt) {
        durationMs = Math.max(0, new Date(room.endedAt).getTime() - new Date(room.createdAt).getTime());
        // Cap ended rooms to 4 hours in case of bad test data
        durationMs = Math.min(durationMs, 4 * 60 * 60 * 1000);
      } else if (room.isActive) {
        const timeSinceCreation = Date.now() - new Date(room.createdAt).getTime();
        // If a test room was left active for more than 4 hours, treat it as a zombie
        // and assign a realistic 15-minute fallback duration.
        if (timeSinceCreation > 4 * 60 * 60 * 1000) {
          durationMs = 15 * 60 * 1000; // 15 mins
        } else {
          durationMs = timeSinceCreation;
        }
      }
      totalDurationMs += durationMs;

      // Count by type
      meetingsByType[room.type] = (meetingsByType[room.type] || 0) + 1;

      // Daily activity
      const dayKey = new Date(room.createdAt).toISOString().split("T")[0];
      dailyActivity[dayKey] = (dailyActivity[dayKey] || 0) + 1;

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
        isActive: room.isActive,
        durationMs,
        participantCount: room._count.participants,
        hostName: room.host.username,
        isHost: room.hostId === userId,
      };
    });

    // Only return top 20 for the list
    const recentMeetings = allMeetings.slice(0, 20);

    // Build daily activity for last 30 days
    const last30Days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      last30Days.push({ date: key, count: dailyActivity[key] || 0 });
    }

    const avgDurationMs = totalMeetings > 0 ? totalDurationMs / totalMeetings : 0;

    return res.json({
      totalMeetings,
      totalDurationMs,
      avgDurationMs,
      meetingsByType,
      recentMeetings,
      dailyActivity: last30Days,
    });
  } catch (err) {
    console.error("Failed to get user stats:", err);
    return res.status(500).json({ error: "Failed to get stats" });
  }
};
