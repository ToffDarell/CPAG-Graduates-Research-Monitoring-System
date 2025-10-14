import express from "express";
import multer from "multer";
import path from "path";
import { protect, checkAuth } from "../middleware/auth.js";
import {
  getStudentSubmissions,
  updateThesisStatus,
  approveRejectSubmission,
  uploadFeedback,
  getConsultationSchedules,
  getMyStudents,
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

// Consultation schedules
router.get("/schedules", getConsultationSchedules);

// My students
router.get("/students", getMyStudents);

export default router;

