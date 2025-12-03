import express from "express";
import { protect } from "../middleware/auth.js";
import * as sheetsController from "../controllers/googleSheetsController.js";

const router = express.Router();

// Generate Google Sheets OAuth URL
router.get("/auth-url", protect, sheetsController.getAuthUrl);

// OAuth callback for Sheets - redirects to shared Drive callback
router.get("/callback", sheetsController.handleCallback);

// Get current user's Sheets status
router.get("/status", protect, sheetsController.getStatus);

// Disconnect Sheets
router.post("/disconnect", protect, sheetsController.disconnect);

// Create a new spreadsheet
router.post("/create-spreadsheet", protect, sheetsController.createSpreadsheetController);

// Create research progress dashboard
router.post("/create-research-dashboard", protect, sheetsController.createResearchDashboard);

// Update research data in sheet
router.post("/update-research-data", protect, sheetsController.updateResearchData);

// Export activity logs to sheet
router.post("/export-activity-logs", protect, sheetsController.exportActivityLogs);

// Export compliance forms tracking
router.post("/export-compliance-tracking", protect, sheetsController.exportComplianceTracking);

// Export schedule to sheet
router.post("/export-schedules", protect, sheetsController.exportSchedules);

// Export panel assignments
router.post("/export-panel-assignments", protect, sheetsController.exportPanelAssignments);

// Write data to sheet
router.post("/write", protect, sheetsController.writeToSheetController);

// Read data from sheet
router.get("/read", protect, sheetsController.readFromSheetController);

// Get spreadsheet info
router.get("/spreadsheet/:spreadsheetId", protect, sheetsController.getSpreadsheetInfoController);

export default router;
