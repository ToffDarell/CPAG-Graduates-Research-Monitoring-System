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
  downloadDocument,
  viewDocument,
} from "../controllers/facultyController.js";

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
router.use(protect, checkAuth(["faculty adviser"]));

// Student submissions
router.get("/submissions", getStudentSubmissions);

// Thesis status management
router.put("/thesis/:id/status", updateThesisStatus);

// Approve/reject submissions
router.post("/submissions/approve-reject", approveRejectSubmission);

// Feedback management
router.post("/feedback", upload.single("file"), uploadFeedback);
router.get("/feedback", getAllFeedback);
router.get("/feedback/research/:researchId", getFeedbackByResearch);
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

// Document routes
router.get("/documents", getAvailableDocuments);
router.get("/documents/:id", viewDocument);
router.get("/documents/:id/download", downloadDocument);

export default router;

