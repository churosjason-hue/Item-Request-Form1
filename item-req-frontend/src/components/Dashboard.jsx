import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import STC_LOGO from "../assets/STC_LOGO.png";

import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Building,
  Settings,
  LogOut,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Car,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell,
  Calendar,
  UserCheck,
  Moon,
  Sun,
  Trash2,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { requestsAPI, REQUEST_STATUSES, serviceVehicleRequestsAPI } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, canViewAllRequests, canManageUsers, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('item'); // 'item' or 'vehicle'
  const [requests, setRequests] = useState([]);
  const [vehicleRequests, setVehicleRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [vehicleStats, setVehicleStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
    limit: 10, // Display 10 requests per page
    sortBy: 'date', // 'date', 'status', 'requestor'
    sortOrder: 'desc' // 'asc' or 'desc'
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    currentPage: 1
  });
  const [selectedVehicleRequests, setSelectedVehicleRequests] = useState(new Set());

  const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC') || user?.role === 'super_administrator';

  const toggleRequestSelection = (requestId) => {
    const newSelected = new Set(selectedVehicleRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedVehicleRequests(newSelected);
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      return;
    }

    try {
      if (type === 'item') {
        await requestsAPI.delete(id);
      } else {
        await serviceVehicleRequestsAPI.delete(id);
      }

      // Refresh
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleGenerateTripTicket = () => {
    if (selectedVehicleRequests.size === 0) return;

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape, millimeters, A4
    const selectedData = vehicleRequests.filter(req => selectedVehicleRequests.has(req.id || req.request_id));

    // Add Logo
    const imgProps = doc.getImageProperties(STC_LOGO);
    const imgWidth = 40;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    doc.addImage(STC_LOGO, 'PNG', 14, 10, imgWidth, imgHeight);

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BATCH TRAVEL ITINERARY", 297 / 2, 20, { align: "center" });

    // Form ID
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("HRD-FM-072 rev.02 080625", 280, 10, { align: "right" });

    // Table Data
    const tableBody = selectedData.map(req => {
      // Format dates
      const dateFrom = req.travel_date_from ? new Date(req.travel_date_from).toLocaleDateString() : '-';
      const dateTo = req.travel_date_to ? new Date(req.travel_date_to).toLocaleDateString() : '-';

      // Vehicle Details
      // The backend now includes AssignedVehicle model.
      // If req.AssignedVehicle exists, use it.
      // Otherwise fallback to fields if any (though currently vehicle details are in the model)
      const vehicle = req.AssignedVehicle || {};
      const vehicleMakeModel = vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : (req.destination_car || '-');
      const plateNumber = vehicle.plate || '-';
      // Driver: assigned_driver is a string text in ServiceVehicleRequest
      const driver = req.assigned_driver || '-';

      // Passenger Name: check passenger_name field or passengers array
      let passengerName = req.passenger_name || '-';
      if ((!passengerName || passengerName === '-') && req.passengers && Array.isArray(req.passengers) && req.passengers.length > 0) {
        passengerName = req.passengers.map(p => p.name).join(', ');
      }

      return [
        req.reference_code || `SVR-${req.id}`,
        req.request_type ? req.request_type.replace(/_/g, ' ').toUpperCase() : '-',
        dateFrom,
        dateTo,
        req.pick_up_location || req.destination || req.destination_car || '-', // Destination / Pick-up Point (Context dependent, but form says Destination/Pick-up)
        req.pick_up_time || req.departure_time || '-', // Departure / Pick-up Time
        req.drop_off_location || '-',
        passengerName,
        vehicleMakeModel,
        plateNumber,
        driver
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [[
        { content: 'APPROVAL REFERNCE CODE', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'REQUEST TYPE', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'TRAVEL DATE', colSpan: 2, styles: { halign: 'center' } },
        { content: 'DESTINATION / PICK-UP POINT', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'DEPARTURE / PICK-UP TIME', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'DROP-OFF POINT', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'NAME OF PASSENGER', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'VEHICLE DETAILS', colSpan: 3, styles: { halign: 'center' } }
      ], [
        { content: '(FROM)', styles: { halign: 'center' } },
        { content: '(TO)', styles: { halign: 'center' } },
        { content: 'MAKE/MODEL', styles: { halign: 'center' } },
        { content: 'PLATE NUMBER', styles: { halign: 'center' } },
        { content: 'DRIVER', styles: { halign: 'center' } }
      ]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [0, 112, 192], textColor: 255, fontSize: 7, fontStyle: 'bold', lineWidth: 0.1 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      styles: { overflow: 'linebreak', cellWidth: 'wrap' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 30 },
        5: { cellWidth: 15 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
        8: { cellWidth: 20 },
        9: { cellWidth: 20 },
        10: { cellWidth: 25 }
      }
    });

    // Footer - To be accomplished by Security
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("To be accomplished by Security", 14, finalY);

    autoTable(doc, {
      startY: finalY + 2,
      head: [[
        'TIME OUT', 'KILOMETER READING (OUT)', 'TIME IN', 'KILOMETER READING (IN)'
      ]],
      body: [['', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [40, 167, 69], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { minCellHeight: 10 }
    });

    // Signatures
    const sigY = doc.lastAutoTable.finalY + 20;
    doc.text("PREPARED BY:", 14, sigY);
    doc.text("APPROVED BY:", 100, sigY);

    doc.save(`Trip_Ticket_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const isSundayInRange = (start, end) => {
    if (!start || !end) return false;
    const d1 = new Date(start);
    const d2 = new Date(end);
    for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) return true;
    }
    return false;
  };

  useEffect(() => {
    loadDashboardData();
  }, [filters, activeTab]);

  // Helper function to check if item request is pending current user's approval
  const isPendingMyApproval = (request) => {
    if (!request.approvals || !user) return false;

    // Check if there's a pending approval where the current user is the approver
    return request.approvals.some(approval =>
      approval.status === 'pending' &&
      approval.approver &&
      approval.approver.id === user.id
    );
  };

  // Helper function to check if vehicle request is pending current user's approval
  // For vehicle requests, we check based on approvals array and server-side flag
  const isPendingMyVehicleApproval = (request) => {
    if (!request || !user) return false;

    // Use server-side flag if available (most accurate)
    if (request.isPendingMyApproval !== undefined) {
      return request.isPendingMyApproval;
    }

    // Fallback: Check if there's a pending approval where the current user is the approver
    if (request.approvals && Array.isArray(request.approvals)) {
      return request.approvals.some(approval =>
        approval.status === 'pending' &&
        approval.approver &&
        approval.approver.id === user.id
      );
    }

    // Fallback: Check based on status and user role if approvals array is not available
    // Skip if request is completed, declined, or draft
    if (['completed', 'declined', 'draft'].includes(request.status)) {
      return false;
    }

    // Department approver can approve submitted or returned vehicle requests
    if ((user.role === 'department_approver' || user.role === 'super_administrator') &&
      (request.status === 'submitted' || request.status === 'returned')) {
      return true;
    }

    return false;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'item') {
        // Build query parameters with pagination and sorting
        const queryParams = {
          ...filters,
          limit: filters.limit || 10,
          page: filters.page || 1,
          sortBy: filters.sortBy || 'date',
          sortOrder: filters.sortOrder || 'desc'
        };

        const [requestsResponse, statsResponse] = await Promise.all([
          requestsAPI.getAll(queryParams),
          requestsAPI.getStats()
        ]);

        setRequests(requestsResponse.data.requests || []);

        // Update pagination info
        if (requestsResponse.data.pagination) {
          setPagination({
            total: requestsResponse.data.pagination.total || 0,
            pages: requestsResponse.data.pagination.pages || 0,
            currentPage: requestsResponse.data.pagination.page || 1
          });
        }
        setStats({
          ...statsResponse.data.stats,
          total: statsResponse.data.total
        });
      } else {
        // Load vehicle requests and stats
        // Build query parameters with pagination and sorting
        const queryParams = {
          ...filters,
          limit: filters.limit || 10,
          page: filters.page || 1,
          sortBy: filters.sortBy || 'date',
          sortOrder: filters.sortOrder || 'desc'
        };

        const [vehicleRequestsResponse, vehicleStatsResponse] = await Promise.all([
          serviceVehicleRequestsAPI.getAll(queryParams),
          serviceVehicleRequestsAPI.getStats()
        ]);

        const vehicleData = vehicleRequestsResponse.data?.requests || vehicleRequestsResponse.data || [];
        setVehicleRequests(Array.isArray(vehicleData) ? vehicleData : []);

        // Update pagination info for vehicle requests
        if (vehicleRequestsResponse.data?.pagination) {
          setPagination({
            total: vehicleRequestsResponse.data.pagination.total || 0,
            pages: vehicleRequestsResponse.data.pagination.pages || 0,
            currentPage: vehicleRequestsResponse.data.pagination.page || 1
          });
        }
        setVehicleStats({
          ...vehicleStatsResponse.data.stats,
          verificationStats: vehicleStatsResponse.data.verificationStats || {},
          total: vehicleStatsResponse.data.total
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    let label, color;

    if (activeTab === 'item') {
      const statusConfig = REQUEST_STATUSES.find(s => s.value === status);
      if (!statusConfig) return null;
      label = statusConfig.label;
      color = statusConfig.color;
    } else {
      // Vehicle request statuses
      const vehicleStatusMap = {
        'draft': { label: 'Draft', color: 'gray' },
        'submitted': { label: 'Submitted', color: 'blue' },
        'department_approved': { label: 'Department Approved', color: 'green' },
        'returned': { label: 'Returned', color: 'orange' },
        'declined': { label: 'Declined', color: 'red' },
        'completed': { label: 'Completed', color: 'green' }
      };
      const vehicleStatus = vehicleStatusMap[status];
      if (!vehicleStatus) {
        // Fallback for unknown statuses - show the status value itself
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status || 'Unknown'}
          </span>
        );
      }
      label = vehicleStatus.label;
      color = vehicleStatus.color;
    }

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}>
        {label}
      </span>
    );
  };

  const getStatsCards = () => {
    const cards = [];
    const currentStats = activeTab === 'item' ? stats : vehicleStats;

    if (user.role === 'requestor') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'My Drafts', count: currentStats.draft || 0, icon: FileText, color: 'gray' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Pending Approval', count: (currentStats.submitted || 0) + (currentStats.department_approved || 0), icon: Clock, color: 'yellow' },
          { title: 'Approved', count: (currentStats.it_manager_approved || 0) + (currentStats.service_desk_processing || 0), icon: CheckCircle, color: 'green' },
          { title: 'Declined', count: (currentStats.department_declined || 0) + (currentStats.it_manager_declined || 0), icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' }
        );
      } else {
        // Vehicle request stats
        cards.push(
          { title: 'My Drafts', count: currentStats.draft || 0, icon: FileText, color: 'gray' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Pending Approval', count: currentStats.submitted || 0, icon: Clock, color: 'yellow' },
          { title: 'Department Approved', count: currentStats.department_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Declined', count: currentStats.declined || 0, icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: Car, color: 'gray' }
        );
      }
    } else if (user.role === 'department_approver') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'Pending My Approval', count: currentStats.submitted || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Approved by Me', count: currentStats.department_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Declined by Me', count: currentStats.department_declined || 0, icon: XCircle, color: 'red' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: FileText, color: 'gray' }
        );
      } else {
        // Vehicle request stats for department approver
        const isODHC = user.department?.name?.toUpperCase()?.includes('ODHC');
        const verificationStats = currentStats.verificationStats || {};

        const deptCards = [
          { title: 'Pending My Approval', count: isODHC ? ((currentStats.submitted || 0) + (currentStats.department_approved || 0)) : (currentStats.submitted || 0), icon: AlertCircle, color: 'orange' },
          { title: isODHC ? 'Department Approved' : 'Approved by Me', count: currentStats.department_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Declined', count: currentStats.declined || 0, icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: Car, color: 'gray' }
        ];

        if (isODHC) {
          deptCards.unshift(
            { title: 'Pending Verification', count: verificationStats.pending || 0, icon: UserCheck, color: 'purple' },
            { title: 'Verif. Declined', count: verificationStats.declined || 0, icon: XCircle, color: 'red' }
          );
        }

        cards.push(...deptCards);
      }
    } else if (user.role === 'it_manager') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'Pending My Approval', count: currentStats.department_approved || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Approved by Me', count: currentStats.it_manager_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Declined by Me', count: currentStats.it_manager_declined || 0, icon: XCircle, color: 'red' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'In Processing', count: currentStats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' }
        );
      } else {
        // Vehicle requests don't go through IT manager
        cards.push(
          { title: 'Total Vehicle Requests', count: currentStats.total || 0, icon: Car, color: 'blue' }
        );
      }
    } else if (user.role === 'service_desk') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'To Process', count: currentStats.it_manager_approved || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Processing', count: currentStats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'green' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: FileText, color: 'blue' }
        );
      } else {
        // Vehicle requests don't go through service desk
        cards.push(
          { title: 'Total Vehicle Requests', count: currentStats.total || 0, icon: Car, color: 'blue' }
        );
      }
    } else {
      cards.push(
        { title: 'All Requests', count: currentStats.total || 0, icon: activeTab === 'item' ? FileText : Car, color: 'blue' },
        { title: 'Pending', count: (currentStats.submitted || 0) + (currentStats.department_approved || 0), icon: Clock, color: 'yellow' },
        { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'green' },
        { title: 'Declined', count: (currentStats.department_declined || 0) + (currentStats.it_manager_declined || 0) + (currentStats.declined || 0), icon: XCircle, color: 'red' }
      );
    }

    return cards;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img src={STC_LOGO} alt="STC Logo" className="h-8 w-8" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">General Services Request System</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Styrotech Corporation</div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.role.replace('_', ' ').toUpperCase()}</div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                {canManageUsers() && (
                  <button
                    onClick={() => navigate('/users')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Manage Users"
                  >
                    <Users className="h-5 w-5" />
                  </button>
                )}

                {isAdmin() && (
                  <>
                    <button
                      onClick={() => navigate('/departments')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Manage Departments"
                    >
                      <Building className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('Settings button clicked, navigating to /settings/workflows');
                        navigate('/settings/workflows');
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Workflow Settings"
                      type="button"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigate('/audit-logs')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Audit Logs"
                    >
                      <Shield className="h-5 w-5" />
                    </button>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {user.department?.name} • {user.title}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('item')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'item'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <FileText className="h-5 w-5 inline-block mr-2" />
              Item Requests
            </button>
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'vehicle'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Car className="h-5 w-5 inline-block mr-2" />
              Vehicle Requests
            </button>
          </nav>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {getStatsCards().map((card, index) => {
            const Icon = card.icon;
            const colorClasses = {
              gray: 'bg-gray-500',
              blue: 'bg-blue-500',
              green: 'bg-green-500',
              red: 'bg-red-500',
              yellow: 'bg-yellow-500',
              orange: 'bg-orange-500',
              purple: 'bg-purple-500'
            };

            return (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors duration-200">
                <div className="flex items-center">
                  <div className={`p-2 rounded-md ${colorClasses[card.color]}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{card.count}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex space-x-4">
            {user.role === 'requestor' && (
              <>
                <button
                  onClick={() => navigate('/forms')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </button>
              </>
            )}

            {activeTab === 'vehicle' && isODHC && selectedVehicleRequests.size > 0 && (
              <button
                onClick={handleGenerateTripTicket}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Trip Ticket ({selectedVehicleRequests.size})
              </button>
            )}
          </div>

          {/* Filters and Sorting */}
          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              {activeTab === 'item' ? (
                REQUEST_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))
              ) : (
                // Vehicle request statuses
                <>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="department_approved">Department Approved</option>
                  <option value="returned">Returned</option>
                  <option value="declined">Declined</option>
                  <option value="completed">Completed</option>
                </>
              )}
            </select>

            {/* Sort By */}
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="date">Sort by Date</option>
              <option value="status">Sort by Status</option>
              <option value="requestor">Sort by Requestor</option>
            </select>

            {/* Sort Order */}
            <button
              onClick={() => setFilters(prev => ({
                ...prev,
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                page: 1
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center space-x-1"
              title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {filters.sortOrder === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              <span className="text-sm">{filters.sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-colors duration-200">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent {activeTab === 'item' ? 'Item' : 'Vehicle'} Requests
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {activeTab === 'vehicle' && isODHC && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(vehicleRequests.map(r => r.id || r.request_id));
                              setSelectedVehicleRequests(allIds);
                            } else {
                              setSelectedVehicleRequests(new Set());
                            }
                          }}
                          checked={vehicleRequests.length > 0 && selectedVehicleRequests.size === vehicleRequests.length}
                        />
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activeTab === 'item' ? 'Request' : 'Reference Code'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requestor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {activeTab === 'item' ? (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                  ) : (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Request Type
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {activeTab === 'item' ? (
                  requests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p>No requests found</p>
                        {user.role === 'requestor' && (
                          <button
                            onClick={() => navigate('/forms')}
                            className="mt-2 text-blue-600 hover:text-blue-800"
                          >
                            Create your first request
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {isPendingMyApproval(request) && (
                                <span className="relative inline-flex items-center justify-center">
                                  <Bell className="h-5 w-5 text-orange-600 animate-pulse" title="Pending your approval" />
                                  <span className="absolute top-0 right-0 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                  </span>
                                </span>
                              )}
                              {request.requestNumber}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {request.userName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{request.requestor.fullName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{request.department.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {request.itemsCount} item{request.itemsCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {request.status === 'draft'
                            ? 'Not submitted yet'
                            : request.submittedAt
                              ? new Date(request.submittedAt).toLocaleDateString()
                              : new Date(request.createdAt).toLocaleDateString()
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              if (request.status === 'draft' && user.id === request.requestor.id) {
                                navigate(`/requests/${request.id}/edit`);
                              } else {
                                navigate(`/requests/${request.id}`);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900 flex items-center mr-3"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {request.status === 'draft' && user.id === request.requestor.id ? 'Edit' : 'View'}
                          </button>

                          {(
                            (request.status === 'draft' && user.id === request.requestor.id) ||
                            user.role === 'super_administrator' ||
                            activeTab === 'item' && isODHC
                          ) && (
                              <button
                                onClick={() => handleDelete(request.id, 'item')}
                                className="text-red-600 hover:text-red-900 flex items-center"
                                title="Delete Request"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </button>
                            )}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  vehicleRequests.length === 0 ? (
                    <tr>
                      <td colSpan={isODHC ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                        <Car className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p>No vehicle requests found</p>
                        {user.role === 'requestor' && (
                          <button
                            onClick={() => navigate('/forms')}
                            className="mt-2 text-blue-600 hover:text-blue-800"
                          >
                            Create your first vehicle request
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    vehicleRequests.map((request) => {
                      const requestorName = request.RequestedByUser?.fullName ||
                        (request.RequestedByUser?.firstName && request.RequestedByUser?.lastName
                          ? `${request.RequestedByUser.firstName} ${request.RequestedByUser.lastName}`
                          : request.requestor_name || 'Unknown');
                      const departmentName = request.Department?.name || 'No Department';

                      const hasSunday = isSundayInRange(request.travel_date_from, request.travel_date_to);
                      const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC') || user?.role === 'super_administrator';
                      const isAssignedVerifier = request.verifier_id === user.id && request.verification_status === 'pending';

                      return (
                        <tr key={request.id || request.request_id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 ${isAssignedVerifier ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                          {activeTab === 'vehicle' && isODHC && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                checked={selectedVehicleRequests.has(request.id || request.request_id)}
                                onChange={() => toggleRequestSelection(request.id || request.request_id)}
                              />
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                {isPendingMyVehicleApproval(request) && (
                                  <span className="relative inline-flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-orange-600 animate-pulse" title="Pending your approval" />
                                    <span className="absolute top-0 right-0 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                    </span>
                                  </span>
                                )}
                                {request.reference_code || `SVR-${request.id || request.request_id}`}

                                {isAssignedVerifier && (
                                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full ml-2 border border-purple-200">To Verify</span>
                                )}

                                {hasSunday && isODHC && (
                                  <span className="text-orange-600 ml-2" title="Travel includes Sunday - Verification Recommended">
                                    <Calendar className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {request.requestor_name || requestorName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">{requestorName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{departmentName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(request.status)}
                            {request.verification_status === 'verified' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  <UserCheck className="w-3 h-3 mr-1" />Verified
                                </span>
                              </div>
                            )}
                            {request.verification_status === 'declined' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                  <XCircle className="w-3 h-3 mr-1" />Verif. Declined
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {request.request_type ? request.request_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {request.status === 'draft'
                              ? 'Not submitted yet'
                              : request.submitted_at
                                ? new Date(request.submitted_at).toLocaleDateString()
                                : request.requested_date
                                  ? new Date(request.requested_date).toLocaleDateString()
                                  : new Date(request.created_at || request.createdAt).toLocaleDateString()
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                const requestId = request.id || request.request_id;
                                // Allow edit for draft or returned requests if user is the requestor
                                if ((request.status === 'draft' || request.status === 'returned') && user.id === request.requested_by) {
                                  navigate(`/service-vehicle-requests/${requestId}/edit`);
                                } else {
                                  navigate(`/service-vehicle-requests/${requestId}`);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-900 flex items-center mr-3"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {(request.status === 'draft' || request.status === 'returned') && user.id === request.requested_by ? 'Edit' : 'View'}
                            </button>

                            {(
                              (user.id === request.requested_by && ['draft', 'declined'].includes(request.status)) ||
                              isODHC
                            ) && (
                                <button
                                  onClick={() => handleDelete(request.id || request.request_id, 'vehicle')}
                                  className="text-red-600 hover:text-red-900 flex items-center"
                                  title="Delete Request"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span className="font-medium">{(pagination.currentPage - 1) * (filters.limit || 10) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.currentPage * (filters.limit || 10), pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> requests
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setFilters(prev => ({ ...prev, page: pageNum }))}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${pagination.currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                    disabled={pagination.currentPage === pagination.pages}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
