import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Define all permissions
const permissions = [
  // Document permissions
  { name: "upload_documents", description: "Upload documents", module: "documents" },
  { name: "view_documents", description: "View documents", module: "documents" },
  { name: "download_documents", description: "Download documents", module: "documents" },
  { name: "delete_documents", description: "Delete documents", module: "documents" },
  { name: "approve_documents", description: "Approve documents", module: "documents" },
  { name: "comment_documents", description: "Comment on documents", module: "documents" },

  // Research permissions
  { name: "create_research", description: "Create research projects", module: "research" },
  { name: "view_research", description: "View research projects", module: "research" },
  { name: "edit_research", description: "Edit research projects", module: "research" },
  { name: "delete_research", description: "Delete research projects", module: "research" },
  { name: "approve_research", description: "Approve research projects", module: "research" },
  { name: "archive_research", description: "Archive research projects", module: "research" },
  { name: "delete_submissions", description: "Delete own chapter submissions", module: "research" },

  // User management permissions
  { name: "manage_users", description: "Manage users", module: "users" },
  { name: "invite_users", description: "Invite new users", module: "users" },
  { name: "activate_users", description: "Activate/deactivate users", module: "users" },
  { name: "view_users", description: "View user list", module: "users" },

  // Archive permissions
  { name: "view_archives", description: "View archived items", module: "archives" },
  { name: "delete_archives", description: "Delete archived items", module: "archives" },
  { name: "restore_archives", description: "Restore archived items", module: "archives" },

  // Panel permissions
  { name: "manage_panels", description: "Manage panel assignments", module: "panels" },
  { name: "assign_panels", description: "Assign panels to research", module: "panels" },
  { name: "review_panels", description: "Review panel submissions", module: "panels" },

  // Feedback permissions
  { name: "create_feedback", description: "Create feedback", module: "feedback" },
  { name: "view_feedback", description: "View feedback", module: "feedback" },
  { name: "edit_feedback", description: "Edit feedback", module: "feedback" },
  { name: "delete_feedback", description: "Delete feedback", module: "feedback" },

  // Schedule permissions
  { name: "manage_schedules", description: "Manage schedules", module: "schedules" },
  { name: "view_schedules", description: "View schedules", module: "schedules" },
  { name: "create_schedules", description: "Create schedules", module: "schedules" },

  // Settings permissions
  { name: "manage_settings", description: "Manage system settings", module: "settings" },

  // Activity permissions
  { name: "view_activity", description: "View activity logs", module: "activity" },
  { name: "export_activity", description: "Export activity logs", module: "activity" },

  // Admin permissions
  { name: "manage_roles", description: "Manage roles and permissions", module: "admin" },
  { name: "manage_rbac", description: "Manage RBAC system", module: "admin" },
];

const seedRBAC = async () => {
  try {
    // useNewUrlParser and useUnifiedTopology are deprecated in MongoDB driver 4.0.0+
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding");

    // Clear existing permissions and roles (optional - comment out if you want to preserve)
    // await Permission.deleteMany({});
    // await Role.deleteMany({ name: { $ne: "admin" } }); // Keep admin role

    // Create permissions
    console.log("Creating permissions...");
    const createdPermissions = {};
    for (const perm of permissions) {
      const existing = await Permission.findOne({ name: perm.name });
      if (!existing) {
        const created = await Permission.create(perm);
        createdPermissions[perm.name] = created._id;
        console.log(`✓ Created permission: ${perm.name}`);
      } else {
        createdPermissions[perm.name] = existing._id;
        console.log(`- Permission already exists: ${perm.name}`);
      }
    }

    // Create roles with permissions
    console.log("\nCreating roles...");

    // Admin role - has all permissions
    const adminPermissions = Object.values(createdPermissions);
    const adminRole = await Role.findOneAndUpdate(
      { name: "admin" },
      {
        name: "admin",
        displayName: "Administrator",
        description: "Full system access",
        permissions: adminPermissions,
        isSystem: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Created/Updated admin role with ${adminPermissions.length} permissions`);

    // Dean role
    const deanPermissions = [
      createdPermissions["view_documents"],
      createdPermissions["download_documents"],
      createdPermissions["approve_documents"],
      createdPermissions["comment_documents"],
      createdPermissions["view_research"],
      createdPermissions["approve_research"],
      createdPermissions["archive_research"],
      createdPermissions["manage_users"],
      createdPermissions["invite_users"],
      createdPermissions["activate_users"],
      createdPermissions["view_users"],
      createdPermissions["view_archives"],
      createdPermissions["restore_archives"],
      createdPermissions["manage_panels"],
      createdPermissions["assign_panels"],
      createdPermissions["view_feedback"],
      createdPermissions["manage_schedules"],
      createdPermissions["view_schedules"],
      createdPermissions["view_activity"],
    ].filter(Boolean);

    await Role.findOneAndUpdate(
      { name: "dean" },
      {
        name: "dean",
        displayName: "Dean",
        description: "Dean role with comprehensive access",
        permissions: deanPermissions,
        isSystem: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Created/Updated dean role with ${deanPermissions.length} permissions`);

    // Faculty Adviser role
    const facultyPermissions = [
      createdPermissions["view_documents"],
      createdPermissions["download_documents"],
      createdPermissions["comment_documents"],
      createdPermissions["view_research"],
      createdPermissions["create_feedback"],
      createdPermissions["view_feedback"],
      createdPermissions["edit_feedback"],
      createdPermissions["manage_schedules"],
      createdPermissions["view_schedules"],
      createdPermissions["create_schedules"],
      createdPermissions["review_panels"],
    ].filter(Boolean);

    await Role.findOneAndUpdate(
      { name: "faculty adviser" },
      {
        name: "faculty adviser",
        displayName: "Faculty Adviser",
        description: "Faculty adviser role",
        permissions: facultyPermissions,
        isSystem: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Created/Updated faculty adviser role with ${facultyPermissions.length} permissions`);

    // Program Head role
    const programHeadPermissions = [
      createdPermissions["view_documents"],
      createdPermissions["download_documents"],
      createdPermissions["approve_documents"],
      createdPermissions["comment_documents"],
      createdPermissions["view_research"],
      createdPermissions["approve_research"],
      createdPermissions["view_archives"],
      createdPermissions["manage_panels"],
      createdPermissions["review_panels"],
      createdPermissions["view_feedback"],
      createdPermissions["view_activity"],
    ].filter(Boolean);

    await Role.findOneAndUpdate(
      { name: "program head" },
      {
        name: "program head",
        displayName: "Program Head",
        description: "Program head role",
        permissions: programHeadPermissions,
        isSystem: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Created/Updated program head role with ${programHeadPermissions.length} permissions`);

    // Graduate Student role
    const studentPermissions = [
      createdPermissions["upload_documents"],
      createdPermissions["view_documents"],
      createdPermissions["download_documents"],
      createdPermissions["create_research"],
      createdPermissions["view_research"],
      createdPermissions["edit_research"],
      createdPermissions["view_feedback"],
      createdPermissions["view_schedules"],
      createdPermissions["delete_submissions"],
    ].filter(Boolean);

    await Role.findOneAndUpdate(
      { name: "graduate student" },
      {
        name: "graduate student",
        displayName: "Graduate Student",
        description: "Graduate student role",
        permissions: studentPermissions,
        isSystem: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Created/Updated graduate student role with ${studentPermissions.length} permissions`);

    // Create default admin user
    console.log("\nCreating default admin user...");
    const adminEmail = process.env.ADMIN_EMAIL || "admin@buksu.edu.ph";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
    const forcePasswordReset = process.env.FORCE_ADMIN_PASSWORD_RESET === "true";

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      // Create new admin user - password will be hashed by pre-save hook
      await User.create({
        name: "System Administrator",
        email: adminEmail,
        password: adminPassword, // Will be hashed automatically by User model
        role: "admin",
        isActive: true,
      });
      console.log(`✓ Created admin user: ${adminEmail}`);
      console.log(`  Default password: ${adminPassword}`);
      console.log(`  ⚠️  IMPORTANT: Change the password after first login!`);
    } else {
      // Update existing user to admin role and optionally reset password
      let updated = false;
      
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        updated = true;
      }
      
      // Reset password if forced or if password seems wrong (check if it's a valid bcrypt hash)
      if (forcePasswordReset || !existingAdmin.password || existingAdmin.password.length < 20) {
        existingAdmin.password = adminPassword; // Will be hashed by pre-save hook
        updated = true;
        console.log(`✓ Reset password for admin user: ${adminEmail}`);
        console.log(`  New password: ${adminPassword}`);
      }
      
      if (existingAdmin.isActive !== true) {
        existingAdmin.isActive = true;
        updated = true;
      }
      
      if (updated) {
        await existingAdmin.save();
        console.log(`✓ Updated admin user: ${adminEmail}`);
      } else {
        console.log(`- Admin user already exists: ${adminEmail}`);
        console.log(`  To force password reset, set FORCE_ADMIN_PASSWORD_RESET=true in .env`);
      }
    }

    console.log("\n✅ RBAC seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding RBAC:", error);
    process.exit(1);
  }
};

seedRBAC();

