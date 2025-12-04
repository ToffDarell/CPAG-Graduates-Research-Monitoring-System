import mongoose from "mongoose";
import User from "../models/User.js";
import { encryptOAuthToken, isEncrypted } from "../utils/encryption.js";
import { connectDB } from "../config/db.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const encryptExistingTokens = async () => {
  try {
    console.log("Connecting to database...");
    await connectDB();

    console.log("\nFinding users with unencrypted OAuth tokens...");
    const users = await User.find({
      $or: [
        { googleAccessToken: { $exists: true, $ne: null } },
        { googleRefreshToken: { $exists: true, $ne: null } },
        { driveAccessToken: { $exists: true, $ne: null } },
        { driveRefreshToken: { $exists: true, $ne: null } },
        { sheetsAccessToken: { $exists: true, $ne: null } },
        { sheetsRefreshToken: { $exists: true, $ne: null } }
      ]
    });

    console.log(`Found ${users.length} users with OAuth tokens to encrypt\n`);

    let encrypted = 0;
    let skipped = 0;

    for (const user of users) {
      let updated = false;

      // Check and encrypt Google Calendar tokens
      if (user.googleAccessToken && !isEncrypted(user.googleAccessToken)) {
        user.googleAccessToken = encryptOAuthToken(user.googleAccessToken);
        updated = true;
      }
      if (user.googleRefreshToken && !isEncrypted(user.googleRefreshToken)) {
        user.googleRefreshToken = encryptOAuthToken(user.googleRefreshToken);
        updated = true;
      }

      // Check and encrypt Google Drive tokens
      if (user.driveAccessToken && !isEncrypted(user.driveAccessToken)) {
        user.driveAccessToken = encryptOAuthToken(user.driveAccessToken);
        updated = true;
      }
      if (user.driveRefreshToken && !isEncrypted(user.driveRefreshToken)) {
        user.driveRefreshToken = encryptOAuthToken(user.driveRefreshToken);
        updated = true;
      }

      // Check and encrypt Google Sheets tokens
      if (user.sheetsAccessToken && !isEncrypted(user.sheetsAccessToken)) {
        user.sheetsAccessToken = encryptOAuthToken(user.sheetsAccessToken);
        updated = true;
      }
      if (user.sheetsRefreshToken && !isEncrypted(user.sheetsRefreshToken)) {
        user.sheetsRefreshToken = encryptOAuthToken(user.sheetsRefreshToken);
        updated = true;
      }

      if (updated) {
        await user.save({ validateBeforeSave: false });
        encrypted++;
        console.log(`✓ Encrypted tokens for user: ${user.email}`);
      } else {
        skipped++;
        console.log(`- Skipped (already encrypted): ${user.email}`);
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ Migration complete!`);
    console.log(`   Encrypted: ${encrypted} users`);
    console.log(`   Skipped: ${skipped} users (already encrypted)`);
    console.log("=".repeat(60) + "\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration error:", error);
    process.exit(1);
  }
};

encryptExistingTokens();

