import axios from "axios";
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { FaEye, FaEyeSlash, FaUserGraduate, FaUserShield, FaArrowLeft } from 'react-icons/fa';

const Register = ({ setUser }) => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: "",
    studentId: "", // Add studentId field
    email: "",
    password: "",
    role: ""   // added role
  });
  const [error, setError] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvitation, setIsInvitation] = useState(false);
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationData, setInvitationData] = useState(null);
  const navigate = useNavigate();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const roles = [
    { value: "dean", label: "Dean", icon: FaUserShield },
    { value: "graduate student", label: "Student", icon: FaUserGraduate }
  ];

  // Check for invitation token or role from URL
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // This is an invitation registration
      verifyInvitationToken(token);
    } else {
      // Regular registration flow
      const roleFromUrl = searchParams.get('role');
      const roleFromSession = sessionStorage.getItem('selectedRole');
      const selectedRole = roleFromUrl || roleFromSession;
      
      if (selectedRole) {
        setFormData(prev => ({ ...prev, role: selectedRole }));
      } else {
        navigate('/');
      }
    }
  }, [searchParams, navigate]);

  const verifyInvitationToken = async (token) => {
    try {
      const res = await axios.get(`/api/users/verify-invitation/${token}`);
      if (res.data.valid) {
        setIsInvitation(true);
        setInvitationToken(token);
        setInvitationData(res.data.user);
        setFormData({
          name: res.data.user.name,  // Changed from username to name
          email: res.data.user.email,
          password: "",
          role: res.data.user.role
        });
      }
    } catch (err) {
      setError("Invalid or expired invitation link");
      setTimeout(() => navigate('/'), 3000);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (roleValue) => {
    setFormData({ ...formData, role: roleValue });
    sessionStorage.setItem('selectedRole', roleValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isInvitation) {
        // Complete registration with invitation token
        const res = await axios.post("/api/users/complete-registration", { 
          token: invitationToken,
          password: formData.password, 
          recaptcha: recaptchaToken 
        });
        localStorage.setItem("token", res.data.token);
        setUser(res.data.user);
        navigate("/");
      } else {
        // Regular registration flow
        // Email domain validation based on role
        const isStudent = formData.role === "graduate student";
        const emailDomain = formData.email.split('@')[1];
        
        if (isStudent && emailDomain !== "student.buksu.edu.ph") {
          setError("Graduate students must use @student.buksu.edu.ph email");
          setIsLoading(false);
          return;
        }
        
        if (!isStudent && emailDomain !== "buksu.edu.ph") {
          setError("Faculty/Dean must use @buksu.edu.ph email");
          setIsLoading(false);
          return;
        }

        const payload = {
          ...(formData.role === "graduate student" 
            ? { 
                name: formData.name,
                studentId: formData.studentId,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                recaptcha: recaptchaToken
              }
            : { 
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                recaptcha: recaptchaToken
              }
          ),
        };

        const res = await axios.post("/api/users/register", payload);
        localStorage.setItem("token", res.data.token);
        setUser(res.data);
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      // Validate studentId is provided for graduate students
      if (formData.role === "graduate student" && !formData.studentId) {
        setError("Please enter your Student ID before signing in with Google");
        return;
      }

      const res = await axios.post("/api/users/google", { 
        credential: credentialResponse.credential,
        selectedRole: formData.role,
        ...(formData.role === "graduate student" && { studentId: formData.studentId })  // Include studentId for students
      });
      localStorage.setItem("token", res.data.token);
      setUser(res.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  const handleGoogleLoginError = (error) => {
    console.log(error);
    setError(error.error);
  };

  // Get the selected role details for display
  const selectedRoleDetails = roles.find(r => r.value === formData.role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
        {/* Logo Section */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo.jpg" 
            alt="Department Logo" 
            className="h-25 w-25 object-contain"
            onError={(e) => {
              // Hide image if logo doesn't exist
              e.target.style.display = 'none';
            }}
          />
        </div>

        {/* Back button - only show if not invitation */}
        {!isInvitation && (
          <Link 
            to="/signup" 
            className="inline-flex items-center text-[#7C1D23] hover:text-[#5a1519] mb-4 text-sm font-medium"
          >
            <FaArrowLeft className="mr-2" />
            Change Role
          </Link>
        )}

        {/* Display selected role or invitation info */}
        {isInvitation ? (
          <div className="mb-6 p-4 bg-[#7C1D23]/10 rounded-lg border border-[#7C1D23]/20">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-[#7C1D23] mb-1">
                Faculty Invitation
              </h3>
              <p className="text-sm text-gray-600">
                Complete your registration as {invitationData?.role}
              </p>
            </div>
          </div>
        ) : (
          selectedRoleDetails && (
            <div className="mb-6 p-4 bg-[#7C1D23]/10 rounded-lg border border-[#7C1D23]/20">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-lg font-semibold text-[#7C1D23]">
                  Registering as {selectedRoleDetails.label}
                </span>
              </div>
            </div>
          )
        )}

        <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">
          {isInvitation ? 'Complete Registration' : 'Create Account'}
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <p className="text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Conditional rendering based on role */}
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Full Name
            </label>
            <input
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          {formData.role === "graduate student" && (
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Student ID
              </label>
              <input
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
                type="text"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder="Enter your Student ID"
                required
                pattern="\d{10}"
                title="Student ID must be 10 digits"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your 10-digit Student ID number
              </p>
            </div>
          )}
          
          {/* Email field */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Institutional Email
            </label>
            <input
              className={`w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/30 outline-none focus:border-[#7C1D23] ${isInvitation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your institutional email"
              autoComplete="off"
              disabled={isInvitation}
              required
            />
            {isInvitation && (
              <p className="text-xs text-gray-500 mt-1">This email was pre-filled from your invitation</p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/30 outline-none focus:border-[#7C1D23]"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
              <span
                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <FaEyeSlash className="h-5 w-5 text-gray-400" />
                ) : (
                  <FaEye className="h-5 w-5 text-gray-400" />
                )}
              </span>
            </div>
          </div>

          {/* ReCAPTCHA */}
          {siteKey ? (
            <div className="flex justify-center">
              <ReCAPTCHA
                sitekey={siteKey}
                onChange={(token) => setRecaptchaToken(token || "")}
              />
            </div> 
          ) : (
            <p className="my-4 text-center text-sm text-gray-500">reCAPTCHA not configured</p>
          )}

             {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (!!siteKey && !recaptchaToken)}
            className="w-full bg-[#7C1D23] text-white py-3 rounded-lg font-semibold hover:bg-[#5a1519] focus:ring-4 focus:ring-[#7C1D23]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Account...
              </span>
            ) : (
              "Sign Up"
            )}
          </button>
          

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={handleGoogleLoginError}
              theme="outline"
              size="large"
              shape="rectangular"
            />
          </div>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link 
              to="/login"
              className="text-[#7C1D23] hover:text-[#5a1519] font-semibold"
            >
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
