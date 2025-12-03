import React from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("selectedRole");
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 p-4 sticky top-0 z-50 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link 
          to={user ? `/dashboard/${user.role.toLowerCase().replace(/\s+/g, "-")}` : "/"} 
          className="flex items-center space-x-3 text-white text-lg font-bold hover:opacity-80 transition-opacity"
        >
          {/* logo (image only, no label text) */}
          <img 
            src="/logo.jpg" 
            alt="" 
            className="h-10 w-10 object-contain"
            onError={(e) => {
              // Hide image if logo doesn't exist
              e.target.style.display = 'none';
            }}
          />
        </Link>
        <div>
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="text-white text-sm">
                Welcome, <span className="font-semibold">{user.name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="text-white bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
