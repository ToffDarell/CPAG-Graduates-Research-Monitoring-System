import express from "express";
import multer from "multer";
import path from "path";
import { protect, checkAuth } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permissions.js";
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
router.use(protect);
router.use(checkAuth(["program head"]));

// Panel management
router.get("/panels", checkPermission("view_research"), getPanelMembers);
router.get("/panels/monitoring", checkPermission("view_research"), getPanelMonitoring);
router.get("/panels/:id/details", checkPermission("view_research"), getPanelDetails);
router.get("/panelists", checkPermission("manage_panels"), getAvailablePanelists);
router.post("/panels", checkPermission("manage_panels"), createPanel);
router.post("/panels/assign", checkPermission("assign_panels"), assignPanelMembers);
router.post("/panels/invite", checkPermission("manage_panels"), invitePanelist);
router.put("/panels/:id/members", checkPermission("manage_panels"), updatePanelMembers);
router.delete("/panels/:id/members", checkPermission("manage_panels"), removePanelMember);
router.put("/panels/:id/select-members", checkPermission("manage_panels"), updateSelectedMembers);
router.put("/panels/:id/remove", checkPermission("manage_panels"), removePanel);
router.delete("/panels/:id", checkPermission("manage_panels"), deletePanel);
router.put("/panels/:id/status", checkPermission("manage_panels"), updatePanelStatus);

// Panel documents
router.get("/panels/:panelId/documents", checkPermission("view_documents"), getPanelDocuments);
router.post("/panels/:panelId/documents", uploadPanelDocumentMiddleware.single("file"), checkPermission("upload_documents"), uploadPanelDocument);
router.get("/panels/:panelId/documents/:documentId/download", checkPermission("download_documents"), downloadPanelDocument);
router.delete("/panels/:panelId/documents/:documentId", checkPermission("delete_documents"), removePanelDocument);
router.put("/panels/:panelId/documents/:documentId/replace", uploadPanelDocumentMiddleware.single("file"), checkPermission("upload_documents"), replacePanelDocument);

// Schedule management
router.get("/schedules", checkPermission("view_schedules"), getSchedules);
router.post("/schedules", checkPermission("manage_schedules"), createSchedule);
router.put("/schedules/:id", checkPermission("manage_schedules"), updateSchedule);
router.delete("/schedules/:id", checkPermission("manage_schedules"), deleteSchedule);

// Schedule finalization (PROGRAM HEAD – 0007)
router.get("/schedules/pending-finalization", checkPermission("view_schedules"), getSchedulesForFinalization);
router.put("/schedules/:scheduleId/finalize", checkPermission("manage_schedules"), finalizeSchedule);
router.post("/panels/:panelId/schedule", checkPermission("manage_schedules"), createPanelSchedule);
router.post("/schedules/check-conflicts", checkPermission("manage_schedules"), checkScheduleConflicts);
router.get("/schedules/panel-defense", checkPermission("view_schedules"), getPanelDefenseSchedules);
router.put("/schedules/:id/archive", checkPermission("manage_schedules"), archiveSchedule);

// Process monitoring
router.get("/monitoring", checkPermission("view_research"), getProcessMonitoring);

// Forms and documents
router.post("/forms", upload.single("file"), checkPermission("upload_documents"), uploadForm);

// Research records
router.get("/research", checkPermission("view_research"), getResearchRecords);

// Faculty adviser management
router.get("/advisers", checkPermission("view_users"), getAvailableAdvisers);
router.post("/assign-adviser", checkPermission("manage_users"), assignAdviser);
router.post("/remove-adviser", checkPermission("manage_users"), removeAdviser);

// Research records management
router.post("/share-with-dean", checkPermission("approve_research"), shareWithDean);
router.put("/archive/:id", checkPermission("archive_research"), archiveResearch);

// Research title and student management
router.post("/research", checkPermission("create_research"), createResearchTitle);
router.get("/students", checkPermission("view_users"), getStudents);
router.post("/research/add-students", checkPermission("manage_users"), addStudentsToResearch);

// Research title management
router.delete("/research/:id", checkPermission("delete_research"), deleteResearchTitle);

// Activity logs
router.get("/activity-logs", checkPermission("view_activity"), getActivityLogs);
router.get("/activity-stats", checkPermission("view_activity"), getActivityStats);

// Panel Records (PROGRAM HEAD – 0006)
router.get("/panel-records", checkPermission("view_research"), getPanelRecords);
router.get("/panel-records/:id", checkPermission("view_research"), getPanelRecordDetails);
router.get("/panel-records/export/csv", checkPermission("export_activity"), exportPanelRecords);

// Document routes
router.get("/documents", checkPermission("view_documents"), getAvailableDocuments);
router.get("/documents/:id", checkPermission("view_documents"), viewDocument);
router.get("/documents/:id/download", checkPermission("download_documents"), downloadDocument);

export default router;