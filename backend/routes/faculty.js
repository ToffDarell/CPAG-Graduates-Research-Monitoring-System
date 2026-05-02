import express from "express";
import multer from "multer";
import path from "path";
import { protect, checkAuth } from "../middleware/auth.js";
import {
  getStudentSubmissions,
  updateThesisStatus,
  approveRejectSubmission,
  uploadFeedback,
  getAllFeedback,
  getFeedbackByResearch,
  getDeanRemarks,
  downloadFeedbackFile,
  viewFeedbackFile,
  getFeedbackComments,
  addFeedbackComment,
  updateFeedbackComment,
  deleteFeedbackComment,
  deleteFeedback,
  getConsultationSchedules,
  createConsultationSlot,
  updateConsultationSlot,
  updateConsultationStatus,
  cancelConsultation,
  deleteConsultationSlot,
  getMyStudents,
  getMyPanels,
  submitPanelReview,
  getAvailableDocuments,
  getMyPanelDocuments,
  uploadDocument,
  downloadDocument,
  viewDocument,
  deleteChapterSubmission,
  viewChapterSubmission,
  downloadResearchDocument,
  viewResearchDocument
} from "../controllers/facultyController.js";
import {
  uploadPanelDocument,
  getPanelDocuments,
  downloadPanelDocument,
  viewPanelDocument,
} from "../controllers/programHeadController.js";

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
const panelDocumentFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and DOCX files are allowed"), false);
  }
};

const uploadPanelDocumentMiddleware = multer({
  storage,
  fileFilter: panelDocumentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Apply authentication middleware to all routes
router.use(protect, checkAuth(["faculty adviser"]));

// Student submissions
router.get("/submissions", getStudentSubmissions);

// View chapter submission (faculty can view student submissions)
router.get("/submissions/:submissionId/view", viewChapterSubmission);

// Delete chapter submission (faculty can delete any submission including approved)
// Must be before /submissions/approve-reject to avoid route conflicts
router.delete("/submissions/:submissionId", deleteChapterSubmission);

// Approve/reject submissions
router.post("/submissions/approve-reject", approveRejectSubmission);

// Thesis status management
router.put("/thesis/:id/status", updateThesisStatus);

// Feedback management
router.post("/feedback", upload.single("file"), uploadFeedback);
router.get("/feedback", getAllFeedback);
router.get("/feedback/research/:researchId", getFeedbackByResearch);
router.get("/feedback/research/:researchId/dean-remarks", getDeanRemarks);
router.get("/feedback/download/:feedbackId", downloadFeedbackFile);

// IMPORTANT: /feedback/view/:feedbackId must come BEFORE /feedback/:feedbackId/comments
// to avoid route conflicts where "view" could be mistaken for a feedbackId
router.get("/feedback/view/:feedbackId", viewFeedbackFile);

router.get("/feedback/:feedbackId/comments", getFeedbackComments);
router.post("/feedback/:feedbackId/comments", addFeedbackComment);
router.put("/feedback/comments/:commentId", updateFeedbackComment);
router.delete("/feedback/comments/:commentId", deleteFeedbackComment);
router.delete("/feedback/:feedbackId", deleteFeedback);

// Consultation schedules
router.get("/schedules", getConsultationSchedules);
router.post("/schedules", createConsultationSlot);
router.put("/schedules/update", updateConsultationSlot);
router.put("/schedules/status", updateConsultationStatus);
router.put("/schedules/cancel", cancelConsultation);
router.delete("/schedules/:scheduleId", deleteConsultationSlot);

// My students
router.get("/students", getMyStudents);

// Panel reviews
router.get("/panels", getMyPanels);
router.post("/panels/:panelId/review", submitPanelReview);
router.get("/panels/:panelId/documents", getPanelDocuments);
router.post("/panels/:panelId/documents", uploadPanelDocumentMiddleware.single("file"), uploadPanelDocument);
router.get("/panels/:panelId/documents/:documentId/download", downloadPanelDocument);
router.get("/panels/:panelId/documents/:documentId", viewPanelDocument);

// Document routes
router.get("/documents", getAvailableDocuments);
router.get("/panel-documents", getMyPanelDocuments);
router.post("/documents", upload.single("file"), uploadDocument);
router.get("/documents/:id", viewDocument);
router.get("/documents/:id/download", downloadDocument);
router.get("/research/:researchId/documents/:docId", viewResearchDocument);
router.get("/research/:researchId/documents/:docId/download", downloadResearchDocument);

export default router;

