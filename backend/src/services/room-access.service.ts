import { prisma } from "../lib/prisma.js";

export async function findAccessibleRoom(roomId: string, userId: string) {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      OR: [
        { hostId: userId },
        { participants: { some: { userId } } },
      ],
    },
  });
}

export async function canAccessRoom(roomId: string, userId: string) {
  const room = await findAccessibleRoom(roomId, userId);
  return Boolean(room);
}

// ─── Atomic room join ────────────────────────────────────
// Capacity checks that read the participant count and then INSERT as two
// separate steps race under concurrent joins: two requests can both read
// "not full" before either commits, and both insert, pushing the room over
// maxParticipants. `SELECT ... FOR UPDATE` locks the Room row for the
// duration of the transaction, so concurrent joins for the SAME room
// serialize — the second transaction only sees the first's committed
// participant row once it acquires the lock, so its count check is
// guaranteed fresh.
export async function joinRoomAtomically(roomId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const rooms = await tx.$queryRaw<{ id: string; isActive: boolean; maxParticipants: number }[]>`
      SELECT "id", "isActive", "maxParticipants" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE
    `;
    const room = rooms[0];
    if (!room) return { status: "not_found" as const };
    if (!room.isActive) return { status: "ended" as const };

    const existingParticipant = await tx.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
    if (existingParticipant) return { status: "already_joined" as const, participant: existingParticipant };

    const activeCount = await tx.roomParticipant.count({ where: { roomId, leftAt: null } });
    if (activeCount >= room.maxParticipants) return { status: "full" as const };

    const participant = await tx.roomParticipant.create({
      data: { roomId, userId, role: "PARTICIPANT" },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
    return { status: "joined" as const, participant };
  });
}
