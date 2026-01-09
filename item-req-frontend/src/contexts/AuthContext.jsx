import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Validate token with server
        authAPI.validateToken()
          .then(() => {
            setLoading(false);
          })
          .catch(() => {
            // Token is invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            setUser(null);
            setLoading(false);
          });
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.login(credentials);
      const { token, user: userData } = response.data;
      
      // Store token and user data
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call result
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
      setError(null);
    }
  };

  const refreshToken = async () => {
    try {
      const response = await authAPI.refreshToken();
      const { token, user: userData } = response.data;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Helper functions to check user permissions
  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  const canApproveForDepartment = (departmentId) => {
    return user?.role === 'department_approver' && user?.department?.id === departmentId;
  };

  const canApproveAsITManager = () => {
    return hasAnyRole(['it_manager', 'super_administrator']);
  };

  const canProcessRequests = () => {
    return hasAnyRole(['service_desk', 'it_manager', 'super_administrator']);
  };

  const isAdmin = () => {
    return hasRole('super_administrator');
  };

  const canViewAllRequests = () => {
    return hasAnyRole(['it_manager', 'service_desk', 'super_administrator']);
  };

  const canManageUsers = () => {
    return hasAnyRole(['it_manager', 'super_administrator']);
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    refreshToken,
    updateUser,
    // Permission helpers
    hasRole,
    hasAnyRole,
    canApproveForDepartment,
    canApproveAsITManager,
    canProcessRequests,
    isAdmin,
    canViewAllRequests,
    canManageUsers,
    // Computed properties
    isAuthenticated: !!user,
    userRole: user?.role,
    userDepartment: user?.department
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
