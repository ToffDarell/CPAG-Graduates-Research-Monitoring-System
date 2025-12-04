import { restoreDatabase, listBackups } from "../utils/backup.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const runRestore = async () => {
  try {
    console.log("=".repeat(50));
    console.log("DATABASE RESTORE UTILITY");
    console.log("=".repeat(50));
    console.log("\n⚠️  WARNING: This will restore the database and may overwrite existing data!");
    console.log("Make sure you have a current backup before proceeding.\n");

    // List available backups
    console.log("Fetching available backups...");
    const backups = await listBackups();
    
    if (backups.length === 0) {
      console.error("\n❌ No backups found!");
      process.exit(1);
    }

    // Filter for metadata backups
    const metadataBackups = backups.filter(b => b.type === "metadata");
    
    if (metadataBackups.length === 0) {
      console.error("\n❌ No full backup metadata found!");
      console.log("Available backups:");
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.name} (${backup.type})`);
      });
      process.exit(1);
    }

    console.log("\nAvailable backups:");
    metadataBackups.forEach((backup, index) => {
      const date = new Date(backup.timestamp).toLocaleString();
      console.log(`  ${index + 1}. ${backup.name}`);
      console.log(`     Timestamp: ${date}`);
      if (backup.backups?.database) {
        console.log(`     Database: ${backup.backups.database.fileName}`);
      }
      if (backup.backups?.uploads) {
        console.log(`     Uploads: ${backup.backups.uploads.fileName}`);
      }
      console.log("");
    });

    // Get user selection
    const selectedIndex = await question(`Select backup to restore (1-${metadataBackups.length}): `);
    const backupIndex = parseInt(selectedIndex) - 1;

    if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= metadataBackups.length) {
      console.error("\n❌ Invalid selection!");
      process.exit(1);
    }

    const selectedBackup = metadataBackups[backupIndex];

    if (!selectedBackup.backups?.database) {
      console.error("\n❌ Selected backup does not contain database backup!");
      process.exit(1);
    }

    const databaseBackupPath = selectedBackup.backups.database.path;

    // Final confirmation
    console.log("\n" + "=".repeat(50));
    console.log("RESTORE CONFIRMATION");
    console.log("=".repeat(50));
    console.log(`Backup: ${selectedBackup.name}`);
    console.log(`Timestamp: ${new Date(selectedBackup.timestamp).toLocaleString()}`);
    console.log(`Database Path: ${databaseBackupPath}`);
    console.log("\n⚠️  This action cannot be undone!");
    
    const confirm = await question("\nType 'RESTORE' to confirm restore: ");
    
    if (confirm !== "RESTORE") {
      console.log("\n❌ Restore cancelled.");
      process.exit(0);
    }

    // Perform restore
    console.log("\n" + "=".repeat(50));
    console.log("Starting database restore...");
    console.log("=".repeat(50));

    await restoreDatabase(databaseBackupPath);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Database restored successfully!");
    console.log("=".repeat(50));

    process.exit(0);
  } catch (error) {
    console.error("\n" + "=".repeat(50));
    console.error("❌ RESTORE FAILED:", error.message);
    console.error("=".repeat(50));
    process.exit(1);
  } finally {
    rl.close();
  }
};

runRestore();

