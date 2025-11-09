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
  createPanel,
  updatePanelMembers,
  removePanelMember,
  updateSelectedMembers,
  removePanel,
  deletePanel,
  getAvailablePanelists,
  getPanelMonitoring,
  getPanelDetails,
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
  invitePanelist,
  getPanelReviewByToken,
  submitPanelReviewByToken,
  uploadPanelDocument,
  removePanelDocument,
  replacePanelDocument,
  getPanelDocuments,
  downloadPanelDocument,
  getActivityLogs,
  getActivityStats,
  getPanelRecords,
  getPanelRecordDetails,
  exportPanelRecords,
  updatePanelStatus,
  getSchedulesForFinalization,
  finalizeSchedule,
  createPanelSchedule,
  checkScheduleConflicts,
  getPanelDefenseSchedules,
  archiveSchedule,
  getAvailableDocuments,
  downloadDocument,
  viewDocument,
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

// File filter for panel documents (PDF and DOCX only)
const panelDocumentFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword' // .doc (for compatibility)
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed'), false);
  }
};

const upload = multer({ storage });
const uploadPanelDocumentMiddleware = multer({ 
  storage,
  fileFilter: panelDocumentFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Apply authentication middleware to all routes
router.use(protect, checkAuth(["program head"]));

// Panel management
router.get("/panels", getPanelMembers);
router.get("/panels/monitoring", getPanelMonitoring);
router.get("/panels/:id/details", getPanelDetails);
router.get("/panelists", getAvailablePanelists);
router.post("/panels", createPanel);
router.post("/panels/assign", assignPanelMembers);
router.post("/panels/invite", invitePanelist);
router.put("/panels/:id/members", updatePanelMembers);
router.delete("/panels/:id/members", removePanelMember);
router.put("/panels/:id/select-members", updateSelectedMembers);
router.put("/panels/:id/remove", removePanel);
router.delete("/panels/:id", deletePanel);
router.put("/panels/:id/status", updatePanelStatus);

// Panel documents
router.get("/panels/:panelId/documents", getPanelDocuments);
router.post("/panels/:panelId/documents", uploadPanelDocumentMiddleware.single("file"), uploadPanelDocument);
router.get("/panels/:panelId/documents/:documentId/download", downloadPanelDocument);
router.delete("/panels/:panelId/documents/:documentId", removePanelDocument);
router.put("/panels/:panelId/documents/:documentId/replace", uploadPanelDocumentMiddleware.single("file"), replacePanelDocument);

// Schedule management
router.get("/schedules", getSchedules);
router.post("/schedules", createSchedule);
router.put("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);

// Schedule finalization (PROGRAM HEAD – 0007)
router.get("/schedules/pending-finalization", getSchedulesForFinalization);
router.put("/schedules/:scheduleId/finalize", finalizeSchedule);
router.post("/panels/:panelId/schedule", createPanelSchedule);
router.post("/schedules/check-conflicts", checkScheduleConflicts);
router.get("/schedules/panel-defense", getPanelDefenseSchedules);
router.put("/schedules/:id/archive", archiveSchedule);

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

// Activity logs
router.get("/activity-logs", getActivityLogs);
router.get("/activity-stats", getActivityStats);

// Panel Records (PROGRAM HEAD – 0006)
router.get("/panel-records", getPanelRecords);
router.get("/panel-records/:id", getPanelRecordDetails);
router.get("/panel-records/export/csv", exportPanelRecords);

// Document routes
router.get("/documents", getAvailableDocuments);
router.get("/documents/:id", viewDocument);
router.get("/documents/:id/download", downloadDocument);

export default router;