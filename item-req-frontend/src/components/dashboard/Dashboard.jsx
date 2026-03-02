import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import STC_LOGO from '../../assets/STC_LOGO.png';
import HELLO_KITTY_IMG from '../../assets/hello_kitty.png';

import {
  Menu,
  Sun,
  Moon,
  Users,
  Building,
  Settings,
  Shield,
  LogOut,
  Plus,
  Activity,
  CheckCircle,
  Clock,
  AlertOctagon,
  FileText,
  Car,
  AlertCircle
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { settingsAPI } from '../../services/api';
import { MODULES } from '../../config/modules';

// --- Global Stats Component ---
const GlobalStats = ({ stats, user }) => {
  // Aggregate stats logic
  // "Pending My Approval" is critical for approvers
  let pendingApprovalCount = 0;
  let activeRequestsCount = 0;
  let completedCount = 0;

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // We need to sum up stats from detailed breakdowns if available, 
  // or rely on what we fetched. 
  // The 'stats' prop here will be an object with keys like 'item', 'vehicle' 
  // containing the raw stats from each API.

  Object.values(stats).forEach(moduleStats => {
    if (!moduleStats) return;

    // Pending Approvals (for approvers)
    if (user.role !== 'requestor') {
      // Different modules might name this differently in API response
      // But our generic getStats usually returns an object.
      // Let's assume the API returns 'pendingMyApproval' or similar if we added it,
      // or we infer from status counts.
      // For simplicity, let's sum 'submitted' + 'department_approved' etc based on role?
      // Actually, let's rely on the module config to tell us? 
      // No, 'getStats' in module config returns CARDS. 
      // We want raw numbers here.

      // Let's use a simpler heuristic for the Command Center:
      // If the API returns a 'pendingMyApproval' field, use it.
      if (moduleStats.pendingMyApproval !== undefined) {
        pendingApprovalCount += moduleStats.pendingMyApproval;
      } else {
        // Fallback: if I'm a dept approver, count 'submitted'.
        if (user.role === 'department_approver') pendingApprovalCount += (moduleStats.submitted || 0);
        if (user.role === 'it_manager') pendingApprovalCount += (moduleStats.department_approved || 0);
      }
    }

    // Active Requests (for requestors)
    if (user.role === 'requestor') {
      activeRequestsCount += (moduleStats.submitted || 0) + (moduleStats.department_approved || 0) + (moduleStats.service_desk_processing || 0);
    }

    completedCount += (moduleStats.completed || 0);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Actions / Attention Card */}
      {user.role !== 'requestor' ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Approval</h3>
            <AlertOctagon className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{pendingApprovalCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-semibold">Across all departments</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Requests</h3>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{activeRequestsCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-semibold">Currently in progress</p>
          </div>
        </div>
      )}

      {/* Total Completed / Approved */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {user.role === 'requestor' ? 'Total Approved' : 'Total Completed'}
          </h3>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{completedCount}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-semibold">
            {user.role === 'requestor' ? 'All approved requests' : 'All closed requests'}
          </p>
        </div>
      </div>

      {/* Date & Time Widget */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">System Time</h3>
          <Clock className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-semibold tracking-wider">
            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, canManageUsers, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);

  // Theme State
  const [themeEnabled, setThemeEnabled] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [kittyPosition, setKittyPosition] = useState(3);
  const [isPatternActive, setIsPatternActive] = useState(false);
  const pressStartTime = useRef(0);

  // Derived Classes
  const headerClass = user?.role === 'service_desk' ? 'bg-primary-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-800';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadGlobalData();
    // Load theme setting
    if (user?.role === 'service_desk') {
      settingsAPI.get('service_desk_theme_enabled')
        .then(res => setThemeEnabled(res.data?.value === true || res.data?.value === 'true'))
        .catch(err => console.error('Error loading theme setting:', err));
    }
  }, []);

  const loadGlobalData = async () => {
    try {
      setLoading(true);
      const modules = Object.values(MODULES);

      // 1. Fetch Stats from all modules
      const statsPromises = modules.map(m => m.api.getStats().then(res => ({ id: m.id, data: res.data.stats || res.data })));
      // 2. Fetch Recent Items from all modules (limit 5)
      const recentPromises = modules.map(m => m.api.getAll({ limit: 5 }).then(res => ({
        id: m.id,
        requests: res.data.requests || res.data || [],
        moduleLabel: m.label,
        moduleIcon: m.icon
      })));

      const [statsResults, recentResults] = await Promise.all([
        Promise.all(statsPromises),
        Promise.all(recentPromises)
      ]);

      // Process Stats
      const newGlobalStats = {};
      statsResults.forEach(res => {
        newGlobalStats[res.id] = res.data;
      });
      setGlobalStats(newGlobalStats);

      // Process Recent Activity (Merge & Sort)
      let allRecent = [];
      recentResults.forEach(res => {
        const items = res.requests.map(item => ({
          ...item,
          _moduleId: res.id,
          _moduleLabel: res.moduleLabel,
          _moduleIcon: res.moduleIcon,
          _date: new Date(item.submittedAt || item.submitted_at || item.createdAt || item.created_at || item.requested_date)
        }));
        allRecent = [...allRecent, ...items];
      });

      // Sort by date desc
      allRecent.sort((a, b) => b._date - a._date);
      setRecentActivity(allRecent.slice(0, 10)); // Take top 10

    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Theme handlers
  const handleKittyMouseDown = () => { pressStartTime.current = Date.now(); };
  const handleKittyMouseUp = () => {
    if (Date.now() - pressStartTime.current > 500) setIsPatternActive(!isPatternActive);
    else setKittyPosition(p => (p + 1) % 4);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Dashboard Header (No top navigation bar) */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-gray-800 pb-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Command Center</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide font-medium">Overview of all operations and requests</p>
            </div>
            {/* Quick Actions Restyled */}
            <div className="mt-4 md:mt-0 flex gap-3">
              <button onClick={() => navigate('/requests/new')} className="hidden md:flex items-center px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
                <FileText className="h-4 w-4 mr-2" /> New Item Request
              </button>
              <button onClick={() => navigate('/service-vehicle-requests/new')} className="hidden md:flex items-center px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
                <Car className="h-4 w-4 mr-2" /> New Vehicle Request
              </button>
            </div>
          </div>

          {/* Global Stats with shadcn style */}
          <GlobalStats stats={globalStats} user={user} />

          {/* Recent Activity Feed Restyled */}
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white mb-4">Recent Activity Summary</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentActivity.length === 0 ? (
                <li className="p-8 text-center text-sm text-gray-500">No recent activity found.</li>
              ) : (
                recentActivity.map((item, idx) => (
                  <li key={idx} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0 gap-4">
                        <div className="p-2 bg-gray-100/50 dark:bg-gray-800/50 rounded-md border border-gray-200/50 dark:border-gray-700/50">
                          {item._moduleIcon && <item._moduleIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {item.reference_code || item.requestNumber || `REQ #${item.id || item.request_id}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {item.requestor_name || item.requestor?.fullName || 'Unknown'} • {item._moduleLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border
                                           ${['completed', 'approved'].some(s => item.status?.includes(s)) ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                            ['declined', 'returned'].some(s => item.status?.includes(s)) ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'}
                                       `}>
                          {user.role === 'requestor' && item.status === 'completed' ? 'APPROVED' : item.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                          {item._date.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </main>

      {/* Hello Kitty Theme Elements (Service Desk) */}
      {user.role === 'service_desk' && themeEnabled && (
        <>
          {isPatternActive && (
            <div
              className="fixed inset-0 z-0 pointer-events-none opacity-10 mix-blend-multiply transition-opacity duration-1000"
              style={{ backgroundImage: `url(${HELLO_KITTY_IMG})`, backgroundSize: '80px' }}
            />
          )}
          <img
            src={HELLO_KITTY_IMG}
            alt="Theme"
            onMouseDown={handleKittyMouseDown}
            onMouseUp={handleKittyMouseUp}
            className={`fixed w-32 sm:w-48 md:w-64 h-auto opacity-80 mix-blend-multiply z-50 cursor-pointer hover:scale-110 transition-all duration-500 ease-in-out
                   ${kittyPosition === 0 ? 'bottom-0 right-0' : ''}
                   ${kittyPosition === 1 ? 'bottom-0 left-0' : ''}
                   ${kittyPosition === 2 ? 'top-20 left-0' : ''}
                   ${kittyPosition === 3 ? 'top-20 right-0' : ''}
                 `}
          />
        </>
      )}
    </>
  );
};

export default Dashboard;
