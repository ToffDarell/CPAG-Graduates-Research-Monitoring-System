import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { protect, checkAuth } from "../middleware/auth.js";
import { checkPermission as checkRolePermission } from "../middleware/permissions.js";
import { 
  login,
  getAvailableDocuments, 
  downloadDocument, 
  viewDocument,
  uploadComplianceForm,
  uploadComplianceFormFromDrive,
  getComplianceForms,
  getComplianceForm,
  downloadComplianceForm,
  viewComplianceForm,
  uploadChapter,
  uploadChapterFromDrive,
  deleteChapterSubmission,
  viewChapterSubmission,
  downloadChapterSubmission,
  getChapterSubmissions,
  getProgressOverview,
  getDriveStatus,
  getMyResearch,
  getMySchedules,
  getAdviserFeedback,
  viewFeedbackFile,
  getFeedbackComments,
  exportScheduleICS,
  getAvailableSlots,
  requestConsultation,
  createCustomConsultationRequest,
  getCompletedThesis,
  getPanelFeedback
} from "../controllers/studentController.js";

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + "-" + cleanName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'), false);
    }
  },
});


// Login route (no authentication required)
router.post("/login", login);

// Apply authentication middleware to all routes below
router.use(protect, checkAuth(["graduate student"]));

// Compliance form routes
router.post("/compliance-form", upload.single("file"), uploadComplianceForm);
router.post("/compliance-form-from-drive", uploadComplianceFormFromDrive);
router.get("/compliance-forms", getComplianceForms);
router.get("/compliance-forms/:id", getComplianceForm);
router.get("/compliance-forms/:id/download", downloadComplianceForm);
router.get("/compliance-forms/:id/view", viewComplianceForm);

// Research routes
router.get("/research", getMyResearch);
router.get("/chapters", getChapterSubmissions);
router.get("/progress", getProgressOverview);
router.get("/drive-status", getDriveStatus);
router.post("/chapter", upload.single("file"), uploadChapter);
router.post("/chapter-from-drive", uploadChapterFromDrive);
router.get("/chapter-submissions/:submissionId/view", viewChapterSubmission);
router.get("/chapter-submissions/:submissionId/download", downloadChapterSubmission);
router.delete("/chapter-submissions/:submissionId", deleteChapterSubmission);

// Schedule routes
router.get("/schedules", getMySchedules);
router.get("/schedules/:id/export-ics", exportScheduleICS);
router.get("/feedback", getAdviserFeedback);
router.get("/feedback/view/:feedbackId", viewFeedbackFile);
router.get("/feedback/:feedbackId/comments", getFeedbackComments);

// Get available consultation slots from adviser
  router.get("/available-slots", (req, res, next) => {
  console.log('[ROUTE] /available-slots hit');
  console.log('[ROUTE] User:', req.user?._id?.toString(), req.user?.name, req.user?.role);
  next();
}, getAvailableSlots);

// Request consultation (from existing slot)
router.post("/request-consultation", requestConsultation);

// Create custom consultation request (student creates their own request)
router.post("/create-consultation-request", (req, res, next) => {
  console.log('[ROUTE] /create-consultation-request hit');
  console.log('[ROUTE] User:', req.user?._id?.toString(), req.user?.name, req.user?.role);
  next();
}, createCustomConsultationRequest);

// Logout
router.post("/logout", async (req, res) => {
  // Invalidate token client-side or manage session
  res.json({ message: "Graduate student logged out successfully" });
});

// Document routes
router.get("/documents", getAvailableDocuments);
router.get("/documents/:id", viewDocument);
router.get("/documents/:id/download", downloadDocument);

// Completed thesis routes
router.get("/completed-thesis", getCompletedThesis);
router.get("/completed-thesis/:id/panel-feedback", getPanelFeedback);

export default router;

