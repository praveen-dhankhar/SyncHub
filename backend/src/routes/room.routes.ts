import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    createRoom,
    getRoom,
    joinRoom,
    joinByInviteCode,
    leaveRoom,
    endRoom,
    getUserRooms,
    getUserStats,
    getRoomTranscript,
} from "../controllers/room.controller.js";
import { protect } from "../middleware/auth.middleware.js";

// Room creation limiter: 15 rooms per minute (prevent spam).
// Scoped to POST /rooms only — previously mounted on all of /rooms/*,
// which meant normal dashboard/read traffic (list rooms, stats, transcript,
// join, leave) shared the same 15/min budget as room creation.
const roomCreateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many rooms created. Please wait." },
});

// ─── Room Routes ────────────────────────────────────────
//
// All routes are protected (require JWT auth).
//
// Route design follows REST conventions:
//   POST   /rooms              → create a new room
//   GET    /rooms              → list user's rooms (active + history)
//   GET    /rooms/:id          → get a specific room
//   POST   /rooms/:id/join     → join a room by ID
//   POST   /rooms/:id/leave    → leave a room
//   POST   /rooms/:id/end      → end a meeting (host only)
//   POST   /rooms/join/:inviteCode → join via shareable invite code

const router = Router();

router.post("/", roomCreateLimiter, protect, createRoom);
router.get("/", protect, getUserRooms);
router.get("/stats", protect, getUserStats);
router.get("/:id/transcript", protect, getRoomTranscript);
router.get("/:id", protect, getRoom);
router.post("/:id/join", protect, joinRoom);
router.post("/:id/leave", protect, leaveRoom);
router.post("/:id/end", protect, endRoom);
router.post("/join/:inviteCode", protect, joinByInviteCode);

export default router;
