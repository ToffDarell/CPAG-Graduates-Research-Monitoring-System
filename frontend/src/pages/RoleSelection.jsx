import React from "react";
import { useNavigate } from "react-router-dom";
import { FaUserGraduate, FaUserShield, FaCheckCircle } from 'react-icons/fa';

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
    <div className="min-h-screen flex">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#7C1D23] via-[#5a1519] to-[#3d0e11] relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center text-center px-12 xl:px-16 w-full pb-20">
          {/* Logo */}
          <div className="mb-8">
            <img 
              src="/logo.jpg" 
              alt="Logo" 
              className="h-24 w-24 object-contain rounded-xl shadow-lg border-2 border-white/10"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Title */}
          <h1 className="text-3xl xl:text-4xl font-bold text-white mb-2 leading-tight">
            CPAG Graduate School Research
          </h1>
          <h2 className="text-2xl xl:text-3xl font-bold text-[#F5C451] mb-6">
            Archive and Monitoring System
          </h2>

          {/* Description */}
          <p className="text-gray-200 text-lg mb-10 max-w-md leading-relaxed mx-auto">
            Join the platform that streamlines graduate research management from submission to defense.
          </p>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 w-full text-center">
          <p className="text-gray-300/60 text-sm">© 2026 BukSU CPAG</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo - only show on small screens */}
          <div className="lg:hidden flex justify-center mb-6">
            <img 
              src="/logo.jpg" 
              alt="" 
              className="h-20 w-20 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-[#7C1D23] font-semibold text-sm uppercase tracking-wider mb-1">Research Monitoring</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              Create Your Account
            </h2>
            <p className="text-gray-500 text-sm">Select your role to get started.</p>
          </div>

          {/* Role Selection */}
          <div className="flex justify-center mb-8">
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

          {/* Info */}
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-500">
              By continuing, you agree to use your BukSU institutional email address
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
            <p className="text-xs text-gray-500 p-3 bg-[#7C1D23]/5 rounded-lg">
              <strong>Note:</strong> Deans must be invited by the Administrator. Faculty Advisers and Program Heads are invited by the Dean through email invitations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
