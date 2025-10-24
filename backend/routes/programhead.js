import express from "express";
import multer from "multer";
import path from "path";
import { protect, checkAuth } from "../middleware/auth.js";
import Research from "../models/Research.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import {
  getPanelMembers,
  assignPanelMembers,
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getProcessMonitoring,
  uploadForm,
  getResearchRecords,
  getAvailableAdvisers,
  assignAdviser,
  removeAdviser,
  shareWithDean,
  archiveResearch,
  createResearchTitle,
  getStudents,
  addStudentsToResearch,
  deleteResearchTitle,
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

// Apply authentication middleware to all routes
router.use(protect, checkAuth(["program head"]));

// Panel management
router.get("/panels", getPanelMembers);
router.post("/panels/assign", assignPanelMembers);

// Schedule management
router.get("/schedules", getSchedules);
router.post("/schedules", createSchedule);
router.put("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);

// Process monitoring
router.get("/monitoring", getProcessMonitoring);

// Forms and documents
router.post("/forms", upload.single("file"), uploadForm);

// Research records
router.get("/research", getResearchRecords);

// Faculty adviser management
router.get("/advisers", getAvailableAdvisers);
router.post("/assign-adviser", assignAdviser);
router.post("/remove-adviser", removeAdviser);

// Research records management
router.post("/share-with-dean", shareWithDean);
router.put("/archive/:id", archiveResearch);

// Research title and student management
router.post("/research", createResearchTitle);
router.get("/students", getStudents);
router.post("/research/add-students", addStudentsToResearch);

// Research title management
router.delete("/research/:id", deleteResearchTitle);

  export default router;