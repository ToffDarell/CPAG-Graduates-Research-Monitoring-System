import express from "express";
import multer from "multer";
import path from "path";
import { protect, checkAuth } from "../middleware/auth.js";
import {
  getFaculty,
  deleteFaculty,
  getResearchRecords,
  getAnalytics,
  archiveResearch,
  getMonitoringData,
  getPanelAssignments,
  uploadDocument,
  getDocuments,
  updateFaculty,
  inviteFaculty,
  createFaculty,
  approveResearch,
  assignPanel,
  legacyUpload,
  updateSettings,
  getSettings,
  logout,
  sendEmail,
} from "../controllers/deanController.js";



const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Apply authentication middleware to all routes
router.use(protect, checkAuth(["admin/dean", "Admin/Dean"]));

// Faculty management
router.get("/faculty", getFaculty);
router.post("/faculty", createFaculty);
router.put("/faculty/:id", updateFaculty);
router.delete("/faculty/:id", deleteFaculty);

// Research records and analytics
router.get("/research", getResearchRecords);
router.get("/analytics", getAnalytics);

// Archive projects
router.put("/archive/:id", archiveResearch);

// Monitoring and evaluation
router.get("/monitoring", getMonitoringData);

// Panel assignments
router.get("/panels", getPanelAssignments);

// Approve & assign panels
router.put("/approve/:id", approveResearch);
router.put("/assign-panel/:id", assignPanel);

// Document management
router.post("/documents", upload.single("file"), uploadDocument);
router.get("/documents", getDocuments);

// Legacy upload route for backward compatibility
router.post("/upload", upload.single("file"), legacyUpload);

// Settings
router.post("/settings", updateSettings);
router.get("/settings", getSettings);

// Logout
router.post("/logout", logout);

// Invite faculty
router.post("/invite-faculty", inviteFaculty);

// Send email
router.post("/send-email", sendEmail);

export default router;
