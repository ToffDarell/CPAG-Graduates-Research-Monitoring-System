import cron from "node-cron";
import { createFullBackup, cleanOldBackups } from "../utils/backup.js";

// Schedule backup daily at 2 AM
// Format: minute hour day month dayOfWeek
const BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || "0 2 * * *"; // Default: 2 AM daily

let backupJob = null;

export const startBackupScheduler = () => {
  if (backupJob) {
    console.log("Backup scheduler already running");
    return;
  }

  console.log(`Starting backup scheduler with schedule: ${BACKUP_SCHEDULE}`);
  
  backupJob = cron.schedule(BACKUP_SCHEDULE, async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled backup...`);
      
      const backupResult = await createFullBackup();
      console.log(`[${new Date().toISOString()}] Scheduled backup completed: ${backupResult.timestamp}`);
      
      // Clean old backups after successful backup
      await cleanOldBackups();
      
      console.log(`[${new Date().toISOString()}] Backup cleanup completed`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Scheduled backup failed:`, error);
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || "Asia/Manila"
  });

  console.log("Backup scheduler started successfully");
};

export const stopBackupScheduler = () => {
  if (backupJob) {
    backupJob.stop();
    backupJob = null;
    console.log("Backup scheduler stopped");
  }
};

export const getBackupSchedule = () => {
  return BACKUP_SCHEDULE;
};

