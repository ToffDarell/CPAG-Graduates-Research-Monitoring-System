import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaUsers, FaShieldAlt, FaKey, FaEdit, FaTrash, FaPlus, FaSave, FaTimes, FaSignOutAlt } from "react-icons/fa";
import { showSuccess, showError, showConfirm } from "../../utils/sweetAlert";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin.includes("localhost:5173")
    ? "http://localhost:5000"
    : "");

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

const Admin = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    displayName: "",
    description: "",
    permissions: [],
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    fetchUsers();
  }, []);

  const getToken = () => localStorage.getItem("token");

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
      await axios.put(
        buildApiUrl(`/api/admin/users/${userId}/role`),
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      await fetchUsers();
      await showSuccess("Success", "User role updated successfully!");
    } catch (error) {
      showError("Error", error.response?.data?.message || "Error updating user role");
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Role-Based Access Control Management</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
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
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("roles")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === "roles"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FaShieldAlt />
              <span>Roles</span>
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === "permissions"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FaKey />
              <span>Permissions</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === "users"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FaUsers />
              <span>Users</span>
            </button>
          </nav>
        </div>

        {/* Roles Tab */}
        {activeTab === "roles" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Role Management</h2>
              <button
                onClick={() => {
                  setEditingRole(null);
                  setRoleForm({ name: "", displayName: "", description: "", permissions: [] });
                  setShowRoleModal(true);
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                <FaPlus />
                <span>Create Role</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {roles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No roles found</div>
                ) : (
                  roles.map((role) => (
                    <div key={role._id} className="border-b border-gray-200 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-lg">{role.displayName}</h3>
                            {role.isSystem && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                System Role
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                          <p className="text-xs text-gray-500">
                            {role.permissions?.length || 0} permission(s) assigned
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={role.isActive}
                              onChange={(e) => {
                                handleUpdateRole(role._id, { isActive: e.target.checked });
                              }}
                              disabled={role.isSystem}
                              className="mr-2 w-4 h-4"
                            />
                            <span className="text-sm">Active</span>
                          </label>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role._id, role.displayName)}
                              className="text-red-600 hover:text-red-800"
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
                                    ? "bg-blue-50 border-blue-300"
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
            <h2 className="text-xl font-semibold mb-4">Permissions by Module</h2>
            {Object.entries(permissionsByModule).map(([module, perms]) => (
              <div key={module} className="bg-white shadow rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-lg mb-4 capitalize text-blue-600">{module}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((perm) => (
                    <div
                      key={perm._id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {perm.name.replace(/_/g, " ")}
                        </p>
                        {perm.description && (
                          <p className="text-sm text-gray-600 mt-1">{perm.description}</p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded ml-2 ${
                          perm.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {perm.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change Role
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {u.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {u.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                          className="border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {roles
                            .filter((r) => r.isActive)
                            .map((r) => (
                              <option key={r.name} value={r.name}>
                                {r.displayName}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
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
                  onClick={() => {
                    setShowRoleModal(false);
                    setEditingRole(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={editingRole ? (e) => {
                e.preventDefault();
                handleUpdateRole(editingRole._id, roleForm);
                setShowRoleModal(false);
              } : handleCreateRole}>
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
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    <FaSave />
                    <span>{editingRole ? "Update" : "Create"}</span>
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

