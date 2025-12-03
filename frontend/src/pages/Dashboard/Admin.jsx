import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  FaUsers, 
  FaShieldAlt, 
  FaKey, 
  FaEdit, 
  FaTrash, 
  FaPlus, 
  FaSave, 
  FaTimes, 
  FaSignOutAlt,
  FaSearch,
  FaFilter,
  FaChartBar,
  FaCog,
  FaUsersCog,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaExclamationTriangle,
  FaHistory,
  FaUserShield,
  FaEnvelope,
} from "react-icons/fa";
import { showSuccess, showError, showConfirm, showWarning } from "../../utils/sweetAlert";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin.includes("localhost:5173")
    ? "http://localhost:5000"
    : "");

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

const ACTIVITY_ACTIONS = [
  "upload",
  "delete",
  "archive",
  "restore",
  "download",
  "view",
  "create",
  "update",
  "approve",
  "reject",
  "invite",
  "activate",
  "deactivate",
  "assign",
  "remove",
  "share",
  "send_email",
  "add_remark",
  "export",
];

const ACTIVITY_ENTITY_TYPES = [
  "document",
  "research",
  "user",
  "panel",
  "feedback",
  "settings",
  "email",
  "schedule",
  "complianceForm",
  "progress-dashboard",
];

const VALID_ADMIN_TABS = ["dashboard", "roles", "permissions", "users", "activity"];

const Admin = ({ user, setUser }) => {
  const navigate = useNavigate();
  const getInitialTab = () => {
    const saved = localStorage.getItem("adminActiveTab");
    return VALID_ADMIN_TABS.includes(saved) ? saved : "dashboard";
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    displayName: "",
    description: "",
    permissions: [],
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    isActive: true,
  });
  const [editUserSaving, setEditUserSaving] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRoles: 0,
    activeRoles: 0,
    totalPermissions: 0
  });

  // Activity logs
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityMeta, setActivityMeta] = useState({ total: 0, totalPages: 0 });
  const [activityFilters, setActivityFilters] = useState({
    search: "",
    role: "all",
    action: "all",
    entityType: "all",
  });

  // Invite Dean form state
  const [inviteDeanForm, setInviteDeanForm] = useState({
    name: "",
    email: "",
  });
  const [invitingDean, setInvitingDean] = useState(false);

  useEffect(() => {
    localStorage.setItem("adminActiveTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    fetchUsers();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [roles, users, permissions]);

  const getToken = () => localStorage.getItem("token");

  const calculateStats = () => {
    setStats({
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      totalRoles: roles.length,
      activeRoles: roles.filter(r => r.isActive).length,
      totalPermissions: permissions.length
    });
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(buildApiUrl("/api/admin/roles"), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setRoles(res.data);
    } catch (error) {
      console.error("Error fetching roles:", error);
      showError("Error", "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await axios.get(buildApiUrl("/api/admin/permissions"), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setPermissions(res.data);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      showError("Error", "Failed to fetch permissions");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(buildApiUrl("/api/admin/users"), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      showError("Error", "Failed to fetch users");
    }
  };

  const handleInviteDeanChange = (e) => {
    const { name, value } = e.target;
    setInviteDeanForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInviteDean = async (e) => {
    e.preventDefault();
    if (!inviteDeanForm.name.trim() || !inviteDeanForm.email.trim()) {
      showError("Validation Error", "Please enter both name and email.");
      return;
    }

    const confirmed = await showConfirm(
      "Invite Dean",
      `Send an invitation to "${inviteDeanForm.name}" at ${inviteDeanForm.email}?`,
      "Send Invitation",
      "Cancel"
    );
    if (!confirmed.isConfirmed) return;

    try {
      setInvitingDean(true);
      await axios.post(
        buildApiUrl("/api/admin/invite-dean"),
        inviteDeanForm,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      await showSuccess(
        "Invitation Sent",
        `Dean invitation sent to ${inviteDeanForm.email}.`
      );
      setInviteDeanForm({ name: "", email: "" });
      // Refresh users list so the invited dean appears (inactive until registration)
      await fetchUsers();
    } catch (error) {
      showError(
        "Error",
        error.response?.data?.message || "Error sending dean invitation"
      );
    } finally {
      setInvitingDean(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(
        buildApiUrl("/api/admin/roles"),
        roleForm,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      await fetchRoles();
      setShowRoleModal(false);
      setRoleForm({ name: "", displayName: "", description: "", permissions: [] });
      await showSuccess("Success", "Role created successfully!");
    } catch (error) {
      showError("Error", error.response?.data?.message || "Error creating role");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleFormSubmit = (e) => {
    if (editingRole) {
      e.preventDefault();
      handleUpdateRole(editingRole._id, roleForm);
      setShowRoleModal(false);
    } else {
      handleCreateRole(e);
    }
  };

  const handleUpdateRole = async (roleId, updates, customMessage = null) => {
    try {
      const role = roles.find((r) => r._id === roleId);
      const roleName = role?.displayName || "Role";

      await axios.put(
        buildApiUrl(`/api/admin/roles/${roleId}`),
        updates,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      await fetchRoles();
      
      // Show custom message if provided, otherwise show appropriate message based on update
      if (customMessage) {
        await showSuccess(customMessage.title, customMessage.text);
      } else if (updates.isActive !== undefined) {
        const action = updates.isActive ? "enabled" : "disabled";
        await showSuccess(
          "Role Status Updated",
          `The "${roleName}" role has been ${action}. ${updates.isActive ? "Users with this role can now access the system." : "Users with this role will no longer be able to access the system."}`
        );
      } else {
        await showSuccess("Success", "Role updated successfully!");
      }
    } catch (error) {
      showError("Error", error.response?.data?.message || "Error updating role");
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    const result = await showConfirm(
      "Delete Role",
      `Are you sure you want to delete the role "${roleName}"?`,
      "Delete",
      "Cancel"
    );
    if (!result.isConfirmed) return;

    try {
      await axios.delete(buildApiUrl(`/api/admin/roles/${roleId}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchRoles();
      await showSuccess("Success", "Role deleted successfully!");
    } catch (error) {
      showError("Error", error.response?.data?.message || "Error deleting role");
    }
  };

  const handleTogglePermission = async (roleId, permissionId) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role) return;

    const permission = permissions.find((p) => p._id === permissionId);
    if (!permission) return;

    const hasPermission = role.permissions.some((p) => p._id === permissionId);
    const action = hasPermission ? "disabled" : "enabled";
    const permissionName = permission.name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    const roleName = role.displayName;

    const newPermissions = hasPermission
      ? role.permissions.filter((p) => p._id !== permissionId).map((p) => p._id)
      : [...role.permissions.map((p) => p._id), permissionId];

    try {
      await axios.put(
        buildApiUrl(`/api/admin/roles/${roleId}`),
        { permissions: newPermissions },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      await fetchRoles();
      
      // Show specific message about the permission change
      const message = hasPermission 
        ? `Permission "${permissionName}" has been disabled for the "${roleName}" role. Users with this role will no longer be able to access this feature.`
        : `Permission "${permissionName}" has been enabled for the "${roleName}" role. Users with this role can now access this feature.`;
      
      await showSuccess(
        hasPermission ? "Permission Disabled" : "Permission Enabled",
        message
      );
    } catch (error) {
      showError("Error", error.response?.data?.message || "Failed to update permission");
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      // Find the user to get their current version
      const user = users.find(u => u._id === userId);
      if (!user) {
        showError("Error", "User not found");
        return;
      }

      // Prevent changing student roles from the UI as well
      if (user.role === "graduate student") {
        showWarning(
          "Action Not Allowed",
          "Student roles cannot be changed. Graduate student accounts must remain as students."
        );
        return;
      }

      const version = user.version || 0;

      const { data } = await axios.put(
        buildApiUrl(`/api/admin/users/${userId}/role`),
        { role: newRole, version },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      // Optimistically update local state so the row reflects the change without a full refresh
      setUsers(prev =>
        prev.map(u =>
          u._id === userId
            ? {
                ...u,
                role: data?.role || newRole,
                version: data?.version ?? u.version,
              }
            : u
        )
      );
      await showSuccess("Success", "User role updated successfully!");
    } catch (error) {
      // Handle version mismatch (409 Conflict)
      if (error.response?.status === 409) {
        showError("Version Conflict", error.response.data?.message || "This user was updated by another user. Please reload the page to see the latest changes and try again.");
        return;
      }
      showError("Error", error.response?.data?.message || "Error updating user role");
    }
  };

  const handleDeleteUser = async (userId, userName, userRole) => {
    // Prevent deleting admin users
    if (userRole === "admin") {
      await showError("Cannot Delete Admin", "Admin users cannot be deleted. Please reassign the role first if needed.");
      return;
    }

    const result = await showConfirm(
      "Delete User",
      `Are you sure you want to permanently delete "${userName}"? This action cannot be undone.`,
      "Delete",
      "Cancel"
    );
    
    if (!result.isConfirmed) return;

    try {
      await axios.delete(buildApiUrl(`/api/admin/users/${userId}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchUsers(); // This will automatically update stats via useEffect
      await showSuccess("Success", `User "${userName}" has been removed from the system.`);
    } catch (error) {
      showError("Error", error.response?.data?.message || "Error deleting user");
    }
  };

  const closeEditUserModal = () => {
    setShowEditUserModal(false);
    setEditingUser(null);
    setEditUserForm({ name: "", email: "", isActive: true });
    setEditUserSaving(false);
  };

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setEditUserForm({
      name: user?.name || "",
      email: user?.email || "",
      isActive: !!user?.isActive,
    });
    setShowEditUserModal(true);
  };

  const validateEmailForRole = (email, role) => {
    if (!email) return "Email cannot be empty.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Invalid email format.";
    }
    const emailDomain = email.split("@")[1];
    const isStudent = role === "graduate student";
    if (isStudent && emailDomain !== "student.buksu.edu.ph") {
      return "Graduate students must use @student.buksu.edu.ph email address.";
    }
    if (!isStudent && emailDomain !== "buksu.edu.ph") {
      return "Faculty, Dean, and Program Head must use @buksu.edu.ph email address.";
    }
    return null;
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    const trimmedName = (editUserForm.name || "").trim();
    const normalizedEmail = (editUserForm.email || "").toLowerCase().trim();

    if (!trimmedName) {
      showWarning("Validation Error", "Name cannot be empty.");
      return;
    }

    const emailValidationMessage = validateEmailForRole(normalizedEmail, editingUser.role);
    if (emailValidationMessage) {
      showWarning("Validation Error", emailValidationMessage);
      return;
    }

    const payload = {
      version: editingUser.version || 0,
      name: trimmedName,
      email: normalizedEmail,
      isActive: editUserForm.isActive,
    };

    setEditUserSaving(true);
    try {
      const { data } = await axios.put(
        buildApiUrl(`/api/admin/users/${editingUser._id}`),
        payload,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      // Update local users list with latest data
      if (data?.user) {
        setUsers(prev =>
          prev.map(u =>
            u._id === data.user.id
              ? {
                  ...u,
                  name: data.user.name,
                  email: data.user.email,
                  isActive: data.user.isActive,
                  version: data.user.version ?? u.version,
                }
              : u
          )
        );
      }

      await showSuccess("Success", "User details updated successfully!");
      closeEditUserModal();
    } catch (error) {
      if (error.response?.status === 409) {
        showError(
          "Version Conflict",
          error.response.data?.message ||
            "This user was updated by another user. Please reload the page to see the latest changes and try again."
        );
      } else {
        showError("Error", error.response?.data?.message || "Failed to update user details.");
      }
    } finally {
      setEditUserSaving(false);
    }
  };

  const handleToggleUserActivation = async (user) => {
    const nextStatus = !user.isActive;
    const action = nextStatus ? "activate" : "deactivate";
    const result = await showConfirm(
      `${nextStatus ? "Activate" : "Deactivate"} User`,
      `Are you sure you want to ${action} "${user.name}"?`,
      nextStatus ? "Activate" : "Deactivate",
      "Cancel"
    );
    if (!result.isConfirmed) return;

    try {
      const { data } = await axios.put(
        buildApiUrl(`/api/admin/users/${user._id}`),
        { isActive: nextStatus, version: user.version || 0 },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      // Update local users list so status reflects the change without a full refresh
      if (data?.user) {
        setUsers(prev =>
          prev.map(u =>
            u._id === data.user.id
              ? {
                  ...u,
                  isActive: data.user.isActive,
                  version: data.user.version ?? u.version,
                }
              : u
          )
        );
      } else {
        // Fallback if backend didn’t send a user payload
        setUsers(prev =>
          prev.map(u =>
            u._id === user._id
              ? { ...u, isActive: nextStatus, version: (u.version || 0) + 1 }
              : u
          )
        );
      }
      await showSuccess("Success", `User ${nextStatus ? "activated" : "deactivated"} successfully!`);
    } catch (error) {
      if (error.response?.status === 409) {
        showError(
          "Version Conflict",
          error.response.data?.message ||
            "This user was updated by another user. Please reload the page to see the latest changes and try again."
        );
        return;
      }
      showError("Error", error.response?.data?.message || `Failed to ${action} user.`);
    }
  };

  const handleLogout = async () => {
    const result = await showConfirm("Log Out", "Are you sure you want to log out?");
    if (result.isConfirmed) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("selectedRole");
      setUser(null);
      navigate("/login", {
        state: { message: "You have been logged out successfully." },
        replace: true,
      });
    }
  };

  const permissionsByModule = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  // Filter functions
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = userFilter === "all" || 
                         (userFilter === "active" && user.isActive) ||
                         (userFilter === "inactive" && !user.isActive);
    return matchesSearch && matchesFilter;
  });

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = roleFilter === "all" || 
                         (roleFilter === "active" && role.isActive) ||
                         (roleFilter === "inactive" && !role.isActive) ||
                         (roleFilter === "system" && role.isSystem);
    return matchesSearch && matchesFilter;
  });

  const effectiveActivityTotalPages = Math.max(activityMeta.totalPages || 0, 1);

  const formatActivityTimestamp = (value) => {
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (error) {
      return value;
    }
  };

  const handleActivityFilterChange = (key, value) => {
    setActivityPage(1);
    setActivityFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetActivityFilters = () => {
    setActivityFilters({
      search: "",
      role: "all",
      action: "all",
      entityType: "all",
    });
    setActivityPage(1);
  };

  useEffect(() => {
    if (activeTab !== "activity") return;

    const fetchActivityLogs = async () => {
      setActivityLoading(true);
      try {
        const params = new URLSearchParams({
          page: activityPage,
          limit: 15,
        });

        if (activityFilters.search.trim()) {
          params.append("search", activityFilters.search.trim());
        }
        if (activityFilters.role !== "all") {
          params.append("role", activityFilters.role);
        }
        if (activityFilters.action !== "all") {
          params.append("action", activityFilters.action);
        }
        if (activityFilters.entityType !== "all") {
          params.append("entityType", activityFilters.entityType);
        }

        const res = await axios.get(
          buildApiUrl(`/api/admin/activity-logs?${params.toString()}`),
          {
            headers: { Authorization: `Bearer ${getToken()}` },
          }
        );

        setActivityLogs(res.data.logs || []);
        setActivityMeta({
          total: res.data.total || 0,
          totalPages: res.data.totalPages || 0,
        });
      } catch (error) {
        console.error("Error fetching activity logs:", error);
        showError("Error", error.response?.data?.message || "Failed to load activity logs");
      } finally {
        setActivityLoading(false);
      }
    };

    fetchActivityLogs();
  }, [activeTab, activityPage, activityFilters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] p-3 rounded-lg shadow-md">
                <FaUsersCog className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-[#7C1D23] to-[#5a1519] bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive Role-Based Access Control Management System
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-500">Welcome back,</p>
                <p className="font-semibold text-gray-900">{user?.name}</p>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <FaSignOutAlt />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <nav className="flex space-x-1 p-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`py-3 px-6 rounded-lg font-medium text-sm flex items-center space-x-3 transition-all duration-200 ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FaChartBar />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`py-3 px-6 rounded-lg font-medium text-sm flex items-center space-x-3 transition-all duration-200 ${
                activeTab === "roles"
                  ? "bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FaShieldAlt />
              <span>Roles</span>
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`py-3 px-6 rounded-lg font-medium text-sm flex items-center space-x-3 transition-all duration-200 ${
                activeTab === "permissions"
                  ? "bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FaKey />
              <span>Permissions</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`py-3 px-6 rounded-lg font-medium text-sm flex items-center space-x-3 transition-all duration-200 ${
                activeTab === "users"
                  ? "bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FaUsers />
              <span>Users</span>
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`py-3 px-6 rounded-lg font-medium text-sm flex items-center space-x-3 transition-all duration-200 ${
                activeTab === "activity"
                  ? "bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FaHistory />
              <span>Activity Logs</span>
            </button>
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">System Overview</h2>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                    </div>
                    <div className="bg-[#FDE8EA] p-3 rounded-full">
                      <FaUsers className="text-[#7C1D23] text-xl" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Active Users</p>
                      <p className="text-3xl font-bold text-green-600">{stats.activeUsers}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <FaCheck className="text-green-600 text-xl" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Roles</p>
                      <p className="text-3xl font-bold text-[#7C1D23]">{stats.totalRoles}</p>
                    </div>
                    <div className="bg-[#FDE8EA] p-3 rounded-full">
                      <FaShieldAlt className="text-[#7C1D23] text-xl" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Active Roles</p>
                      <p className="text-3xl font-bold text-[#7C1D23]">{stats.activeRoles}</p>
                    </div>
                    <div className="bg-[#FDE8EA] p-3 rounded-full">
                      <FaEye className="text-[#7C1D23] text-xl" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Active Permissions</p>
                      <p className="text-3xl font-bold text-[#7C1D23]">{stats.totalPermissions}</p>
                    </div>
                    <div className="bg-[#FDE8EA] p-3 rounded-full">
                      <FaKey className="text-[#7C1D23] text-xl" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FaExclamationTriangle className="mr-2 text-yellow-600" />
                    System Status
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm text-green-800">All systems operational</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#FDE8EA] border border-[#F5C6CC] rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-[#7C1D23] rounded-full mr-3"></div>
                        <span className="text-sm text-[#7C1D23]">RBAC system active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                        <span className="text-sm text-gray-800">Last updated: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === "roles" && (
          <div>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Role Management</h2>
                <p className="text-gray-600 mt-1">Manage system roles and their permissions</p>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search roles by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="lg:w-48">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  >
                    <option value="all">All Roles</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="system">System Roles</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
                <span className="ml-3 text-gray-600">Loading roles...</span>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredRoles.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FaShieldAlt className="mx-auto text-gray-400 text-4xl mb-4" />
                    <p className="text-gray-500 text-lg">No roles found matching your criteria</p>
                    <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter settings</p>
                  </div>
                ) : (
                  filteredRoles.map((role) => (
                    <div key={role._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`w-3 h-3 rounded-full ${role.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <h3 className="text-lg font-semibold text-gray-900">{role.displayName}</h3>
                            {role.isSystem && (
                              <span className="px-2 py-1 bg-[#FDE8EA] text-[#7C1D23] text-xs font-medium rounded-full">
                                System
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 mb-3 leading-relaxed">{role.description}</p>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-6 space-y-3 lg:space-y-0 text-sm">
                        <div className="flex items-center space-x-2">
                          <FaKey className="text-[#7C1D23]" />
                          <span className="text-gray-600">
                            <span className="font-medium text-gray-900">{role.permissions?.length || 0}</span> permissions
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          role.isActive 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => {
                            setEditingRole(role);
                            setRoleForm({
                              name: role.name,
                              displayName: role.displayName,
                              description: role.description || "",
                              permissions: role.permissions?.map((p) => p._id) || [],
                            });
                            setShowRoleModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <FaEdit className="mr-2" />
                          Edit Details
                        </button>
                      </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center cursor-pointer bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={role.isActive}
                              onChange={(e) => {
                                handleUpdateRole(role._id, { isActive: e.target.checked });
                              }}
                              disabled={role.isSystem}
                              className="mr-2 w-4 h-4 text-[#7C1D23] focus:ring-[#7C1D23] rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Active</span>
                          </label>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role._id, role.displayName)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 border border-red-200 hover:border-red-300"
                              title="Delete role"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Permissions for this role */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3 text-gray-700">Permissions:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {permissions.map((permission) => {
                            const hasPermission = role.permissions?.some(
                              (p) => p._id === permission._id
                            );
                            return (
                              <label
                                key={permission._id}
                                className={`flex items-center text-sm p-2 rounded border cursor-pointer ${
                                  hasPermission
                                    ? "bg-[#FDECEC] border-[#E0A6AC]"
                                    : "bg-gray-50 border-gray-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={hasPermission}
                                  onChange={() =>
                                    handleTogglePermission(role._id, permission._id)
                                  }
                                  disabled={
                                    (role.isSystem && role.name === "admin") ||
                                    !permission.isActive
                                  }
                                  className="mr-2 w-4 h-4"
                                />
                                <span
                                  className={
                                    hasPermission ? "text-gray-900" : "text-gray-400"
                                  }
                                >
                                  {permission.name.replace(/_/g, " ")}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">System Permissions</h2>
              <p className="text-gray-600 mt-1">Overview of all permissions organized by module</p>
            </div>
            
            <div className="grid gap-6">
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#FDE8EA] to-[#F8F1EC] px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] p-2 rounded-lg">
                        <FaKey className="text-white text-lg" />
                      </div>
                      <h3 className="font-semibold text-xl capitalize bg-gradient-to-r from-[#7C1D23] to-[#5a1519] bg-clip-text text-transparent">
                        {module} Module
                      </h3>
                      <span className="bg-[#FDE8EA] text-[#7C1D23] px-2 py-1 rounded-full text-sm font-medium">
                        {perms.length} permissions
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {perms.map((perm) => (
                        <div
                          key={perm._id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${perm.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              <h4 className="font-medium text-gray-900 text-sm">
                                {perm.name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                              </h4>
                            </div>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                perm.isActive
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                              }`}
                            >
                              {perm.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {perm.description && (
                            <p className="text-xs text-gray-600 leading-relaxed">{perm.description}</p>
                          )}
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Permission ID: <span className="font-mono">{perm.name}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="xl:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={activityFilters.search}
                      onChange={(e) => handleActivityFilterChange("search", e.target.value)}
                      placeholder="Search by user, description, or entity..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={activityFilters.role}
                    onChange={(e) => handleActivityFilterChange("role", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
                  >
                    <option value="all">All Roles</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role.name}>
                        {role.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    value={activityFilters.action}
                    onChange={(e) => handleActivityFilterChange("action", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
                  >
                    <option value="all">All Actions</option>
                    {ACTIVITY_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Module
                  </label>
                  <select
                    value={activityFilters.entityType}
                    onChange={(e) => handleActivityFilterChange("entityType", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
                  >
                    <option value="all">All Modules</option>
                    {ACTIVITY_ENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/-/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={resetActivityFilters}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {activityLoading ? (
                <div className="p-12 text-center text-gray-500 flex flex-col items-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]" />
                  <p>Loading activity logs...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Module
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {activityLogs.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                              No activity logs found for the selected filters.
                            </td>
                          </tr>
                        ) : (
                          activityLogs.map((log) => (
                            <tr key={log._id} className="hover:bg-[#FDF5F5] transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatActivityTimestamp(log.createdAt)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {log.user?.name || "Unknown User"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {log.user?.email || "No email"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {log.user?.role ? log.user.role.replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FDE8EA] text-[#7C1D23] border border-[#F2B7BE]">
                                  {log.action.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">
                                {log.entityType?.replace(/-/g, " ") || "—"}
                                {log.entityName && (
                                  <div className="text-xs text-gray-500 mt-1">{log.entityName}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {log.description || "No description provided."}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-semibold">{activityLogs.length}</span> of{" "}
                      <span className="font-semibold">{activityMeta.total}</span> activity logs
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setActivityPage((prev) => Math.max(prev - 1, 1))}
                        disabled={activityPage <= 1}
                        className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page <span className="font-semibold">{activityPage}</span> of{" "}
                        <span className="font-semibold">{effectiveActivityTotalPages}</span>
                      </span>
                      <button
                        onClick={() =>
                          setActivityPage((prev) => Math.min(prev + 1, effectiveActivityTotalPages))
                        }
                        disabled={activityMeta.total === 0 || activityPage >= effectiveActivityTotalPages}
                        className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <p className="text-gray-600 mt-1">Manage users and their role assignments</p>
              </div>
              {/* Invite Dean card */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 w-full lg:w-96">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                  <FaUserShield className="text-[#7C1D23]" />
                  <span>Invite a Dean</span>
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Send an invitation email to create a Dean account. Deans will complete their registration using a secure link.
                </p>
                <form onSubmit={handleInviteDean} className="space-y-2">
                  <input
                    type="text"
                    name="name"
                    value={inviteDeanForm.name}
                    onChange={handleInviteDeanChange}
                    placeholder="Dean's full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  />
                  <input
                    type="email"
                    name="email"
                    value={inviteDeanForm.email}
                    onChange={handleInviteDeanChange}
                    placeholder="Dean's institutional email (@buksu.edu.ph)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={invitingDean}
                    className="w-full mt-1 px-3 py-2 bg-[#7C1D23] text-white rounded-lg text-sm font-medium hover:bg-[#5a1519] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {invitingDean ? (
                      <>
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <FaEnvelope className="text-white" />
                        <span>Send Invitation</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="lg:w-48">
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <FaUsers className="text-[#7C1D23]" />
                        <span>User</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <FaShieldAlt className="text-[#7C1D23]" />
                        <span>Role</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <FaUsers className="mx-auto text-gray-400 text-4xl mb-4" />
                        <p className="text-gray-500 text-lg">No users found matching your criteria</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter settings</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-[#FDECEC] transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-[#A8353A] to-[#7C1D23] flex items-center justify-center text-white font-semibold">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                            <div className="text-sm text-gray-500">ID: {u._id.slice(-6)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{u.email}</div>
                        <div className="text-sm text-gray-500">Contact Information</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#FDE8EA] text-[#7C1D23] border border-[#F2B7BE]">
                          <FaShieldAlt className="mr-1" />
                          {u.role ? u.role.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'No Role'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                            u.isActive 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={u.role || ''}
                          onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
                        >
                          <option value="">Select Role</option>
                          {roles
                            .filter((r) => r.isActive)
                            .map((r) => (
                              <option key={r.name} value={r.name}>
                                {r.displayName}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                            title="Edit user details"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleUserActivation(u)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${
                              u.isActive
                                ? "bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-50"
                                : "bg-green-100 text-green-800 border border-green-200 hover:bg-green-50"
                            }`}
                            title={u.isActive ? "Deactivate user" : "Activate user"}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id, u.name, u.role)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 border border-red-200 hover:border-red-300"
                            title="Delete user"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Role Modal */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingRole ? "Edit Role" : "Create New Role"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleModal(false);
                    setEditingRole(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleRoleFormSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name (lowercase, no spaces)
                  </label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, name: e.target.value.toLowerCase() })
                    }
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C1D23]"
                    required
                    disabled={editingRole}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={roleForm.displayName}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, displayName: e.target.value })
                    }
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C1D23]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, description: e.target.value })
                    }
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C1D23]"
                    rows="3"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoleModal(false);
                      setEditingRole(null);
                    }}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[#7C1D23] text-white rounded hover:bg-[#5a1519] disabled:opacity-50 flex items-center space-x-2"
                  >
                    <FaSave />
                    <span>{editingRole ? "Update" : "Create"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                  <p className="text-sm text-gray-500">
                    Adjust the user&apos;s name, email, or account status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditUserModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleEditUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editUserForm.name}
                    onChange={(e) =>
                      setEditUserForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C1D23]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) =>
                      setEditUserForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C1D23]"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingUser.role === "graduate student"
                      ? "Graduate students must use @student.buksu.edu.ph email addresses."
                      : "Faculty, Dean, and Program Head accounts must use @buksu.edu.ph email addresses."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Status
                  </label>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        editUserForm.isActive
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {editUserForm.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditUserForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                      }
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                    >
                      {editUserForm.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="font-semibold text-gray-700 mb-1">User Details</p>
                  <p>Role: {editingUser.role || "N/A"}</p>
                  <p>User ID: {editingUser._id}</p>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeEditUserModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editUserSaving}
                    className="px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] disabled:opacity-50"
                  >
                    {editUserSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
