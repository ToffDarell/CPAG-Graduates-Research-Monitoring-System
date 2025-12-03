import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";

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

