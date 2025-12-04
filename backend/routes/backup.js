import express from "express";
import { protect, checkAuth } from "../middleware/auth.js";
import {
  createBackup,
  createDatabaseBackupOnly,
  createUploadsBackupOnly,
  getBackups,
  restoreFromBackup,
  cleanBackups
} from "../controllers/backupController.js";

const router = express.Router();

// All backup routes require admin authentication
router.use(protect);
router.use(checkAuth(["admin"]));

// Create full backup
router.post("/create", createBackup);

// Create database backup only
router.post("/database", createDatabaseBackupOnly);

// Create uploads backup only
router.post("/uploads", createUploadsBackupOnly);

// List all backups
router.get("/list", getBackups);

// Restore from backup
router.post("/restore", restoreFromBackup);

// Clean old backups
router.post("/clean", cleanBackups);

export default router;

