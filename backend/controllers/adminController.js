import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import { uploadFileToDrive } from "../utils/googleDrive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions for Google Drive
const buildDriveTokens = (user) => {
  if (!user) return null;
  // Use decryption methods to get the actual token values
  const accessToken = user.getDecryptedDriveAccessToken ? user.getDecryptedDriveAccessToken() : user.driveAccessToken;
  const refreshToken = user.getDecryptedDriveRefreshToken ? user.getDecryptedDriveRefreshToken() : user.driveRefreshToken;
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: user.driveTokenExpiry ? user.driveTokenExpiry.getTime() : undefined,
  };
};

const applyUpdatedDriveTokens = async (user, credentials) => {
  if (!user || !credentials) return;
  const updates = {};
  if (credentials.access_token && credentials.access_token !== user.driveAccessToken) {
    updates.driveAccessToken = credentials.access_token;
  }
  if (credentials.refresh_token && credentials.refresh_token !== user.driveRefreshToken) {
    updates.driveRefreshToken = credentials.refresh_token;
  }
  if (credentials.expiry_date) {
    updates.driveTokenExpiry = new Date(credentials.expiry_date);
  }
  if (Object.keys(updates).length > 0) {
    await User.findByIdAndUpdate(user._id, updates);
  }
};

// ========== ROLE MANAGEMENT ==========

// Get all roles
export const getRoles = async (req, res) => {   
  try {
    const roles = await Role.find()
      .populate("permissions", "name description module")
      .sort({ name: 1 });

    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Error fetching roles" });
  }
};

// Get single role
export const getRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate(
      "permissions",
      "name description module"
    );

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ message: "Error fetching role" });
  }
};

// Create new role
export const createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({ message: "Name and display name are required" });
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return res.status(400).json({ message: "Role already exists" });
    }

    // Validate permissions
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true,
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ message: "One or more permissions are invalid" });
      }
    }

    const role = await Role.create({
      name: name.toLowerCase(),
      displayName,
      description,
      permissions: permissions || [],
      isSystem: false,
    });

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "settings",
      entityId: role._id,
      entityName: role.displayName,
      description: `Created role: ${role.displayName}`,
    });

    const populatedRole = await Role.findById(role._id).populate(
      "permissions",
      "name description module"
    );

    res.status(201).json(populatedRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ message: "Error creating role" });
  }
};

// Update role
export const updateRole = async (req, res) => {
  try {
    const { displayName, description, permissions, isActive } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent modification of system roles (except isActive)
    if (role.isSystem && req.body.name) {
      return res.status(400).json({ message: "Cannot modify system role name" });
    }

    // Validate permissions
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true,
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ message: "One or more permissions are invalid" });
      }
    }

    // Update fields
    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "settings",
      entityId: role._id,
      entityName: role.displayName,
      description: `Updated role: ${role.displayName}`,
    });

    const populatedRole = await Role.findById(role._id).populate(
      "permissions",
      "name description module"
    );

    res.json(populatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Error updating role" });
  }
};

// Delete role
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (role.isSystem) {
      return res.status(400).json({ message: "Cannot delete system role" });
    }

    // Check if any users are using this role
    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role. ${usersWithRole} user(s) are assigned this role.`,
      });
    }

    await Role.findByIdAndDelete(req.params.id);

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "settings",
      entityId: role._id,
      entityName: role.displayName,
      description: `Deleted role: ${role.displayName}`,
    });

    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Error deleting role" });
  }
};

// ========== PERMISSION MANAGEMENT ==========

// Get all permissions
export const getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ module: 1, name: 1 });
    res.json(permissions);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({ message: "Error fetching permissions" });
  }
};

// Get permissions by module
export const getPermissionsByModule = async (req, res) => {
  try {
    const { module } = req.params;
    const permissions = await Permission.find({
      module: module.toLowerCase(),
      isActive: true,
    }).sort({ name: 1 });

    res.json(permissions);
  } catch (error) {
    console.error("Error fetching permissions by module:", error);
    res.status(500).json({ message: "Error fetching permissions" });
  }
};

// Create permission
export const createPermission = async (req, res) => {
  try {
    const { name, description, module } = req.body;

    if (!name || !module) {
      return res.status(400).json({ message: "Name and module are required" });
    }

    const permission = await Permission.create({
      name: name.toLowerCase(),
      description,
      module: module.toLowerCase(),
    });

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "settings",
      entityId: permission._id,
      entityName: permission.name,
      description: `Created permission: ${permission.name}`,
    });

    res.status(201).json(permission);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Permission already exists" });
    }
    console.error("Error creating permission:", error);
    res.status(500).json({ message: "Error creating permission" });
  }
};

// Update permission
export const updatePermission = async (req, res) => {
  try {
    const { description, isActive } = req.body;
    const permission = await Permission.findById(req.params.id);

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    if (description !== undefined) permission.description = description;
    if (isActive !== undefined) permission.isActive = isActive;

    await permission.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "settings",
      entityId: permission._id,
      entityName: permission.name,
      description: `Updated permission: ${permission.name}`,
    });

    res.json(permission);
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({ message: "Error updating permission" });
  }
};

// ========== USER ROLE MANAGEMENT ==========

// Get all users with roles
export const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { role, version } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent changing role of graduate students (student accounts are fixed)
    if (user.role === "graduate student") {
      return res.status(400).json({
        message: "Student roles cannot be changed. Graduate student accounts must remain as students.",
      });
    }

    // MVCC: Check version for optimistic locking
    if (version === undefined || version === null) {
      return res.status(400).json({ 
        message: 'Version field is required. Please reload the page and try again.' 
      });
    }

    const currentVersion = user.version || 0;
    if (version !== currentVersion) {
      return res.status(409).json({ 
        message: 'This user was updated by another user. Please reload the page to see the latest changes and try again.' 
      });
    }

    // Validate role exists
    const roleExists = await Role.findOne({
      name: role.toLowerCase(),
      isActive: true,
    });

    if (!roleExists) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // MVCC: Increment version
    user.role = role.toLowerCase();
    user.version = currentVersion + 1;
    await user.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "user",
      entityId: user._id,
      entityName: user.name,
      description: `Updated user role to: ${role}`,
    });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      version: user.version || 0,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ 
      message: error.message || "Error updating user role" 
    });
  }
};

// Update user profile (name/email/status) by admin
export const updateUserProfileByAdmin = async (req, res) => {
  try {
    const { name, email, isActive, version } = req.body;
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (version === undefined || version === null) {
      return res.status(400).json({
        message: "Version field is required. Please reload the page and try again.",
      });
    }

    const currentVersion = user.version || 0;
    if (version !== currentVersion) {
      return res.status(409).json({
        message:
          "This user was updated by another user. Please reload the page to see the latest changes and try again.",
      });
    }

    const updateData = {};
    const updatedFields = [];

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: "Name cannot be empty." });
      }
      updateData.name = trimmedName;
      updatedFields.push("name");
    }

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email cannot be empty." });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: "Invalid email format." });
      }

      const emailDomain = normalizedEmail.split("@")[1];
      const isStudent = user.role === "graduate student";
      if (isStudent && emailDomain !== "student.buksu.edu.ph") {
        return res.status(400).json({
          message: "Graduate students must use @student.buksu.edu.ph email address.",
        });
      }
      if (!isStudent && emailDomain !== "buksu.edu.ph") {
        return res.status(400).json({
          message: "Faculty, Dean, and Program Head must use @buksu.edu.ph email address.",
        });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use by another account." });
      }

      updateData.email = normalizedEmail;
      updatedFields.push("email");
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
      updatedFields.push("isActive");
    }

    if (updatedFields.length === 0) {
      return res.status(400).json({ message: "No changes were provided." });
    }

    updateData.version = currentVersion + 1;

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: false,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found after update." });
    }

    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "user",
      entityId: updatedUser._id,
      entityName: updatedUser.name,
      description: `Updated user profile fields: ${updatedFields.join(", ")}`,
      metadata: { updatedFields },
    });

    res.json({
      message: "User profile updated successfully.",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        version: updatedUser.version || 0,
      },
    });
  } catch (error) {
    console.error("Update user profile by admin error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email is already in use by another account." });
    }
    res.status(500).json({
      message: error.message || "Failed to update user profile.",
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting admin users
    if (user.role === "admin") {
      return res.status(400).json({ 
        message: "Cannot delete admin users. Please reassign the role first if needed." 
      });
    }

    // Store user details for activity log before deletion
    const userDetails = {
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "user",
      entityId: req.params.id,
      entityName: userDetails.name,
      description: `Deleted user: ${userDetails.name} (${userDetails.email}) - Role: ${userDetails.role}`,
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Invite dean (admin only)
export const inviteDean = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Enforce @buksu.edu.ph for deans
    const emailDomain = email.split("@")[1];
    if (emailDomain !== "buksu.edu.ph") {
      return res.status(400).json({
        message: "Deans must use @buksu.edu.ph email address",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Generate invitation token
    const crypto = await import("crypto");
    const invitationToken = crypto.default.randomBytes(32).toString("hex");
    const invitationExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Create user with invitation token (no password yet)
    const newUser = new User({
      name,
      email,
      role: "dean",
      invitationToken,
      invitationExpires,
      isActive: false,
      password: "temporary", // Will be replaced when they register
    });
    await newUser.save();

    // Create invitation link (re-use the same flow as faculty invitation)
    const invitationLink = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/register?token=${invitationToken}`;

    // Send email notification (reuse SMTP settings used elsewhere)
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject:
        "Dean Account Invitation - CPAG Masteral Research Archive and Monitoring System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C1D23;">Welcome to CPAG Masteral Research Archive and Monitoring System</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>You have been invited to join as a <strong>Dean</strong> in our system.</p>
          <p>Please click the button below to complete your registration and set your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Complete Registration
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days.</p>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #7C1D23; font-size: 12px; word-break: break-all;">${invitationLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, please ignore this email.</p>
        </div>
      `,
    });

    await Activity.create({
      user: req.user.id,
      action: "invite",
      entityType: "user",
      entityId: newUser._id,
      entityName: newUser.name,
      description: `Invited dean: ${name} (${email})`,
      metadata: { email, role: "dean" },
    });

    res.json({
      message: `Invitation sent successfully to ${email}!`,
      user: { name, email, role: "dean" },
    });
  } catch (error) {
    console.error("Error inviting dean:", error);
    res.status(500).json({ message: "Error inviting dean" });
  }
};

// ========== ACTIVITY LOG MANAGEMENT ==========

export const getAllActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      role = "all",
      action = "all",
      entityType = "all",
      startDate,
      endDate,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

    const filter = {};

    if (action && action !== "all") {
      filter.action = action;
    }

    if (entityType && entityType !== "all") {
      filter.entityType = entityType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Filter by role if provided
    if (role && role !== "all") {
      const roleUsers = await User.find({ role: role.toLowerCase() }).select("_id");
      const roleUserIds = roleUsers.map((u) => u._id);

      if (roleUserIds.length === 0) {
        return res.json({
          logs: [],
          total: 0,
          page: pageNumber,
          totalPages: 0,
        });
      }

      filter.user = { $in: roleUserIds };
    }

    // Search by description/entityName or user info
    if (search) {
      const userMatches = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const searchOr = [
        { description: { $regex: search, $options: "i" } },
        { entityName: { $regex: search, $options: "i" } },
      ];

      if (userMatches.length) {
        searchOr.push({ user: { $in: userMatches.map((u) => u._id) } });
      }

      filter.$or = searchOr;
    }

    const [logs, total] = await Promise.all([
      Activity.find(filter)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Activity.countDocuments(filter),
    ]);

    res.json({
      logs,
      total,
      page: pageNumber,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Error fetching activity logs" });
  }
};

// Helper function to generate PDF content (defined before export function)
const generatePDFContent = (doc, logs, req, filters) => {
  const { search = "", role = "all", action = "all", entityType = "all", startDate, endDate } = filters || {};
  
  // Header with Logo
  const logoPath = path.join(__dirname, "../../frontend/public/logo.jpg");
  const logoExists = fs.existsSync(logoPath);
  
  let headerStartY = doc.page.margins.top;
  doc.y = headerStartY;
  
  // Add logo if it exists (centered at top)
  if (logoExists) {
    try {
      const logoWidth = 70;
      const logoHeight = 70;
      const logoX = (doc.page.width - logoWidth) / 2;
      const logoY = headerStartY;
      
      doc.image(logoPath, logoX, logoY, {
        width: logoWidth,
        height: logoHeight,
      });
      
      headerStartY += logoHeight + 15;
      doc.y = headerStartY;
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  }
  
  doc.font("Helvetica-Bold");
  doc.fontSize(22);
  doc.fillColor("#7C1D23");
  doc.text("BUKIDNON STATE UNIVERSITY", { align: "center" });
  doc.moveDown(0.2);

  doc.font("Helvetica");
  doc.fontSize(12);
  doc.fillColor("#374151");
  doc.text("Malaybalay City, Bukidnon 8700", { align: "center" });
  doc.moveDown(0.2);

  doc.fontSize(10);
  doc.fillColor("#1E40AF");
  doc.text("Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph", {
    align: "center",
  });
  doc.moveDown(0.3);

  doc.font("Helvetica");
  doc.fontSize(13);
  doc.fillColor("#374151");
  doc.text("College of Public Administration and Governance", { align: "center" });
  doc.moveDown(0.5);

  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#7C1D23")
    .lineWidth(2)
    .stroke();

  doc.moveDown(0.8);

  doc.font("Helvetica-Bold");
  doc.fontSize(16);
  doc.fillColor("#111827");
  doc.text("ACTIVITY LOGS REPORT", { align: "center" });
  doc.moveDown(0.5);

  // Info box
  const boxY = doc.y;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(
    doc.page.margins.left,
    boxY,
    pageWidth,
    70
  )
    .fillColor("#F9FAFB")
    .fill()
    .strokeColor("#E5E7EB")
    .lineWidth(1)
    .stroke();

  doc.y = boxY + 10;
  doc.fontSize(10).fillColor("#374151");
  doc.text(`Generated by: ${req.user?.name || "Administrator"}`, doc.page.margins.left + 10);
  doc.moveDown(0.3);
  doc.text(
    `Date Generated: ${new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    })}`,
    doc.page.margins.left + 10
  );
  doc.moveDown(0.3);
  doc.text(`Total Records: ${logs.length}`, doc.page.margins.left + 10);

  // Build filters summary
  const filtersSummary = [];
  if (role && role !== "all") filtersSummary.push(`Role: ${role}`);
  if (action && action !== "all" && typeof action === "string") {
    filtersSummary.push(`Action: ${action.replace(/_/g, " ")}`);
  }
  if (entityType && entityType !== "all" && typeof entityType === "string") {
    filtersSummary.push(`Module: ${entityType.replace(/-/g, " ")}`);
  }
  if (startDate) filtersSummary.push(`From: ${new Date(startDate).toLocaleDateString()}`);
  if (endDate) filtersSummary.push(`To: ${new Date(endDate).toLocaleDateString()}`);
  if (search) filtersSummary.push(`Search: "${search}"`);

  if (filtersSummary.length > 0) {
    doc.moveDown(0.3);
    doc.text(`Filters: ${filtersSummary.join(", ")}`, doc.page.margins.left + 10);
  }

  doc.y = boxY + 80;
  doc.moveDown(0.5);

  // Table headers
  const tableTop = doc.y;
  const colWidths = {
    timestamp: 100,
    user: 90,
    role: 55,
    action: 65,
    module: 75,
    details: pageWidth - 385,
  };

  // Draw header row background
  doc.rect(
    doc.page.margins.left,
    tableTop,
    pageWidth,
    20
  )
    .fillColor("#7C1D23")
    .fill();

  // Header text
  doc.font("Helvetica-Bold").fontSize(9);
  doc.fillColor("#FFFFFF");
  
  let headerX = doc.page.margins.left;
  doc.text("Timestamp", headerX + 5, tableTop + 7, {
    width: colWidths.timestamp - 10,
  });
  headerX += colWidths.timestamp;
  doc.text("User", headerX + 5, tableTop + 7, {
    width: colWidths.user - 10,
  });
  headerX += colWidths.user;
  doc.text("Role", headerX + 5, tableTop + 7, {
    width: colWidths.role - 10,
  });
  headerX += colWidths.role;
  doc.text("Action", headerX + 5, tableTop + 7, {
    width: colWidths.action - 10,
  });
  headerX += colWidths.action;
  doc.text("Module", headerX + 5, tableTop + 7, {
    width: colWidths.module - 10,
  });
  headerX += colWidths.module;
  doc.text("Details", headerX + 5, tableTop + 7, {
    width: colWidths.details - 10,
  });

  let currentY = tableTop + 20;

  // Table rows
  doc.font("Helvetica").fontSize(7).fillColor("#111827");

  if (logs.length === 0) {
    const rowHeight = 30;
    doc.rect(doc.page.margins.left, currentY, pageWidth, rowHeight)
      .fillColor("#F9FAFB")
      .fill()
      .strokeColor("#E5E7EB")
      .lineWidth(0.5)
      .stroke();
    doc.text("No activity logs found for the selected filters.", doc.page.margins.left + 5, currentY + 10);
    currentY += rowHeight;
  } else {
    logs.forEach((log, index) => {
      // Check if we need a new page
      if (currentY > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        currentY = doc.page.margins.top;
        
        // Redraw table headers on new page
        const newTableTop = currentY;
        doc.rect(doc.page.margins.left, newTableTop, pageWidth, 20)
          .fillColor("#7C1D23")
          .fill();
        doc.font("Helvetica-Bold").fontSize(9);
        doc.fillColor("#FFFFFF");
        let newHeaderX = doc.page.margins.left;
        doc.text("Timestamp", newHeaderX + 5, newTableTop + 7, { width: colWidths.timestamp - 10 });
        newHeaderX += colWidths.timestamp;
        doc.text("User", newHeaderX + 5, newTableTop + 7, { width: colWidths.user - 10 });
        newHeaderX += colWidths.user;
        doc.text("Role", newHeaderX + 5, newTableTop + 7, { width: colWidths.role - 10 });
        newHeaderX += colWidths.role;
        doc.text("Action", newHeaderX + 5, newTableTop + 7, { width: colWidths.action - 10 });
        newHeaderX += colWidths.action;
        doc.text("Module", newHeaderX + 5, newTableTop + 7, { width: colWidths.module - 10 });
        newHeaderX += colWidths.module;
        doc.text("Details", newHeaderX + 5, newTableTop + 7, { width: colWidths.details - 10 });
        doc.font("Helvetica").fontSize(8);
        currentY = newTableTop + 20;
      }

      const isEven = index % 2 === 0;
      const rowHeight = 25;
      const padding = 5;
      const textYPos = currentY + 12;

      // Prepare data
      const timestamp = log.createdAt
        ? new Date(log.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }) + " " + new Date(log.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "N/A";
      const userName = log.user?.name || "Unknown";
      const userRole = (log.user?.role && typeof log.user.role === "string") ? log.user.role.replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A";
      const actionText = (log.action && typeof log.action === "string") ? log.action.replace(/_/g, " ") : "N/A";
      const moduleText = (log.entityType && typeof log.entityType === "string") ? log.entityType.replace(/-/g, " ") : "N/A";
      const description = log.description || "No description";
      const entityName = log.entityName || "";
      const fullDetails = entityName ? `${description}${description ? " | " : ""}${entityName}` : description;

      // Draw row background
      doc.rect(doc.page.margins.left, currentY, pageWidth, rowHeight)
        .fillColor(isEven ? "#FFFFFF" : "#F9FAFB")
        .fill()
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .stroke();

      // Draw column separators
      let sepX = doc.page.margins.left;
      [colWidths.timestamp, colWidths.user, colWidths.role, colWidths.action, colWidths.module].forEach((width) => {
        sepX += width;
        doc.moveTo(sepX, currentY)
          .lineTo(sepX, currentY + rowHeight)
          .strokeColor("#E5E7EB")
          .lineWidth(0.5)
          .stroke();
      });

      // Draw text in each column
      doc.font("Helvetica").fontSize(8).fillColor("#000000");
      let textX = doc.page.margins.left + padding;

      const shortTimestamp = log.createdAt
        ? new Date(log.createdAt).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          }) + " " + new Date(log.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "N/A";
      
      doc.fillColor("#000000");
      doc.text(shortTimestamp, textX, textYPos, {
        width: colWidths.timestamp - padding * 2,
        ellipsis: true,
      });
      textX += colWidths.timestamp;

      doc.text(userName || "Unknown", textX, textYPos, {
        width: colWidths.user - padding * 2,
        ellipsis: true,
      });
      textX += colWidths.user;

      doc.text(userRole || "N/A", textX, textYPos, {
        width: colWidths.role - padding * 2,
        ellipsis: true,
      });
      textX += colWidths.role;

      doc.text(actionText || "N/A", textX, textYPos, {
        width: colWidths.action - padding * 2,
        ellipsis: true,
      });
      textX += colWidths.action;

      doc.text(moduleText || "N/A", textX, textYPos, {
        width: colWidths.module - padding * 2,
        ellipsis: true,
      });
      textX += colWidths.module;

      doc.fontSize(7);
      doc.text(fullDetails || "No description", textX, textYPos, {
        width: colWidths.details - padding * 2,
      });
      doc.fontSize(8);

      currentY += rowHeight;
    });
  }

  // Footer
  doc.moveDown(1);
  if (doc.y > doc.page.height - doc.page.margins.bottom - 50) {
    doc.addPage();
  }

  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#E5E7EB")
    .lineWidth(1)
    .stroke();

  doc.moveDown(0.3);
  doc.fontSize(8).fillColor("#6B7280");
  doc.text(
    "This report is automatically generated by the Masteral Archive & Monitoring System.",
    { align: "center" }
  );
  doc.moveDown(0.2);
  doc.fontSize(8).fillColor("#9CA3AF");
  doc.text(
    "Bukidnon State University - College of Public Administration and Governance",
    { align: "center" }
  );

  // Page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#9CA3AF");
    doc.text(
      `Page ${i + 1} of ${pages.count}`,
      doc.page.width / 2 - 30,
      doc.page.height - doc.page.margins.bottom + 10,
      { align: "center" }
    );
  }
};

// Export activity logs as PDF
export const exportActivityLogsPDF = async (req, res) => {
  let tempDirPath = null;
  try {
    const {
      search = "",
      role = "all",
      action = "all",
      entityType = "all",
      startDate,
      endDate,
      saveToDrive = "false",
    } = req.method === "POST" ? req.body : req.query;
    
    const shouldSaveToDrive = saveToDrive === "true" || saveToDrive === true;

    const filter = {};

    if (action && action !== "all") {
      filter.action = action;
    }

    if (entityType && entityType !== "all") {
      filter.entityType = entityType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Filter by role if provided
    if (role && role !== "all") {
      const roleUsers = await User.find({ role: role.toLowerCase() }).select("_id");
      const roleUserIds = roleUsers.map((u) => u._id);

      if (roleUserIds.length > 0) {
        filter.user = { $in: roleUserIds };
      } else {
        // No users with this role, return empty PDF
        filter.user = { $in: [] };
      }
    }

    // Search by description/entityName or user info
    if (search) {
      const userMatches = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const searchOr = [
        { description: { $regex: search, $options: "i" } },
        { entityName: { $regex: search, $options: "i" } },
      ];

      if (userMatches.length) {
        searchOr.push({ user: { $in: userMatches.map((u) => u._id) } });
      }

      filter.$or = searchOr;
    }

    // Fetch all logs matching the filters (no pagination for export)
    const logs = await Activity.find(filter)
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    // Generate PDF buffer using Promise
    const generatePDFBuffer = () => {
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on("error", (error) => {
          console.error("PDF generation error:", error);
          reject(error);
        });
        
        // Generate PDF content (we'll move all PDF generation code here)
        generatePDFContent(doc, logs, req, { search, role, action, entityType, startDate, endDate });
        
        doc.end();
      });
    };

    // Generate PDF buffer
    const pdfBuffer = await generatePDFBuffer();

    // If saving to Google Drive
    if (shouldSaveToDrive) {
      // Get user with drive tokens
      const user = await User.findById(req.user.id);
      if (!user || !user.driveConnected) {
        return res.status(400).json({ 
          message: "Google Drive is not connected. Please connect it in Settings first." 
        });
      }

      const driveTokens = buildDriveTokens(user);
      if (!driveTokens?.access_token) {
        return res.status(400).json({ 
          message: "Unable to read Google Drive credentials. Please reconnect your Drive account." 
        });
      }

      const reportsFolderId =
        process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID ||
        process.env.GOOGLE_DRIVE_ADMIN_REPORTS_FOLDER_ID ||
        null;

      if (!reportsFolderId) {
        return res.status(500).json({ 
          message: "Reports folder ID is not configured. Please set GOOGLE_DRIVE_REPORTS_FOLDER_ID." 
        });
      }

      // Save PDF to temporary file
      tempDirPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "activity-logs-export-"));
      const fileName = `activity-logs-${new Date().toISOString().split("T")[0]}.pdf`;
      const tempFilePath = path.join(tempDirPath, fileName);
      await fs.promises.writeFile(tempFilePath, pdfBuffer);

      // Upload to Google Drive
      let driveFile;
      try {
        console.log("Starting Google Drive upload...", {
          fileName,
          tempFilePath,
          reportsFolderId,
          fileSize: pdfBuffer.length,
        });

        // Verify temp file exists before upload
        const fileStats = await fs.promises.stat(tempFilePath);
        console.log("Temp file exists:", { size: fileStats.size, path: tempFilePath });

        const { file, tokens: updatedTokens } = await uploadFileToDrive(
          tempFilePath,
          fileName,
          "application/pdf",
          driveTokens,
          { parentFolderId: reportsFolderId }
        );

        // Validate upload response
        if (!file || !file.id) {
          console.error("Invalid upload response:", { file });
          throw new Error("Upload succeeded but did not return a valid file ID.");
        }

        console.log("Google Drive upload successful:", {
          fileId: file.id,
          fileName: file.name,
          webViewLink: file.webViewLink,
        });

        driveFile = file;
        await applyUpdatedDriveTokens(user, updatedTokens);
      } catch (driveError) {
        console.error("Failed to upload export to Google Drive:", driveError);
        console.error("Drive error details:", {
          message: driveError.message,
          stack: driveError.stack,
          response: driveError.response?.data,
        });
        
        // Clean up temp file on error
        try {
          await fs.promises.rm(tempDirPath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error("Error cleaning up temp directory after upload failure:", cleanupError);
        }
        
        throw new Error(
          `Failed to upload export to Google Drive: ${driveError.message || "Unknown error"}. Please reconnect your Drive account and try again.`
        );
      }

      // Log activity
      await Activity.create({
        user: req.user.id,
        action: "export",
        entityType: "activity",
        entityName: "Activity Logs PDF",
        description: `Exported activity logs as PDF and saved to Google Drive: ${driveFile?.name || fileName}`,
        metadata: {
          driveFileId: driveFile?.id,
          driveFileLink: driveFile?.webViewLink,
        },
      });

      // Clean up temp file
      try {
        await fs.promises.rm(tempDirPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temp directory:", cleanupError);
      }

      return res.json({
        message: "Activity logs exported as PDF and saved to your Google Drive Reports folder.",
        driveFile: {
          id: driveFile.id,
          name: driveFile.name,
          webViewLink: driveFile.webViewLink,
        },
      });
    }

    // Otherwise, send as download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="activity-logs-${new Date().toISOString().split("T")[0]}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error exporting activity logs PDF:", error);
    console.error("Error stack:", error.stack);
    
    // Clean up temp directory if it exists
    if (tempDirPath) {
      try {
        await fs.promises.rm(tempDirPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temp directory:", cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: error.message || "Error exporting activity logs PDF",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

