import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { protect, checkAuth } from "../middleware/auth.js";
import Research from "../models/Research.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import { 
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
  getChapterSubmissions,
  getProgressOverview,
  getDriveStatus,
  getMyResearch,
  getMySchedules,
  getAdviserFeedback,
  viewFeedbackFile,
  getFeedbackComments,
  exportScheduleICS
} from "../controllers/studentController.js";

const router = express.Router();

// JWT Token Generator
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

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
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user by email (instead of username)
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Return user data using name instead of username
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

// Schedule routes
router.get("/schedules", getMySchedules);
router.get("/schedules/:id/export-ics", exportScheduleICS);
router.get("/feedback", getAdviserFeedback);
router.get("/feedback/view/:feedbackId", viewFeedbackFile);
router.get("/feedback/:feedbackId/comments", getFeedbackComments);

// Get available consultation slots from adviser
router.get("/available-slots", async (req, res) => {
  try {
    if (req.user.level !== "graduate") {
      return res.status(403).json({ message: "Only graduate students can view available slots." });
    }

    // Find student's research to get their adviser
    const research = await Research.findOne({ students: req.user._id })
      .populate("adviser", "name email");

    if (!research || !research.adviser) {
      return res.json({ message: "You don't have an assigned adviser yet.", slots: [] });
    }

    // Find available consultation slots (no student assigned yet or status is 'scheduled')
    const availableSlots = await Schedule.find({
      "participants.user": research.adviser._id,
      "participants.role": "adviser",
      type: "consultation",
      datetime: { $gte: new Date() }, // Only future slots
      status: "scheduled",
      $or: [
        { "participants.1": { $exists: false } }, // No student participant yet
        { "participants.role": { $ne: "student" } } // No student role in participants
      ]
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });

    res.json({ adviser: research.adviser, slots: availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ message: error.message });
  }
});

// Request consultation
router.post("/request-consultation", async (req, res) => {
  try {
    if (req.user.level !== "graduate") {
      return res.status(403).json({ message: "Only graduate students can request consultations." });
    }

    const { scheduleId, message } = req.body;

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Check if slot is still available
    const hasStudent = schedule.participants.some(p => p.role === "student");
    if (hasStudent) {
      return res.status(400).json({ message: "This slot has already been requested by another student." });
    }

    // Check if schedule is in the past
    if (new Date(schedule.datetime) < new Date()) {
      return res.status(400).json({ message: "Cannot request past consultation slots." });
    }

    // Add student as participant
    schedule.participants.push({
      user: req.user._id,
      role: "student",
      status: "invited"
    });

    await schedule.save();

    // TODO: Send notification to adviser about the request

    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email");

    res.json({ 
      message: "Consultation request submitted successfully. Your adviser will review it soon.", 
      schedule: updatedSchedule 
    });
  } catch (error) {
    console.error("Error requesting consultation:", error);
    res.status(500).json({ message: error.message });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  // Invalidate token client-side or manage session
  res.json({ message: "Graduate student logged out successfully" });
});

// Document routes
router.get("/documents", getAvailableDocuments);
router.get("/documents/:id", viewDocument);
router.get("/documents/:id/download", downloadDocument);

export default router;

