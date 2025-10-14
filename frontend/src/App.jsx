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
import { useEffect, useState } from "react";
import axios from "axios";
import NotFound from "./components/NotFound";
import DeanDashboard from "./pages/Dashboard/Dean";
import FacultyAdviserDashboard from "./pages/Dashboard/FacultyAdviser";
import GraduateDashboard from "./pages/Dashboard/Graduate";
import ProgramHeadDashboard from "./pages/Dashboard/ProgramHead";

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
      "admin/dean": "dean",
      "faculty adviser": "faculty",
      "program head": "program-head",
      "graduate student": "graduate",
    };
    return roleMap[role] || role.toLowerCase().replace(/\s+/g, "-");
  };

  return (
    <Router>
      <Routes>
        {/* Role Selection as Home Page */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate
                to={`/dashboard/${getDashboardPath(user.role)}`}
              />
            ) : (
              <RoleSelection />
            )
          }
        />

        {/* Home route (optional, can be removed if not needed) */}
        <Route path="/home" element={<><Navbar user={user} setUser={setUser} /><Home user={user} error={error} /></>} />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <><Navbar user={user} setUser={setUser} /><Login setUser={setUser} /></>
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to={`/dashboard/${getDashboardPath(user.role)}`} />
            ) : (
              <><Navbar user={user} setUser={setUser} /><Register setUser={setUser} /></>
            )
          }
        />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard/dean"
          element={
            user?.role === "admin/dean" ? (
              <DeanDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/faculty"
          element={
            user?.role === "faculty adviser" ? (
              <FacultyAdviserDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/program-head"
          element={
            user?.role === "program head" ? (
              <ProgramHeadDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard/graduate"
          element={
            user?.role === "graduate student" ? (
              <GraduateDashboard />
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
