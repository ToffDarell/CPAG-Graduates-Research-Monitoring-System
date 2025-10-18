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
  viewDocument, 
  downloadDocument,
  deleteDocument,
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
  toggleFacultyActivation,
  addResearchRemarks,
  getResearchFeedback,
    } from "../controllers/deanController.js";



const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use import instead of require for ES modules
    import('path').then(path => {
      const uploadPath = path.join(process.cwd(), 'backend', 'uploads');
      cb(null, uploadPath);
    });
  },
  filename: (req, file, cb) => {
    // Clean filename to avoid issues
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + "-" + cleanName);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, PowerPoint, and text files are allowed.'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(protect, checkAuth(["dean", "Dean"]));

// Faculty management
router.get("/faculty", getFaculty);
router.post("/faculty", createFaculty);
router.put("/faculty/:id", updateFaculty);
router.delete("/faculty/:id", deleteFaculty);
router.put("/faculty/:id/toggle-status", toggleFacultyActivation);

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
router.get("/documents/:id", viewDocument); // Add this line
router.get("/documents/:id/download", downloadDocument);
router.delete("/documents/:id", deleteDocument);

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

// Search research
router.post("/research/:researchId/remarks", addResearchRemarks);
router.get("/research/:researchId/feedback", getResearchFeedback);

export default router;
