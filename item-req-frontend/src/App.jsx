import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Toast from './components/common/Toast';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/dashboard/Dashboard';
import RequestForm from './components/requests/RequestForm';
import UserManagement from './components/admin/UserManagement';
import DepartmentManagement from './components/admin/DepartmentManagement';
import TrackRequest from './components/requests/TrackRequest';
import ServiceVehicleRequestForm from './components/requests/ServiceVehicleRequestForm';
import FormSelector from './components/requests/FormSelector';
import WorkflowSettings from './components/admin/WorkflowSettings';
import ApprovalMatrixSettings from './components/admin/ApprovalMatrixSettings';
import AuditLogs from './components/audit/AuditLogs';
import DeployedAssets from './components/inventory/DeployedAssets';
import InventoryManagement from './components/admin/InventoryManagement';

import ModuleRequestsPage from './components/requests/ModuleRequestsPage';
import { MODULES } from './config/modules';
import ChatbotWidget from './components/ChatbotWidget';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

import { Layout } from './components/common/Layout';

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginForm />
          </PublicRoute>
        }
      />

      <Route
        path="/track"
        element={<TrackRequest />}
      />

      {/* Protected Routes wrapped with Layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/forms" element={<FormSelector />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Module List Routes */}
        <Route path="/requests" element={<ModuleRequestsPage moduleConfig={MODULES.ITEM} />} />
        <Route path="/service-vehicle-requests" element={<ModuleRequestsPage moduleConfig={MODULES.VEHICLE} />} />

        {/* Request Forms */}
        <Route path="/requests/new" element={<RequestForm />} />
        <Route path="/requests/:id/edit" element={<RequestForm />} />
        <Route path="/requests/:id" element={<RequestForm />} />

        <Route path="/service-vehicle-requests/new" element={<ServiceVehicleRequestForm />} />
        <Route path="/service-vehicle-requests/:id/edit" element={<ServiceVehicleRequestForm />} />
        <Route path="/service-vehicle-requests/:id" element={<ServiceVehicleRequestForm />} />

        {/* Management & Admin Routes */}
        <Route path="/users" element={<UserManagement />} />
        <Route path="/departments" element={<DepartmentManagement />} />
        <Route path="/settings/workflows" element={<WorkflowSettings />} />
        <Route path="/settings/approval-matrix" element={<ApprovalMatrixSettings />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/deployed-assets" element={<DeployedAssets />} />
        <Route path="/inventory" element={<InventoryManagement />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <div className="App dark:bg-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
              <Toast />
              <AppRoutes />
              <ChatbotWidget />
            </div>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
