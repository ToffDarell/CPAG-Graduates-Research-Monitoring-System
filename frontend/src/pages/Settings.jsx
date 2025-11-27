import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationCircle,
  FaGoogle,
  FaGoogleDrive,
  FaLock,
  FaSyncAlt,
  FaUserCog,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const statusBadge = (connected, needsReauth) => {
  if (connected && !needsReauth) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <FaCheckCircle className="mr-1" /> Connected
      </span>
    );
  }

  if (connected && needsReauth) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
        <FaSyncAlt className="mr-1" /> Re-auth required
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      <FaExclamationCircle className="mr-1" /> Not connected
    </span>
  );
};

const Alert = ({ type = "info", message }) => {
  if (!message) return null;
  const variant =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";

  return (
    <div className={`border rounded-md px-4 py-2 text-sm ${variant}`}>
      {message}
    </div>
  );
};

const Settings = ({ user, setUser, embedded = false, onClose }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    resetCode: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  const [calendarStatus, setCalendarStatus] = useState({
    connected: false,
    needsReauth: false,
    loading: true,
    expiresAt: null,
  });
  const [driveStatus, setDriveStatus] = useState({
    connected: false,
    needsReauth: false,
    loading: true,
    expiresAt: null,
  });
  const [driveMessage, setDriveMessage] = useState({ type: "", text: "" });
  const [calendarMessage, setCalendarMessage] = useState({
    type: "",
    text: "",
  });

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    };
  }, []);

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
    });
  }, [user]);

  const fetchCalendarStatus = async () => {
    setCalendarStatus((prev) => ({ ...prev, loading: true }));
    setCalendarMessage({ type: "", text: "" });
    try {
      const { data } = await axios.get("/api/google-calendar/status", authHeaders);
      setCalendarStatus({
        connected: data.connected,
        needsReauth: data.needsReauth,
        loading: false,
        expiresAt: data.expiresAt,
      });
    } catch (error) {
      console.error("Calendar status error:", error);
      setCalendarStatus((prev) => ({ ...prev, loading: false }));
      setCalendarMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Unable to determine Google Calendar status.",
      });
    }
  };

  const fetchDriveStatus = async () => {
    setDriveStatus((prev) => ({ ...prev, loading: true }));
    setDriveMessage({ type: "", text: "" });
    try {
      const { data } = await axios.get("/api/google-drive/status", authHeaders);
      setDriveStatus({
        connected: data.connected,
        needsReauth: data.needsReauth,
        loading: false,
        expiresAt: data.expiresAt,
      });
    } catch (error) {
      console.error("Drive status error:", error);
      setDriveStatus((prev) => ({ ...prev, loading: false }));
      setDriveMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Unable to determine Google Drive status.",
      });
    }
  };

  useEffect(() => {
    fetchCalendarStatus();
    fetchDriveStatus();
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "DRIVE_CONNECT_SUCCESS") {
        setDriveMessage({
          type: "success",
          text: "Google Drive connected successfully.",
        });
        fetchDriveStatus();
      } else if (event.data?.type === "DRIVE_CONNECT_ERROR") {
        setDriveMessage({
          type: "error",
          text: "Google Drive connection failed. Please try again.",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage({ type: "", text: "" });

    // Client-side validation
    const trimmedName = profileForm.name?.trim() || "";
    const trimmedEmail = profileForm.email?.trim() || "";

    if (!trimmedName) {
      setProfileMessage({
        type: "error",
        text: "Name cannot be empty.",
      });
      setProfileSaving(false);
      return;
    }

    if (!trimmedEmail) {
      setProfileMessage({
        type: "error",
        text: "Email cannot be empty.",
      });
      setProfileSaving(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setProfileMessage({
        type: "error",
        text: "Invalid email format.",
      });
      setProfileSaving(false);
      return;
    }

    // Role-based email domain validation (only if user role is available)
    if (user?.role) {
      const emailDomain = trimmedEmail.split("@")[1];
      const isStudent = user.role === "graduate student";

      if (isStudent && emailDomain !== "student.buksu.edu.ph") {
        setProfileMessage({
          type: "error",
          text: "Graduate students must use @student.buksu.edu.ph email address.",
        });
        setProfileSaving(false);
        return;
      }

      if (!isStudent && emailDomain !== "buksu.edu.ph") {
        setProfileMessage({
          type: "error",
          text: "Faculty, Dean, and Program Head must use @buksu.edu.ph email address.",
        });
        setProfileSaving(false);
        return;
      }
    }

    try {
      // Debug logging
      console.log("Sending profile update:", {
        name: trimmedName,
        email: trimmedEmail,
        userRole: user?.role,
      });

      const { data } = await axios.put(
        "/api/users/profile",
        {
          name: trimmedName,
          email: trimmedEmail,
        },
        authHeaders
      );
      setProfileMessage({
        type: "success",
        text: data.message || "Profile updated successfully.",
      });
      if (data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Profile update error:", error);
      console.error("Error response:", error.response?.data);
      
      // Show server error message if available, otherwise show generic error
      let errorMessage = "Failed to update profile. Please try again.";
      
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          errorMessage = error.response.data.errors.join(", ");
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      }
      
      setProfileMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestCode = async () => {
    setPasswordMessage({ type: "", text: "" });
    setSendingCode(true);
    try {
      const { data } = await axios.post(
        "/api/users/request-change-password-code",
        {},
        authHeaders
      );
      setPasswordMessage({
        type: "success",
        text: data.message || "Verification code sent to your email.",
      });
      setCodeSent(true);
    } catch (error) {
      console.error("Request code error:", error);
      setPasswordMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to send verification code.",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });

    if (!codeSent) {
      setPasswordMessage({
        type: "error",
        text: "Please request a verification code first.",
      });
      return;
    }

    if (!passwordForm.resetCode) {
      setPasswordMessage({
        type: "error",
        text: "Please enter the verification code.",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password and confirmation do not match.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      const payload = {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        resetCode: passwordForm.resetCode,
      };
      const { data } = await axios.put(
        "/api/users/change-password",
        payload,
        authHeaders
      );

      setPasswordMessage({
        type: "success",
        text: data.message || "Password updated successfully.",
      });
      setPasswordForm({ 
        currentPassword: "", 
        newPassword: "", 
        confirmNewPassword: "",
        resetCode: "",
      });
      setCodeSent(false);
    } catch (error) {
      console.error("Password update error:", error);
      setPasswordMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to update password.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const connectCalendar = async () => {
    setCalendarMessage({ type: "", text: "" });
    setCalendarStatus((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await axios.get("/api/google-calendar/auth-url", authHeaders);
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Calendar connect error:", error);
      setCalendarMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to start Google Calendar connection.",
      });
      setCalendarStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  const disconnectCalendar = async () => {
    const result = await Swal.fire({
      title: "Disconnect Google Calendar?",
      text: "You will need to reconnect to sync your calendar events.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7C1D23",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, disconnect",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setCalendarStatus((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await axios.post(
        "/api/google-calendar/disconnect",
        {},
        authHeaders
      );
      await Swal.fire({
        title: "Disconnected!",
        text: data.message || "Google Calendar has been disconnected successfully.",
        icon: "success",
        confirmButtonColor: "#7C1D23",
      });
      setCalendarMessage({ type: "success", text: data.message || "Disconnected successfully." });
      await fetchCalendarStatus();
    } catch (error) {
      console.error("Calendar disconnect error:", error);
      await Swal.fire({
        title: "Error",
        text: error.response?.data?.message || "Failed to disconnect Google Calendar.",
        icon: "error",
        confirmButtonColor: "#7C1D23",
      });
      setCalendarMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to disconnect Google Calendar.",
      });
      setCalendarStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  const connectDrive = async () => {
    setDriveMessage({ type: "", text: "" });
    setDriveStatus((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await axios.get("/api/google-drive/auth-url", authHeaders);
      const width = 600;
      const height = 650;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
      const popup = window.open(
        data?.authUrl,
        "driveConnectWindow",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      if (!popup) {
        setDriveMessage({
          type: "error",
          text: "Popup blocked. Please allow popups and try again.",
        });
      } else {
        popup.focus();
      }
    } catch (error) {
      console.error("Drive connect error:", error);
      setDriveMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to start Google Drive connection.",
      });
    } finally {
      setDriveStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  const disconnectDrive = async () => {
    const result = await Swal.fire({
      title: "Disconnect Google Drive?",
      text: "You will need to reconnect to upload files from Drive.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7C1D23",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, disconnect",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setDriveStatus((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await axios.post("/api/google-drive/disconnect", {}, authHeaders);
      await Swal.fire({
        title: "Disconnected!",
        text: data.message || "Google Drive has been disconnected successfully.",
        icon: "success",
        confirmButtonColor: "#7C1D23",
      });
      setDriveMessage({
        type: "success",
        text: data.message || "Google Drive disconnected.",
      });
      await fetchDriveStatus();
    } catch (error) {
      console.error("Drive disconnect error:", error);
      await Swal.fire({
        title: "Error",
        text: error.response?.data?.message || "Failed to disconnect Google Drive.",
        icon: "error",
        confirmButtonColor: "#7C1D23",
      });
      setDriveMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to disconnect Google Drive.",
      });
      setDriveStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatExpiry = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderProfileTab = () => (
    <div className="space-y-6 mt-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FaUserCog className="text-xl text-[#7C1D23]" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
            <p className="text-sm text-gray-500">
              Update your name and institutional email address.
            </p>
          </div>
        </div>

        <Alert type={profileMessage.type} message={profileMessage.text} />

        <form className="mt-4 space-y-4" onSubmit={handleProfileSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institutional email
            </label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 rounded-md bg-[#7C1D23] text-white font-medium hover:bg-[#5c151a] disabled:opacity-60"
            >
              {profileSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FaLock className="text-xl text-[#7C1D23]" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
            <p className="text-sm text-gray-500">
              Choose a strong password that you have not used elsewhere.
            </p>
          </div>
        </div>

        <Alert type={passwordMessage.type} message={passwordMessage.text} />

        <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  currentPassword: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Verification code
              </label>
              {!codeSent && (
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={sendingCode}
                  className="text-sm text-[#7C1D23] hover:text-[#5c151a] font-medium disabled:opacity-60"
                >
                  {sendingCode ? "Sending..." : "Send code to email"}
                </button>
              )}
            </div>
            {codeSent && (
              <p className="text-xs text-gray-500 mb-2">
                A verification code has been sent to your email. Please enter it below.
              </p>
            )}
            <input
              type="text"
              value={passwordForm.resetCode}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  resetCode: e.target.value,
                }))
              }
              placeholder="Enter 6-digit code"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              maxLength={6}
              pattern="[0-9]{6}"
              required={codeSent}
              disabled={!codeSent}
            />
            {codeSent && (
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={sendingCode}
                className="mt-2 text-xs text-[#7C1D23] hover:text-[#5c151a] font-medium disabled:opacity-60"
              >
                {sendingCode ? "Sending..." : "Resend code"}
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordForm.confirmNewPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmNewPassword: e.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 rounded-md bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
            >
              {passwordSaving ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-6 mt-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#F9E8EA] text-[#7C1D23] rounded-full">
              <FaGoogle className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Google Calendar
              </h2>
              <p className="text-sm text-gray-500">
                Sync consultations and defense schedules. After connecting you
                will be redirected to your dashboard.
              </p>
            </div>
          </div>
          {statusBadge(calendarStatus.connected, calendarStatus.needsReauth)}
        </div>

        <div className="mt-4 space-y-3">
          <Alert
            type={calendarMessage.type}
            message={calendarMessage.text}
          />
          <p className="text-xs text-gray-500">
            Token expires: {formatExpiry(calendarStatus.expiresAt)}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={
                calendarStatus.connected ? disconnectCalendar : connectCalendar
              }
              disabled={calendarStatus.loading}
              className={`px-4 py-2 rounded-md font-medium text-sm text-white ${
                calendarStatus.connected
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[#7C1D23] hover:bg-[#5c151a]"
              } disabled:opacity-60`}
            >
              {calendarStatus.loading
                ? "Please wait..."
                : calendarStatus.connected
                ? "Disconnect Calendar"
                : "Connect Calendar"}
            </button>
            <button
              onClick={fetchCalendarStatus}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh status
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#E3F2FD] text-[#1A73E8] rounded-full">
              <FaGoogleDrive className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Google Drive
              </h2>
              <p className="text-sm text-gray-500">
                Attach files directly from Drive and keep uploads in sync.
              </p>
            </div>
          </div>
          {statusBadge(driveStatus.connected, driveStatus.needsReauth)}
        </div>

        <div className="mt-4 space-y-3">
          <Alert type={driveMessage.type} message={driveMessage.text} />
          <p className="text-xs text-gray-500">
            Token expires: {formatExpiry(driveStatus.expiresAt)}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={driveStatus.connected ? disconnectDrive : connectDrive}
              disabled={driveStatus.loading}
              className={`px-4 py-2 rounded-md font-medium text-sm text-white ${
                driveStatus.connected
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[#1A73E8] hover:bg-[#0F5FDB]"
              } disabled:opacity-60`}
            >
              {driveStatus.loading
                ? "Please wait..."
                : driveStatus.connected
                ? "Disconnect Drive"
                : "Connect Drive"}
            </button>
            <button
              onClick={fetchDriveStatus}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh status
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const containerClasses = embedded ? "w-full" : "min-h-screen bg-gray-50 pb-12";
  const innerClasses = embedded
    ? "bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    : "max-w-5xl mx-auto px-4 py-10";

  const renderHeader = () => {
    if (embedded) {
      return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500">
              Update your profile, password, and integrations without leaving the dashboard.
            </p>
          </div>
          <button
            onClick={() => onClose?.()}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            Close
          </button>
        </div>
      );
    }

    return (
      <>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeft className="mr-2" /> Back
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500">
              Manage your profile, credentials, and Google integrations.
            </p>
          </div>
        </div>
      </>
    );
  };

  const renderTabs = () => (
    <div className="mt-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-6">
        {[
          { id: "profile", label: "Profile" },
          { id: "integrations", label: "Integrations" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-1 border-b-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-[#7C1D23] text-[#7C1D23]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <div className={containerClasses}>
      <div className={innerClasses}>
        {renderHeader()}
        {renderTabs()}
        {activeTab === "profile" ? renderProfileTab() : renderIntegrationsTab()}
      </div>
    </div>
  );
};

export default Settings;

