import { 
  createFullBackup, 
  createDatabaseBackup, 
  createUploadsBackup,
  restoreDatabase,
  listBackups,
  cleanOldBackups,
  deleteAllBackups
} from "../utils/backup.js";
import Activity from "../models/Activity.js";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");
const isManagedBackupEntry = (entryName = "") =>
  entryName.startsWith("backup-metadata-") ||
  entryName.startsWith("db-backup-") ||
  entryName.startsWith("uploads-backup-");

/**
 * Create full backup (database + uploads)
 */
export const createBackup = async (req, res) => {
  try {
    const backupResult = await createFullBackup();
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "settings",
      entityName: "Full Backup",
      description: `Created full backup: ${backupResult.timestamp}`,
      metadata: {
        backupTimestamp: backupResult.timestamp,
        hasWarning: Boolean(backupResult.hasWarning),
        warningMessages: backupResult.warningMessages || []
      }
    }).catch(err => console.error("Error logging backup activity:", err));

    res.json({
      success: true,
      message: backupResult.hasWarning
        ? "Backup created with warnings"
        : "Backup created successfully",
      hasWarning: Boolean(backupResult.hasWarning),
      warningMessages: backupResult.warningMessages || [],
      backup: backupResult
    });
  } catch (error) {
    console.error("Backup creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create backup",
      error: error.message
    });
  }
};

/**
 * Create database backup only
 */
export const createDatabaseBackupOnly = async (req, res) => {
  try {
    const backupResult = await createDatabaseBackup();
    
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "settings",
      entityName: "Database Backup",
      description: `Created database backup: ${backupResult.backupFileName}`
    }).catch(err => console.error("Error logging backup activity:", err));

    res.json({
      success: true,
      message: "Database backup created successfully",
      backup: backupResult
    });
  } catch (error) {
    console.error("Database backup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create database backup",
      error: error.message
    });
  }
};

/**
 * Create uploads backup only
 */
export const createUploadsBackupOnly = async (req, res) => {
  try {
    const backupResult = await createUploadsBackup();
    
    if (backupResult.skipped) {
      return res.json({
        success: true,
        message: "Uploads directory not found, backup skipped",
        backup: backupResult
      });
    }
    
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "settings",
      entityName: "Uploads Backup",
      description: `Created uploads backup: ${backupResult.backupFileName}`
    }).catch(err => console.error("Error logging backup activity:", err));

    res.json({
      success: true,
      message: "Uploads backup created successfully",
      backup: backupResult
    });
  } catch (error) {
    console.error("Uploads backup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create uploads backup",
      error: error.message
    });
  }
};

/**
 * List all backups
 */
export const getBackups = async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({
      success: true,
      backups,
      count: backups.length
    });
  } catch (error) {
    console.error("List backups error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list backups",
      error: error.message
    });
  }
};

/**
 * Restore from backup
 */
export const restoreFromBackup = async (req, res) => {
  try {
    const { backupPath } = req.body;
    
    if (!backupPath) {
      return res.status(400).json({
        success: false,
        message: "backupPath is required"
      });
    }

    // WARNING: This will restore the database - should have confirmation
    const restoreResult = await restoreDatabase(backupPath);
    
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "settings",
      entityName: "Database Restore",
      description: `Restored database from backup: ${backupPath}`,
      metadata: { backupPath }
    }).catch(err => console.error("Error logging restore activity:", err));

    res.json({
      success: true,
      message: "Database restored successfully",
      restore: restoreResult
    });
  } catch (error) {
    console.error("Restore error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore database",
      error: error.message
    });
  }
};

/**
 * Clean old backups
 */
export const cleanBackups = async (req, res) => {
  try {
    const cleanResult = await cleanOldBackups();
    
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "settings",
      entityName: "Backup Cleanup",
      description: `Cleaned old backups: ${cleanResult.deleted} deleted`
    }).catch(err => console.error("Error logging cleanup activity:", err));

    res.json({
      success: true,
      message: "Old backups cleaned successfully",
      deleted: cleanResult.deleted,
      failed: cleanResult.failed || [],
      retentionDays: cleanResult.retentionDays
    });
  } catch (error) {
    console.error("Clean backups error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clean old backups",
      error: error.message
    });
  }
};

/**
 * Delete all managed backups
 */
export const deleteAllManagedBackups = async (req, res) => {
  try {
    const result = await deleteAllBackups();

    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "settings",
      entityName: "Delete All Backups",
      description: `Deleted all backups: ${result.deleted} deleted`,
      metadata: { deleted: result.deleted, failed: result.failed || [] }
    }).catch(err => console.error("Error logging delete-all backup activity:", err));

    res.json({
      success: true,
      message: "All backups deleted successfully",
      deleted: result.deleted,
      failed: result.failed || []
    });
  } catch (error) {
    console.error("Delete all backups error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete all backups",
      error: error.message
    });
  }
};

/**
 * Download a full backup package by metadata file name
 */
export const downloadBackup = async (req, res) => {
  try {
    const { metadataFile, backupName } = req.query;

    // Legacy/full-backup path: package using metadata record.
    if (metadataFile) {
      const safeMetadataFile = path.basename(metadataFile);
      if (!safeMetadataFile.startsWith("backup-metadata-") || !safeMetadataFile.endsWith(".json")) {
        return res.status(400).json({
          success: false,
          message: "Invalid metadata file"
        });
      }

      const metadataPath = path.join(BACKUP_DIR, safeMetadataFile);
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);

      const timestamp = safeMetadataFile
        .replace("backup-metadata-", "")
        .replace(".json", "");
      const downloadName = `full-backup-${timestamp}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename=\"${downloadName}\"`);

      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        console.error("Backup download archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Failed to build backup archive" });
        } else {
          res.end();
        }
      });

      archive.pipe(res);

      // Always include metadata file
      archive.file(metadataPath, { name: `metadata/${safeMetadataFile}` });

      // Include database backup path if present
      const databasePath = metadata?.backups?.database?.path;
      if (databasePath) {
        try {
          const dbStat = await fs.stat(databasePath);
          if (dbStat.isDirectory()) {
            archive.directory(databasePath, `database/${path.basename(databasePath)}`);
          } else {
            archive.file(databasePath, { name: `database/${path.basename(databasePath)}` });
          }
        } catch (error) {
          console.warn("Database backup path missing during download:", databasePath);
        }
      }

      // Include uploads backup path if present
      const uploadsPath = metadata?.backups?.uploads?.path;
      if (uploadsPath) {
        try {
          const uploadsStat = await fs.stat(uploadsPath);
          if (uploadsStat.isDirectory()) {
            archive.directory(uploadsPath, `uploads/${path.basename(uploadsPath)}`);
          } else {
            archive.file(uploadsPath, { name: `uploads/${path.basename(uploadsPath)}` });
          }
        } catch (error) {
          console.warn("Uploads backup path missing during download:", uploadsPath);
        }
      }

      await archive.finalize();
      return;
    }

    // Direct file/folder backup download path (uploads/database entry rows).
    if (!backupName) {
      return res.status(400).json({
        success: false,
        message: "metadataFile or backupName is required"
      });
    }

    const safeBackupName = path.basename(backupName);
    if (!isManagedBackupEntry(safeBackupName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid backup name"
      });
    }

    const targetPath = path.join(BACKUP_DIR, safeBackupName);
    const targetStat = await fs.stat(targetPath);

    if (targetStat.isDirectory()) {
      const downloadName = `${safeBackupName}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename=\"${downloadName}\"`);

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (err) => {
        console.error("Direct backup download archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Failed to build backup archive" });
        } else {
          res.end();
        }
      });

      archive.pipe(res);
      archive.directory(targetPath, safeBackupName);
      await archive.finalize();
      return;
    }

    res.download(targetPath, safeBackupName);
  } catch (error) {
    console.error("Download backup error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to download backup",
        error: error.message
      });
    }
  }
};

