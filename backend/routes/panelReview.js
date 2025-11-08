import express from "express";
import {
  getPanelReviewByToken,
  submitPanelReviewByToken,
  downloadPanelDocumentByToken,
} from "../controllers/programHeadController.js";

const router = express.Router();

// Public routes for token-based panel review (no authentication required)
router.get("/:token", getPanelReviewByToken);
router.post("/:token/submit", submitPanelReviewByToken);
router.get("/:token/documents/:documentId/download", downloadPanelDocumentByToken);

export default router;

