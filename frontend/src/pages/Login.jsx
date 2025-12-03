import axios from "axios";
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useLocation } from "react-router-dom";

const Login = ({ setUser }) => {
  const location = useLocation();
  const  [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location.state?.message]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };


  const getDashboardPath = (role) => {
    const roleMap = {
      'dean': 'dean',
      'faculty adviser': 'faculty',
      'program head': 'program-head',
      'graduate student': 'graduate'
    };
    return roleMap[role] || role.toLowerCase().replace(/\s+/g, '-');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setIsLoading(true);
    try {
      // Check if reCAPTCHA is required and provided
      if (siteKey && !recaptchaToken) {
        setError("Please complete the reCAPTCHA verification");
        setIsLoading(false);
        return;
      }

      const res = await axios.post("/api/users/login", { 
        email: formData.email,
        password: formData.password,
        recaptcha: recaptchaToken 
      });
      localStorage.setItem("token", res.data.token);
      setUser(res.data);
      // Use the helper function for navigation
      navigate(`/dashboard/${getDashboardPath(res.data.role)}`);
    } catch (err) {
      // Better error handling
      const errorMessage = err.response?.data?.message || 
                          err.response?.status === 401 ? "Invalid email or password" :
                          err.response?.status === 400 ? "Invalid request. Please check your input." :
                          err.message || "Login failed. Please try again.";
      setError(errorMessage);
      console.error("Login error:", err.response?.data || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      const res = await axios.post("/api/users/google", { 
        credential: credentialResponse.credential,
        selectedRole: null
      });
      localStorage.setItem("token", res.data.token);
      setUser(res.data);
      navigate(`/dashboard/${getDashboardPath(res.data.role)}`);
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed");
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



  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
        {/* Logo Section (image only, no text) */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo.jpg" 
            alt="" 
            className="h-25 w-25 object-contain"
            onError={(e) => {
              // Hide image if logo doesn't exist
              e.target.style.display = 'none';
            }}
          />
        </div>

        <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">
          Welcome Back
        </h2>
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 rounded">
            <p className="text-sm">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <p className="text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Email Address
            </label>
            <input
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your institutional email"
              required
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Password
            </label>
            <div className="relative">
              <input
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#7C1D23]/30 focus:border-[#7C1D23] transition-colors"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {/* Forgot Password Link */}
            <div className="text-right mt-2">
              <Link 
                to="/forgot-password"
                className="text-sm text-[#7C1D23] hover:text-[#5a1519] hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {/* ReCAPTCHA */}
          {siteKey && (
            <div className="flex justify-center">
              <ReCAPTCHA
                sitekey={siteKey}
                onChange={(token) => setRecaptchaToken(token || "")}
              />
            </div>
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
                Logging in...
              </span>
            ) : (
              "Log In"
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

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link 
              to="/signup"
              className="text-[#7C1D23] hover:text-[#5a1519] font-semibold"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
