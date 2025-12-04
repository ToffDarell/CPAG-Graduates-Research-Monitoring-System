import express from "express";
import { protect, checkAuth } from "../middleware/auth.js";
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  getPermissionsByModule,
  createPermission,
  updatePermission,
  getUsers,
  updateUserRole,
  updateUserProfileByAdmin,
  deleteUser,
  getAllActivityLogs,
  exportActivityLogsPDF,
  inviteDean,
} from "../controllers/adminController.js";

const router = express.Router();

// All admin routes require admin role
router.use(protect);
router.use(checkAuth(["admin"]));

// Role management routes
router.get("/roles", getRoles);
router.get("/roles/:id", getRole);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

// Permission management routes
router.get("/permissions", getPermissions);
router.get("/permissions/module/:module", getPermissionsByModule);
router.post("/permissions", createPermission);
router.put("/permissions/:id", updatePermission);

// User role management
router.get("/users", getUsers);
router.put("/users/:id/role", updateUserRole);
router.put("/users/:id", updateUserProfileByAdmin);
router.delete("/users/:id", deleteUser);

// Dean invitations
router.post("/invite-dean", inviteDean);

// Activity logs
// More specific route must come first
router.get("/activity-logs/export/pdf", exportActivityLogsPDF);
router.post("/activity-logs/export/pdf", exportActivityLogsPDF);
router.get("/activity-logs", getAllActivityLogs);

export default router;


