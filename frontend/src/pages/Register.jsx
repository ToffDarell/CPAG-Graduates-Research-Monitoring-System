import axios from "axios";
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { FaEye, FaEyeSlash, FaUserGraduate, FaUserShield, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

const Register = ({ setUser }) => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: "",
    studentId: "", // Add studentId field
    email: "",
    password: "",
    confirmPassword: "",
    role: ""   // added role
  });
  const [error, setError] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvitation, setIsInvitation] = useState(false);
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationData, setInvitationData] = useState(null);
  const navigate = useNavigate();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Only students can self-register; deans use invitation links from the Admin
  const roles = [
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
          name: res.data.user.name,
          email: res.data.user.email,
          password: "",
          confirmPassword: "",
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
    
    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
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
        // TEMPORARY: Email domain validation based on role (allow @gmail.com for testing)
        const isStudent = formData.role === "graduate student";
        const emailDomain = formData.email.split('@')[1];
        
        if (isStudent && emailDomain !== "student.buksu.edu.ph" && emailDomain !== "gmail.com") {
          setError("Graduate students must use @student.buksu.edu.ph or @gmail.com email (for testing)");
          setIsLoading(false);
          return;
        }
        
        if (!isStudent && emailDomain !== "buksu.edu.ph" && emailDomain !== "gmail.com") {
          setError("Faculty/Dean must use @buksu.edu.ph or @gmail.com email (for testing)");
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
    // Ignore AbortError and NetworkError from FedCM - these happen when:
    // - Component unmounts or navigation occurs during Google Sign-In initialization
    // - FedCM is disabled or network issues occur (browser will fallback to popup)
    if (error?.error === 'popup_closed_by_user' || 
        error?.type === 'popup_closed_by_user' ||
        error?.name === 'AbortError' ||
        error?.name === 'NetworkError' ||
        error?.message?.includes('aborted') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('FedCM')) {
      // These are expected - browser will fallback to popup or user cancelled
      // Don't show error to user for these cases
      return;
    }
    
    // Only show actual errors to the user
    if (error?.error && error.error !== 'popup_closed_by_user') {
      setError(error.error);
    } else if (error?.type && error.type !== 'popup_closed_by_user') {
      setError('Google Sign-In failed. Please try again.');
    }
    // Silently ignore FedCM-related errors as they're handled by fallback
  };

  // Get the selected role details for display
  const selectedRoleDetails = roles.find(r => r.value === formData.role);

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
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center bg-gray-50 p-6 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-md py-4">
          {/* Mobile logo - only show on small screens */}
          <div className="lg:hidden flex justify-center mb-4">
            <img 
              src="/logo.jpg" 
              alt="" 
              className="h-16 w-16 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Back button - only show if not invitation */}
          {!isInvitation && (
            <Link 
              to="/signup" 
              className="inline-flex items-center text-[#7C1D23] hover:text-[#5a1519] mb-3 text-sm font-medium"
            >
              <FaArrowLeft className="mr-2" />
              Change Role
            </Link>
          )}

          {/* Form Header */}
          <div className="mb-4">
            <p className="text-[#7C1D23] font-semibold text-sm uppercase tracking-wider mb-1">Research Monitoring</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {isInvitation ? 'Complete Registration' : 'Create Account'}
            </h2>
            {/* Display selected role or invitation info */}
            {isInvitation ? (
              <p className="text-gray-500 text-sm">
                Complete your registration as{" "}
                <span className="font-semibold text-[#7C1D23]">
                  {invitationData?.role
                    ? invitationData.role
                        .split(" ")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")
                    : ""}
                </span>
              </p>
            ) : (
              selectedRoleDetails && (
                <p className="text-gray-500 text-sm">
                  Registering as <span className="font-semibold text-[#7C1D23]">{selectedRoleDetails.label}</span>
                </p>
              )
            )}
          </div>

          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-1">
                Full Name
              </label>
              <input
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
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
                <label className="block text-gray-700 text-sm font-semibold mb-1">
                  Student ID
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="Enter your 10-digit Student ID"
                  required
                  pattern="\d{10}"
                  title="Student ID must be 10 digits"
                />
              </div>
            )}
            
            {/* Email field */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-1">
                Email Address
              </label>
              <input
                className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors ${isInvitation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@student.buksu.edu.ph"
                autoComplete="off"
                disabled={isInvitation}
                required
              />
              {!isInvitation && (
                <p className="text-xs text-gray-500 mt-0.5">Use @student.buksu.edu.ph or @gmail.com (for testing)</p>
              )}
            </div>

            {/* Password fields in a grid on wider screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min 8 chars + 1 symbol"
                    required
                    minLength="8"
                    pattern=".*[^a-zA-Z0-9_].*"
                    title="Password must contain at least one symbol"
                  />
                  <span
                    className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <FaEyeSlash className="h-4 w-4 text-gray-400" />
                    ) : (
                      <FaEye className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors ${formData.confirmPassword ? (formData.password !== formData.confirmPassword ? 'border-red-500' : 'border-green-500') : 'border-gray-300'}`}
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    required
                  />
                  <span
                    className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <FaEyeSlash className="h-4 w-4 text-gray-400" />
                    ) : (
                      <FaEye className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                </div>
                {formData.confirmPassword && (
                  formData.password !== formData.confirmPassword
                    ? <p className="text-xs text-red-500 mt-0.5">Passwords do not match</p>
                    : <p className="text-xs text-green-500 mt-0.5">Passwords match</p>
                )}
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
              <p className="text-center text-sm text-gray-500">reCAPTCHA not configured</p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (!!siteKey && !recaptchaToken)}
              className="w-full bg-[#7C1D23] text-white py-2.5 rounded-lg font-semibold hover:bg-[#5a1519] focus:ring-4 focus:ring-[#7C1D23]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
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
          <div className="mt-4 text-center">
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
    </div>
  );
};

export default Register;
