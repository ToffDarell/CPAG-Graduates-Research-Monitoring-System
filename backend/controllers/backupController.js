import { 
  createFullBackup, 
  createDatabaseBackup, 
  createUploadsBackup,
  restoreDatabase,
  listBackups,
  cleanOldBackups
} from "../utils/backup.js";
import Activity from "../models/Activity.js";

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
      metadata: { backupTimestamp: backupResult.timestamp }
    }).catch(err => console.error("Error logging backup activity:", err));

    res.json({
      success: true,
      message: "Backup created successfully",
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
      deleted: cleanResult.deleted
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

