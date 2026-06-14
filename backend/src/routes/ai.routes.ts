import { Router } from "express";
import { askSyncHub, getActionItems, getSmartReplies, getMeetingSummary } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// POST /ai/suggest — get 3 smart reply suggestions from transcript
router.post("/suggest", protect, getSmartReplies);

// POST /ai/summary — get structured meeting summary
router.post("/summary", protect, getMeetingSummary);

// POST /ai/action-items — extract structured meeting action items
router.post("/action-items", protect, getActionItems);

// POST /ai/ask — ask citation-grounded questions across meeting history
router.post("/ask", protect, askSyncHub);

export default router;
