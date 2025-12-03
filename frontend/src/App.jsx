import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RoleSelection from "./pages/RoleSelection";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DriveConnectionResult from "./pages/DriveConnectionResult";
import { useEffect, useState } from "react";
import axios from "axios";
import NotFound from "./components/NotFound";
import DeanDashboard from "./pages/Dashboard/Dean";
import FacultyAdviserDashboard from "./pages/Dashboard/FacultyAdviser";
import GraduateDashboard from "./pages/Dashboard/Graduate";
import ProgramHeadDashboard from "./pages/Dashboard/ProgramHead";
import AdminDashboard from "./pages/Dashboard/Admin";
import PanelReview from "./pages/PanelReview";
import ViewFeedback from "./pages/ViewFeedback";
import Settings from "./pages/Settings";

function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  console.log(user);
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await axios.get("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(res.data);
        } catch (err) {
          setError("Failed to fetch user data");
          localStorage.removeItem("token");
        }
      }
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  // Helper function to get dashboard path from role
  const getDashboardPath = (role) => {
    const roleMap = {
      "admin": "admin",
      "dean": "dean",
      "faculty adviser": "faculty",
      "program head": "program-head",
      "graduate student": "graduate",
    };
    return roleMap[role] || role.toLowerCase().replace(/\s+/g, "-");
  };

  return (
    <Router>
      <Routes>
        {/* Login as Home Page */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate
                to={`/dashboard/${getDashboardPath(user.role)}`}
              />
            ) : (
              <Login setUser={setUser} />
            )
          }
        />

        {/* Role Selection for Signup */}
        <Route
          path="/signup"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <RoleSelection />
            )
          }
        />

        {/* Keep login route as well (optional) */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <Login setUser={setUser} />
            )
          }
        />

        {/* Forgot Password Route */}
        <Route
          path="/forgot-password"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <ForgotPassword />
            )
          }
        />

        {/* Reset Password Route */}
        <Route
          path="/reset-password/:token"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <ResetPassword />
            )
          }
        />

        {/* Home route (optional, can be removed if not needed) */}
        <Route path="/home" element={<><Navbar user={user} setUser={setUser} /><Home user={user} error={error} /></>} />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <Register setUser={setUser} />
            )
          }
        />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard/dean"
          element={
            user?.role === "dean" ? (
              <DeanDashboard setUser={setUser} user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/faculty"
          element={
            user?.role === "faculty adviser" ? (
              <FacultyAdviserDashboard setUser={setUser} user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/program-head"
          element={
            user?.role === "program head" ? (
              <ProgramHeadDashboard setUser={setUser} user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/graduate"
          element={
            user?.role === "graduate student" ? (
              <GraduateDashboard setUser={setUser} user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            user?.role === "admin" ? (
              <AdminDashboard setUser={setUser} user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        {/* View Feedback with Comments Route (Student only) */}
        <Route
          path="/feedback/:feedbackId/view"
          element={
            user?.role === "graduate student" ? (
              <ViewFeedback setUser={setUser} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        {/* Public Panel Review Route (Token-based, no authentication required) */}
        <Route
          path="/panel-review/:token"
          element={<PanelReview />}
        />

        <Route
          path="/drive/connected"
          element={<DriveConnectionResult status="success" />}
        />
        <Route
          path="/drive/error"
          element={<DriveConnectionResult status="error" />}
        />
        <Route
          path="/settings"
          element={
            user ? (
              <Settings user={user} setUser={setUser} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
