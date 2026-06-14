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
