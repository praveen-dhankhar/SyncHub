import { prisma } from "../lib/prisma.js";
import type { NormalizedActionItem } from "../ai/validation.js";

export async function replaceActionItems(
  roomId: string,
  extractionPass: 1 | 2,
  items: NormalizedActionItem[],
) {
  return prisma.$transaction(async (tx) => {
    if (extractionPass === 2) {
      await tx.actionItem.deleteMany({ where: { roomId, extractionPass: { in: [1, 2] } } });
    } else {
      await tx.actionItem.deleteMany({ where: { roomId, extractionPass: 1 } });
    }

    for (const item of items) {
      await tx.actionItem.create({
        data: {
          roomId,
          text: item.text,
          owner: item.owner,
          dueDate: item.dueDate,
          confidence: item.confidence,
          extractionPass,
        },
      });
    }

    return tx.actionItem.findMany({
      where: { roomId },
      orderBy: [{ extractionPass: "desc" }, { createdAt: "asc" }],
    });
  });
}
