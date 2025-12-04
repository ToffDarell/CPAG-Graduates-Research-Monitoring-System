import axios from "axios";
import { showWarning } from "./sweetAlert";

/**
 * Check if user has a specific permission and show warning if disabled
 * @param {string|string[]} requiredPermissions - Permission(s) to check
 * @param {string} featureName - Name of the feature to display in warning
 * @param {string} tabContext - Optional context about what tab/section this is for
 * @param {Function} onDismissed - Optional callback function called after warning is dismissed (when user clicks OK)
 * @returns {Promise<boolean>} - Returns true if user has permission, false otherwise
 */
export const checkPermission = async (requiredPermissions, featureName, tabContext = null, onDismissed = null) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    // Convert single permission to array
    const permissionsArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    try {
      // Try to get user permissions
      const res = await axios.get("/api/users/me/permissions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userPermissions = res.data.permissions || [];
      const hasAllPermissions = res.data.hasAllPermissions || false;

      // Check if user has all required permissions
      const hasPermission = hasAllPermissions || 
        permissionsArray.every((perm) => userPermissions.includes(perm));

      if (!hasPermission) {
        const permissionNames = permissionsArray
          .map((p) => p.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()))
          .join(", ");

        const message = tabContext
          ? `The "${featureName}" feature has been disabled by the administrator. ${tabContext}`
          : `The "${featureName}" feature has been disabled by the administrator. You will not be able to access this feature. Please contact your administrator if you need access.`;

        // Show warning and wait for user to click OK button
        // This await will pause execution until the user clicks the OK button
        await showWarning("Feature Disabled", message);
        
        // Only after the user clicks OK, the code continues here
        // Now call the redirect callback if provided
        if (onDismissed && typeof onDismissed === 'function') {
          // This callback will trigger the redirect after OK is clicked
          onDismissed();
        }
        
        // Return false after warning is dismissed to indicate no permission
        return false;
      }

      return true;
    } catch (apiError) {
      // If permissions endpoint fails (404 or other error), try fallback method
      console.warn("Permission check API failed, trying fallback method:", apiError);
      
      // Fallback: Try to check by accessing a test endpoint
      // This will be handled by the route's permission middleware
      if (apiError?.response?.status === 404) {
        // Endpoint doesn't exist, return true to allow access (permission check not available)
        return true;
      }
      
      // For other errors, don't block access
      return true;
    }
  } catch (error) {
    console.error("Error checking permission:", error);
    return true; // Default to allowing access if check fails
  }
};

/**
 * Check permission by attempting to access a protected endpoint
 * @param {string} endpoint - API endpoint to check
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} featureName - Name of the feature
 * @param {string} tabContext - Optional context
 * @returns {Promise<boolean>}
 */
export const checkPermissionByEndpoint = async (
  endpoint,
  method = "GET",
  featureName,
  tabContext = null
) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      await axios.request({
        method,
        url: endpoint,
        headers: { Authorization: `Bearer ${token}` },
      });
      // If no error, user has permission
      return true;
    } catch (error) {
      // If 403, permission is disabled
      if (error?.response?.status === 403) {
        const errorMsg =
          error?.response?.data?.message ||
          `The "${featureName}" feature has been disabled by the administrator.`;
        const message = tabContext
          ? `${errorMsg} ${tabContext}`
          : `${errorMsg} You will not be able to access this feature. Please contact your administrator if you need access.`;

        await showWarning("Feature Disabled", message);
        return false;
      }
      // Other errors might be network issues, don't block access
      return true;
    }
  } catch (error) {
    console.error("Error checking permission by endpoint:", error);
    return true;
  }
};

