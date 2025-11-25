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
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role exists
    const roleExists = await Role.findOne({
      name: role.toLowerCase(),
      isActive: true,
    });

    if (!roleExists) {
      return res.status(400).json({ message: "Invalid role" });
    }

    user.role = role.toLowerCase();
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
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Error updating user role" });
  }
};

