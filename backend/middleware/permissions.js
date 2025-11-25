import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import { protect } from "./auth.js";

/**
 * Middleware to check if user has required permission(s)
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions
 * @param {string} strategy - 'any' (default) or 'all' - check any one or all permissions
 */
export const checkPermission = (requiredPermissions, strategy = "any") => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated (should be called after protect middleware)
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Admin has full access
      if (req.user.role === "admin") {
        return next();
      }

      // Convert single permission to array
      const permissionsArray = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Get user's role with permissions
      const userRole = await Role.findOne({
        name: req.user.role.toLowerCase(),
        isActive: true,
      }).populate("permissions");

      if (!userRole || !userRole.permissions || userRole.permissions.length === 0) {
        return res.status(403).json({
          message: "Access denied. No permissions assigned to your role.",
        });
      }

      // Extract permission names
      const userPermissionNames = userRole.permissions
        .filter((p) => p.isActive)
        .map((p) => p.name);

      // Check permissions based on strategy
      let hasAccess = false;

      if (strategy === "all") {
        // User must have ALL required permissions
        hasAccess = permissionsArray.every((perm) =>
          userPermissionNames.includes(perm.toLowerCase())
        );
      } else {
        // User must have ANY of the required permissions (default)
        hasAccess = permissionsArray.some((perm) =>
          userPermissionNames.includes(perm.toLowerCase())
        );
      }

      if (!hasAccess) {
        // Get friendly permission names for the message
        const allPermissions = await Permission.find({ 
          name: { $in: permissionsArray.map(p => p.toLowerCase()) }
        });
        
        // Convert permission names to friendly display names
        const permissionDisplayNames = allPermissions.length > 0
          ? allPermissions.map(p => 
              p.name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
            )
          : permissionsArray.map(p => 
              p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
            );

        return res.status(403).json({
          message: `This feature has been disabled by the administrator. Required permission(s): ${permissionDisplayNames.join(", ")}`,
          code: "PERMISSION_DENIED",
          permissions: permissionsArray,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Error checking permissions" });
    }
  };
};

/**
 * Combined middleware: protect + checkPermission
 */
export const rolePermissionMiddleware = (requiredPermissions, strategy = "any") => {
  return [protect, checkPermission(requiredPermissions, strategy)];
};

/**
 * Helper to check if user has a specific permission (for use in controllers)
 */
export const hasPermission = async (userRole, permissionName) => {
  if (!userRole || userRole === "admin") {
    return userRole === "admin"; // Admin has all permissions
  }

  try {
    const role = await Role.findOne({
      name: userRole.toLowerCase(),
      isActive: true,
    }).populate("permissions");

    if (!role || !role.permissions) return false;

    const permissionNames = role.permissions
      .filter((p) => p.isActive)
      .map((p) => p.name);

    return permissionNames.includes(permissionName.toLowerCase());
  } catch (error) {
    console.error("hasPermission error:", error);
    return false;
  }
};

