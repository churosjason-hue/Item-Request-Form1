import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, AlertCircle, Search } from "lucide-react";
import { useAuth } from '../../contexts/AuthContext';
import STC_LOGO from '../../assets/STC_LOGO.png';
import { AuroraBackground } from "../ui/aurora-background";

const LoginForm = () => {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.password) {
      setError("Please enter both username and password");
      return;
    }

    const result = await login(formData);

    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <AuroraBackground>
      <div className="max-w-md w-full relative z-10 animate-fade-in-up mt-8">
        {/* Glassmorphism Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">

          {/* Header Section */}
          <div className="px-8 pt-12 pb-8 text-center relative">
            <div className="mx-auto mb-6 relative inline-block">
              {/* Logo Container - White background for visibility */}
              <div className="bg-white/95 p-4 rounded-2xl shadow-lg shadow-blue-500/20 backdrop-blur-sm">
                <img
                  src={STC_LOGO}
                  alt="STC Logo"
                  className="h-16 w-auto relative z-10"
                />
              </div>
            </div>

            <h2 className="text-4xl font-[800] text-white tracking-tight mb-3 drop-shadow-md">
              PRISM
            </h2>

          </div>

          {/* Form Section */}
          <div className="px-8 pb-10">
            <form className="space-y-6" onSubmit={handleSubmit}>

              {/* Username Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-200 ml-1">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 text-gray-400 group-focus-within:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-950/70 hover:border-white/20"
                    placeholder="Enter AD username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-200 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 text-gray-400 group-focus-within:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-950/70 hover:border-white/20"
                    placeholder="Enter AD password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in shadow-inner">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="text-sm font-medium text-red-200">{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest bg-slate-900 rounded-full py-1 border border-white/5">
                  OR
                </span>
              </div>
            </div>

            {/* Track Request Link */}
            <div>
              <button
                onClick={() => navigate("/track")}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 group"
              >
                <Search className="h-4 w-4 mr-2 text-gray-500 group-hover:text-blue-400 transition-colors" />
                Track Request with Ticket Code
              </button>
            </div>

          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-950/30 text-center border-t border-white/5 backdrop-blur-md">
            <p className="text-[10px] text-gray-500 font-medium">
              © {new Date().getFullYear()} STC Packaging Solutions. All rights reserved.
            </p>
          </div>
        </div>

        {/* Helper Text below card */}
        <div className="mt-8 text-center animate-fade-in-up delay-200">
          <a href="http://172.16.1.127:8081/znuny/customer.pl" className="text-xs text-gray-500 hover:text-blue-400 transition-colors font-medium border-b border-transparent hover:border-blue-400/30 pb-0.5">
            Need help? Contact IT Support
          </a>
        </div>
      </div>
    </AuroraBackground>
  );
};

export default LoginForm;
