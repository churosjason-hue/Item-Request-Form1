import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Edit,
  UserCheck,
  UserX,
  RefreshCw,
  ArrowLeft,
  Shield,
  Building,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Download,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI, departmentsAPI, settingsAPI, USER_ROLES } from '../../services/api';

const ROLES_SETTINGS_KEY = 'workflow_custom_roles';

const UserManagement = () => {
  const navigate = useNavigate();
  const { user, canManageUsers } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    role: '',
    status: '',
    page: 1
  });
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'id'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [savedRoles, setSavedRoles] = useState([]); // custom roles from Workflow Setup

  // Redirect if user doesn't have permission
  useEffect(() => {
    if (!canManageUsers()) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [canManageUsers, navigate, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Set a high limit to get all users and include inactive users
      const usersParams = {
        ...filters,
        limit: 10000,
        active: 'all' // Get both active and inactive users
      };
      const [usersResponse, departmentsResponse] = await Promise.all([
        usersAPI.getAll(usersParams),
        departmentsAPI.getAll()
      ]);

      setUsers(usersResponse.data.users || usersResponse.data);
      setDepartments(departmentsResponse.data.departments || departmentsResponse.data);

      // Load saved custom roles from the same source as Workflow Setup
      try {
        const rolesRes = await settingsAPI.get(ROLES_SETTINGS_KEY);
        const rolesData = rolesRes.data?.value ?? rolesRes.data ?? [];
        setSavedRoles(Array.isArray(rolesData) ? rolesData : []);
      } catch {
        // If no roles saved yet, just leave as empty
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncUsers = async () => {
    try {
      setSyncing(true);
      await usersAPI.syncAll();
      await loadData();
      alert('User synchronization completed successfully!');
    } catch (error) {
      console.error('Error syncing users:', error);
      alert('Error syncing users: ' + (error.response?.data?.message || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser({
      ...userToEdit,
      newRole: userToEdit.role,
      newDepartment: userToEdit.department?.name || '',
      newCustomRoles: [...(userToEdit.customRoles || [])]
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    try {
      let updated = false;

      if (editingUser.newRole !== editingUser.role) {
        await usersAPI.updateRole(editingUser.id, editingUser.newRole);
        updated = true;
      }

      // Check for custom roles changes
      const currentCustomRoles = editingUser.customRoles || [];
      const newCustomRoles = editingUser.newCustomRoles || [];
      const customRolesChanged =
        currentCustomRoles.length !== newCustomRoles.length ||
        !currentCustomRoles.every(role => newCustomRoles.includes(role));

      if (customRolesChanged) {
        await usersAPI.updateCustomRoles(editingUser.id, newCustomRoles);
        updated = true;
      }

      // Only update department if it's different and not empty
      const newDeptValue = editingUser.newDepartment?.trim() || '';
      const currentDeptValue = editingUser.department?.name?.trim() || '';

      if (newDeptValue !== '' && newDeptValue !== currentDeptValue) {
        console.log('Updating department:', {
          userId: editingUser.id,
          newDepartment: newDeptValue,
          currentDepartment: currentDeptValue
        });
        try {
          await usersAPI.updateDepartment(editingUser.id, newDeptValue);
          updated = true;
        } catch (deptError) {
          // Re-throw department update errors with more context
          const errorMsg = deptError.response?.data?.message || deptError.message;
          throw new Error(`Failed to update department: ${errorMsg}`);
        }
      }

      if (updated) {
        await loadData();
        alert('User updated successfully!');
      } else {
        alert('No changes to save.');
      }

      setShowEditModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
      alert(`Error updating user: ${errorMessage}`);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await usersAPI.updateStatus(userId, !currentStatus);
      await loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error updating user status: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const response = await usersAPI.exportExcel(filters);

      // Create blob and download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting users:', error);
      alert('Error exporting users: ' + (error.response?.data?.message || error.message));
    } finally {
      setExporting(false);
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      'requestor': { label: 'Requestor', color: 'bg-gray-100 text-gray-800' },
      'department_approver': { label: 'Dept. Approver', color: 'bg-blue-100 text-blue-800' },
      'endorser': { label: 'Endorser', color: 'bg-teal-100 text-teal-800' },
      'it_manager': { label: 'IT Manager', color: 'bg-purple-100 text-purple-800' },
      'service_desk': { label: 'Service Desk', color: 'bg-green-100 text-green-800' },
      'super_administrator': { label: 'Super Admin', color: 'bg-red-100 text-red-800' }
    };

    const config = roleConfig[role] || { label: role, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Shield className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !filters.search ||
      u.username?.toLowerCase().includes(filters.search.toLowerCase()) ||
      u.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      u.firstName?.toLowerCase().includes(filters.search.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesDepartment = !filters.department || u.department?.id?.toString() === filters.department;
    const matchesRole = !filters.role || u.role === filters.role;
    const matchesStatus = !filters.status ||
      (filters.status === 'active' && u.isActive) ||
      (filters.status === 'inactive' && !u.isActive);

    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  // Sort filtered users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'name') {
      // Sort by full name (last name first, then first name)
      const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
      const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortBy === 'id') {
      // Sort by ID
      comparison = (a.id || 0) - (b.id || 0);
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (!canManageUsers()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Users className="h-6 w-6 mr-2" />
                  User Management
                </h1>
                <p className="text-sm text-gray-600">Manage user roles and permissions</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exporting...' : 'Export to Excel'}
              </button>
              <button
                onClick={handleSyncUsers}
                disabled={syncing}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync from AD'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                {USER_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="name">Name</option>
                  <option value="id">ID</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Users ({filteredUsers.length}) - Sorted by {sortBy === 'name' ? 'Name' : 'ID'} ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {u.firstName?.[0]}{u.lastName?.[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {u.email}
                            </div>
                            <div className="text-xs text-gray-400">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Building className="h-4 w-4 mr-2 text-gray-400" />
                          {u.department?.name || 'No Department'}
                        </div>
                        {u.title && (
                          <div className="text-xs text-gray-500">{u.title}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-2">
                          <div>{getRoleBadge(u.role)}</div>
                          {u.customRoles && u.customRoles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {u.customRoles.map(cr => (
                                <span key={cr} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  {cr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {u.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.lastLogin ? (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(u.lastLogin).toLocaleDateString()}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditUser(u)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                            className={`${u.isActive
                              ? 'text-red-600 hover:text-red-900'
                              : 'text-green-600 hover:text-green-900'
                              }`}
                            title={u.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search filters or sync users from Active Directory.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Edit User: {editingUser.firstName} {editingUser.lastName}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={editingUser.newRole}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, newRole: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {USER_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department (AD Attribute)
                </label>
                <input
                  type="text"
                  value={editingUser.newDepartment}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, newDepartment: e.target.value }))}
                  placeholder="Enter department name"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will update the Department attribute in Active Directory
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Matrix Roles
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md bg-gray-50">
                  {/* Let's allow adding arbitrary roles here */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      id="newCustomRoleInput"
                      list="customRoleDatalist"
                      placeholder="Type or pick a role..."
                      className="flex-1 rounded-md border-gray-300 text-sm py-1 px-2 border"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.target.value.trim();
                          if (val && !editingUser.newCustomRoles.includes(val)) {
                            setEditingUser(prev => ({
                              ...prev,
                              newCustomRoles: [...prev.newCustomRoles, val]
                            }));
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <datalist id="customRoleDatalist">
                      {savedRoles.map(r => <option key={r} value={r} />)}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('newCustomRoleInput');
                        const val = input?.value.trim();
                        if (val && !editingUser.newCustomRoles.includes(val)) {
                          setEditingUser(prev => ({
                            ...prev,
                            newCustomRoles: [...prev.newCustomRoles, val]
                          }));
                          if (input) input.value = '';
                        }
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {editingUser.newCustomRoles?.map(role => (
                      <span key={role} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {role}
                        <button
                          type="button"
                          onClick={() => setEditingUser(prev => ({
                            ...prev,
                            newCustomRoles: prev.newCustomRoles.filter(r => r !== role)
                          }))}
                          className="ml-1 text-indigo-500 hover:text-indigo-700"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {(!editingUser.newCustomRoles || editingUser.newCustomRoles.length === 0) && (
                      <p className="text-xs text-gray-500 italic w-full text-center py-2">No custom roles assigned.</p>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  These roles map the user to specific steps in the workflow Matrix.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;


