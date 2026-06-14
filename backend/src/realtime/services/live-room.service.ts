import RoomService from "./room.service.js";

export const liveRoomService = new RoomService();

export function broadcastActionItemsUpdate(roomId: string, items: unknown[]) {
  liveRoomService.broadcastToRoom(roomId, {
    type: "action-items-update",
    items,
  });
}
