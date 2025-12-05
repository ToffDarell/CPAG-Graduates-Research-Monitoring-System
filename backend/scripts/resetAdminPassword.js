import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const resetAdminPassword = async () => {
  try {
    // useNewUrlParser and useUnifiedTopology are deprecated in MongoDB driver 4.0.0+
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const adminEmail = process.env.ADMIN_EMAIL || "admin@buksu.edu.ph";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";

    console.log(`\nResetting password for: ${adminEmail}`);
    console.log(`New password: ${adminPassword}\n`);

    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.error(`❌ Admin user not found: ${adminEmail}`);
      console.log(`   Creating new admin user...`);
      
      await User.create({
        name: "System Administrator",
        email: adminEmail,
        password: adminPassword, // Will be hashed by pre-save hook
        role: "admin",
        isActive: true,
      });
      
      console.log(`✓ Created admin user: ${adminEmail}`);
      console.log(`  Password: ${adminPassword}`);
      console.log(`  ⚠️  IMPORTANT: Change the password after first login!`);
    } else {
      // Reset password - will be hashed by pre-save hook
      admin.password = adminPassword;
      admin.role = "admin";
      admin.isActive = true;
      await admin.save();
      
      console.log(`✓ Password reset successful for: ${adminEmail}`);
      console.log(`  New password: ${adminPassword}`);
      console.log(`  ⚠️  IMPORTANT: Change the password after first login!`);
    }

    console.log("\n✅ Admin password reset completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting admin password:", error);
    process.exit(1);
  }
};

resetAdminPassword();


