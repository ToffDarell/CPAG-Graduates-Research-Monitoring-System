import mongoose from "mongoose";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import dotenv from "dotenv";

dotenv.config();
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || "30"); // Keep 30 days of backups

/**
 * Create backup directory if it doesn't exist
 */
export const ensureBackupDir = async () => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    return BACKUP_DIR;
  } catch (error) {
    console.error("Error creating backup directory:", error);
    throw error;
  }
};

/**
 * Get MongoDB connection string details
 */
const getMongoDBDetails = () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  // Parse MongoDB URI to extract database name
  const match = uri.match(/\/\/(?:[^@]+@)?[^\/]+\/([^?]+)/);
  const dbName = match ? match[1] : "test";

  return { uri, dbName };
};

/**
 * Create MongoDB backup using Mongoose (no external tools required)
 */
const createDatabaseBackupMongoose = async () => {
  try {
    const { connectDB } = await import("../config/db.js");
    await connectDB();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `db-backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    await fs.mkdir(backupPath, { recursive: true });

    console.log(`Starting database backup using Mongoose: ${backupFileName}`);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      database: db.databaseName,
      collections: {}
    };

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`  Backing up collection: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      // Save as JSON file
      const collectionPath = path.join(backupPath, `${collectionName}.json`);
      await fs.writeFile(collectionPath, JSON.stringify(documents, null, 2));
      
      backupData.collections[collectionName] = {
        count: documents.length,
        file: `${collectionName}.json`
      };
    }

    // Save metadata
    const metadataPath = path.join(backupPath, "backup-metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(backupData, null, 2));

    console.log(`Database backup created successfully: ${backupFileName}`);
    console.log(`  Collections backed up: ${collections.length}`);
    
    return { success: true, backupPath, backupFileName, method: "mongoose" };
  } catch (error) {
    console.error("Error creating database backup with Mongoose:", error);
    throw error;
  }
};

/**
 * Create MongoDB backup using mongodump (if available) or fallback to Mongoose
 */
export const createDatabaseBackup = async () => {
  try {
    const { uri, dbName } = getMongoDBDetails();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `db-backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    await ensureBackupDir();

    console.log(`Starting database backup: ${backupFileName}`);

    // Try mongodump first
    try {
      const dumpCommand = `mongodump --uri="${uri}" --out="${backupPath}"`;
      const { stdout, stderr } = await execAsync(dumpCommand);
      
      if (stderr && !stderr.includes("warning")) {
        console.error("Backup stderr:", stderr);
      }

      console.log(`Database backup created successfully using mongodump: ${backupFileName}`);
      return { success: true, backupPath, backupFileName, method: "mongodump" };
    } catch (mongodumpError) {
      // mongodump not available, fallback to Mongoose
      console.log("mongodump not available, using Mongoose-based backup instead...");
      return await createDatabaseBackupMongoose();
    }
  } catch (error) {
    console.error("Error creating database backup:", error);
    throw error;
  }
};

/**
 * Create backup of uploads directory
 */
export const createUploadsBackup = async () => {
  try {
    const uploadsDir = path.join(__dirname, "..", "uploads");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `uploads-backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    await ensureBackupDir();

    // Check if uploads directory exists
    try {
      await fs.access(uploadsDir);
    } catch {
      console.log("Uploads directory does not exist, skipping...");
      return { success: true, skipped: true };
    }

    console.log(`Starting uploads backup: ${backupFileName}`);

    return new Promise((resolve, reject) => {
      const output = fsSync.createWriteStream(backupPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        console.log(`Uploads backup created: ${archive.pointer()} bytes`);
        resolve({ success: true, backupPath, backupFileName, size: archive.pointer() });
      });

      archive.on("error", (err) => {
        console.error("Archive error:", err);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(uploadsDir, false);
      archive.finalize();
    });
  } catch (error) {
    console.error("Error creating uploads backup:", error);
    throw error;
  }
};

/**
 * Create complete backup (database + uploads)
 */
export const createFullBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupMetadata = {
      timestamp: new Date().toISOString(),
      backups: {}
    };

    // Backup database
    const dbBackup = await createDatabaseBackup();
    backupMetadata.backups.database = {
      path: dbBackup.backupPath,
      fileName: dbBackup.backupFileName,
      method: dbBackup.method || "unknown"
    };

    // Backup uploads
    const uploadsBackup = await createUploadsBackup();
    if (!uploadsBackup.skipped) {
      backupMetadata.backups.uploads = {
        path: uploadsBackup.backupPath,
        fileName: uploadsBackup.backupFileName,
        size: uploadsBackup.size
      };
    }

    // Save metadata
    const metadataPath = path.join(BACKUP_DIR, `backup-metadata-${timestamp}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(backupMetadata, null, 2));

    console.log("Full backup completed successfully");
    return {
      success: true,
      timestamp,
      metadata: backupMetadata,
      metadataPath
    };
  } catch (error) {
    console.error("Error creating full backup:", error);
    throw error;
  }
};

/**
 * Restore database from Mongoose-based backup (JSON files)
 */
const restoreDatabaseMongoose = async (backupPath) => {
  try {
    const { connectDB } = await import("../config/db.js");
    await connectDB();

    console.log(`Restoring database from Mongoose backup: ${backupPath}`);

    const backupDir = backupPath;
    const entries = await fs.readdir(backupDir);
    
    // Check if this is a Mongoose backup (has backup-metadata.json)
    const metadataFile = entries.find(e => e === "backup-metadata.json");
    if (!metadataFile) {
      throw new Error("Not a valid Mongoose backup (missing backup-metadata.json)");
    }

    const metadataPath = path.join(backupDir, metadataFile);
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent);

    const db = mongoose.connection.db;

    // Restore each collection
    for (const [collectionName, collectionInfo] of Object.entries(metadata.collections)) {
      console.log(`  Restoring collection: ${collectionName} (${collectionInfo.count} documents)`);
      
      const collectionFilePath = path.join(backupDir, collectionInfo.file);
      const collectionData = await fs.readFile(collectionFilePath, "utf-8");
      const documents = JSON.parse(collectionData);

      const collection = db.collection(collectionName);
      
      // Drop existing collection
      try {
        await collection.drop();
      } catch (error) {
        // Collection might not exist, continue
      }

      // Insert documents
      if (documents.length > 0) {
        await collection.insertMany(documents);
      }
    }

    console.log("Database restored successfully using Mongoose");
    return { success: true, method: "mongoose" };
  } catch (error) {
    console.error("Error restoring database with Mongoose:", error);
    throw error;
  }
};

/**
 * Restore database from backup (tries mongorestore first, falls back to Mongoose)
 */
export const restoreDatabase = async (backupPath) => {
  try {
    const { uri } = getMongoDBDetails();
    
    console.log(`Restoring database from: ${backupPath}`);

    // Determine if this is a directory (Mongoose backup) or metadata file path
    let backupDir;
    let isMongooseBackup = false;

    try {
      const stat = await fs.stat(backupPath);
      if (stat.isDirectory()) {
        backupDir = backupPath;
        // Check if it's a Mongoose backup
        const entries = await fs.readdir(backupPath);
        isMongooseBackup = entries.includes("backup-metadata.json");
      } else {
        // It's a metadata file, get the directory
        backupDir = path.dirname(backupPath);
      }
    } catch (error) {
      throw new Error(`Backup path not found: ${backupPath}`);
    }

    // If Mongoose backup, use Mongoose restore
    if (isMongooseBackup) {
      return await restoreDatabaseMongoose(backupDir);
    }

    // Try mongorestore for mongodump backups
    try {
      const entries = await fs.readdir(backupDir);
      const dbDir = entries.find(entry => {
        const fullPath = path.join(backupDir, entry);
        return fs.stat(fullPath).then(stat => stat.isDirectory());
      });

      if (!dbDir) {
        throw new Error("Database directory not found in backup");
      }

      const restoreCommand = `mongorestore --uri="${uri}" --drop "${path.join(backupDir, dbDir)}"`;
      const { stdout, stderr } = await execAsync(restoreCommand);
      
      if (stderr && !stderr.includes("warning")) {
        console.error("Restore stderr:", stderr);
      }

      console.log("Database restored successfully using mongorestore");
      return { success: true, method: "mongorestore" };
    } catch (mongorestoreError) {
      // mongorestore not available or failed, try Mongoose restore
      console.log("mongorestore not available or failed, trying Mongoose-based restore...");
      return await restoreDatabaseMongoose(backupDir);
    }
  } catch (error) {
    console.error("Error restoring database:", error);
    throw error;
  }
};

/**
 * Clean old backups (keep only MAX_BACKUPS)
 */
export const cleanOldBackups = async () => {
  try {
    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);
    
    // Filter backup files and directories
    const backups = [];
    for (const entry of entries) {
      const fullPath = path.join(BACKUP_DIR, entry);
      try {
        const stat = await fs.stat(fullPath);
        backups.push({
          name: entry,
          path: fullPath,
          mtime: stat.mtime
        });
      } catch (error) {
        console.error(`Error accessing ${entry}:`, error);
      }
    }

    // Sort by modification time (newest first)
    backups.sort((a, b) => b.mtime - a.mtime);

    // Remove backups beyond MAX_BACKUPS
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const backup of toDelete) {
        try {
          const stat = await fs.stat(backup.path);
          if (stat.isDirectory()) {
            await fs.rm(backup.path, { recursive: true, force: true });
          } else {
            await fs.unlink(backup.path);
          }
          console.log(`Deleted old backup: ${backup.name}`);
        } catch (error) {
          console.error(`Error deleting backup ${backup.name}:`, error);
        }
      }
    }

    return { deleted: Math.max(0, backups.length - MAX_BACKUPS) };
  } catch (error) {
    console.error("Error cleaning old backups:", error);
    throw error;
  }
};

/**
 * List all available backups
 */
export const listBackups = async () => {
  try {
    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);
    
    const backups = [];
    for (const entry of entries) {
      const fullPath = path.join(BACKUP_DIR, entry);
      try {
        const stat = await fs.stat(fullPath);
        
        if (entry.startsWith("backup-metadata-")) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const metadata = JSON.parse(content);
            backups.push({
              type: "metadata",
              name: entry,
              path: fullPath,
              timestamp: metadata.timestamp,
              size: stat.size,
              backups: metadata.backups
            });
          } catch (error) {
            console.error(`Error reading metadata file ${entry}:`, error);
          }
        } else if (entry.startsWith("db-backup-")) {
          backups.push({
            type: "database",
            name: entry,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtime
          });
        } else if (entry.startsWith("uploads-backup-")) {
          backups.push({
            type: "uploads",
            name: entry,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      } catch (error) {
        console.error(`Error accessing ${entry}:`, error);
      }
    }

    return backups.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp) : a.mtime;
      const timeB = b.timestamp ? new Date(b.timestamp) : b.mtime;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error listing backups:", error);
    throw error;
  }
};

