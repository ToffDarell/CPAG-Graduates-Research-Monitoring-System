import { createFullBackup, cleanOldBackups } from "../utils/backup.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const runBackup = async () => {
  try {
    console.log("=".repeat(50));
    console.log("Starting automated backup process...");
    console.log("=".repeat(50));

    // Create full backup
    const backupResult = await createFullBackup();
    
    console.log("\nBackup completed successfully!");
    console.log("Timestamp:", backupResult.timestamp);
    console.log("Metadata saved at:", backupResult.metadataPath);

    // Clean old backups
    console.log("\nCleaning old backups...");
    const cleanResult = await cleanOldBackups();
    if (cleanResult.deleted > 0) {
      console.log(`Deleted ${cleanResult.deleted} old backup(s)`);
    } else {
      console.log("No old backups to delete");
    }

    console.log("\n" + "=".repeat(50));
    console.log("Backup process completed successfully!");
    console.log("=".repeat(50));
    
    process.exit(0);
  } catch (error) {
    console.error("\n" + "=".repeat(50));
    console.error("BACKUP FAILED:", error.message);
    console.error("=".repeat(50));
    process.exit(1);
  }
};

runBackup();

