import React from "react";
import { useNavigate } from "react-router-dom";
import { FaUserGraduate, FaUserShield } from 'react-icons/fa';

const RoleSelection = () => {
  const navigate = useNavigate();

  // Only students can self-register; deans are invited by the Administrator
  const roles = [
    { value: "graduate student", label: "Student", icon: FaUserGraduate }
  ];

  const handleRoleSelect = (roleValue) => {
    // Store selected role in sessionStorage
    sessionStorage.setItem('selectedRole', roleValue);
    // Navigate to login page
    navigate(`/register?role=${encodeURIComponent(roleValue)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-100">
        {/* (Logo removed as requested) */}

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Create Your Account
          </h1>
          <p className="text-gray-600 text-lg">
            Select your role to register
          </p>
        </div>

        <div className="flex justify-center">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.value}
                onClick={() => handleRoleSelect(role.value)}
                className="w-full max-w-sm p-8 rounded-xl border-2 border-gray-200 bg-white hover:border-[#7C1D23] hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center space-y-4 group"
              >
                <div className="w-24 h-24 rounded-full bg-gray-100 group-hover:bg-[#7C1D23]/10 flex items-center justify-center transition-colors duration-300">
                  <Icon className="text-5xl text-gray-600 group-hover:text-[#7C1D23] transition-colors duration-300" />
                </div>
                <span className="text-lg font-semibold text-gray-700 group-hover:text-[#7C1D23] transition-colors duration-300">
                  {role.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">
            By continuing, you agree to use your buksu institutional email address
          </p>
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[#7C1D23] hover:text-[#5a1519] font-semibold"
            >
              Login here
            </button>
          </p>
          <p className="text-xs text-gray-500 mt-4 p-3 bg-[#7C1D23]/10 rounded-lg">
            <strong>Note:</strong> Deans must be invited by the Administrator. Faculty Advisers and Program Heads are invited by the Dean through email invitations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
