import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, 
  Search, 
  Edit, 
  Plus, 
  Trash2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  X,
  Download,
  ChevronRight,
  ChevronDown,
  List,
  FolderTree
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { departmentsAPI } from '../services/api';

// Recursive TreeNode component
const TreeNode = ({ node, level = 0, expandedNodes, onToggle, departments, onSync, onEdit, onDelete, syncingDept }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const dept = departments.find(d => d.id === node.id) || { ...node, isActive: node.isActive !== undefined ? node.isActive : true, adDn: node.adDn };
  
  return (
    <div className="tree-node">
      <div 
        className={`flex items-center py-2 px-4 hover:bg-gray-50 border-b border-gray-100 ${level > 0 ? 'bg-gray-50' : ''}`}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        <div className="flex items-center flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggle(node.id);
              }}
              className="mr-2 p-1 hover:bg-gray-200 rounded flex-shrink-0"
              type="button"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-6 mr-2 flex-shrink-0" />
          )}
          
          <Building className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <div className="text-sm font-medium text-gray-900">
                {node.name}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                dept.isActive !== false
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {dept.isActive !== false ? (
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
              {dept.adDn ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Synced
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Synced
                </span>
              )}
            </div>
            {node.description && (
              <div className="text-xs text-gray-500 mt-1">
                {node.description}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
            {!dept.adDn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSync(dept);
                }}
                disabled={syncingDept === dept.id}
                className={`text-green-600 hover:text-green-900 p-1 ${syncingDept === dept.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Sync to Active Directory"
                type="button"
              >
                <RefreshCw className={`h-4 w-4 ${syncingDept === dept.id ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(dept);
              }}
              className="text-blue-600 hover:text-blue-900 p-1"
              title="Edit Department"
              type="button"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(dept);
              }}
              className="text-red-600 hover:text-red-900 p-1"
              title="Delete Department"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              departments={departments}
              onSync={onSync}
              onEdit={onEdit}
              onDelete={onDelete}
              syncingDept={syncingDept}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    isActive: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [syncingDept, setSyncingDept] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'table'
  const [expandedNodes, setExpandedNodes] = useState(new Set()); // Start with empty set - all collapsed
  const [departmentTree, setDepartmentTree] = useState([]);

  // Redirect if user is not super admin
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard');
      return;
    }
    loadDepartments();
  }, [isAdmin, navigate]);

  // Load tree when switching to tree view
  useEffect(() => {
    if (viewMode === 'tree' && departmentTree.length === 0 && !loading) {
      loadDepartmentTree();
    }
  }, [viewMode]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentsAPI.getAll({ active: 'all' });
      const depts = response.data.departments || response.data;
      setDepartments(depts);
      
      // Also load tree hierarchy
      if (viewMode === 'tree') {
        await loadDepartmentTree();
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      alert('Error loading departments: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentTree = async () => {
    try {
      const response = await departmentsAPI.getHierarchy();
      const tree = response.data.departments || response.data || [];
      console.log('Loaded tree structure:', tree);
      setDepartmentTree(tree);
      
      // Start with all nodes collapsed (empty set)
      // Users will need to click to expand and see children
      setExpandedNodes(new Set());
    } catch (error) {
      console.error('Error loading department tree:', error);
      // Fallback to flat list if tree fails
      setDepartmentTree([]);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      console.log('Toggling node:', nodeId, 'Expanded nodes:', Array.from(newSet));
      return newSet;
    });
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'tree' && departmentTree.length === 0) {
      loadDepartmentTree();
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      parentId: '',
      isActive: true
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      parentId: department.parentDepartment?.id || '',
      isActive: department.isActive
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleDelete = async (department) => {
    const confirmMessage = department.adDn 
      ? `Are you sure you want to delete "${department.name}"?\n\nThis will delete the department from both the system and Active Directory.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${department.name}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await departmentsAPI.delete(department.id);
      const adDelete = response.data.adDelete;
      
      if (adDelete?.deleted) {
        alert(`Department deleted successfully!\n\n${adDelete.message}`);
      } else if (adDelete?.warning) {
        alert(`Department deleted from the system.\n\n⚠️ Warning: ${adDelete.warning}`);
      } else if (adDelete) {
        alert(`Department deleted successfully.\n\nNote: ${adDelete.message}`);
      } else {
        alert('Department deleted successfully');
      }
      
      await loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Error deleting department: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleSyncDepartment = async (department) => {
    try {
      setSyncingDept(department.id);
      const response = await departmentsAPI.sync(department.id);
      const adSync = response.data.adSync;
      
      if (adSync?.synced) {
        alert(`Department "${department.name}" synced successfully to Active Directory!\n\n${adSync.message}`);
      } else if (adSync?.isPermissionError) {
        alert(`Sync failed due to insufficient permissions.\n\n${adSync.message}\n\nPlease contact your Active Directory administrator.`);
      } else {
        alert(`Sync failed: ${adSync?.message || 'Unknown error'}`);
      }
      
      await loadDepartments();
    } catch (error) {
      console.error('Error syncing department:', error);
      alert('Error syncing department: ' + (error.response?.data?.message || error.message));
    } finally {
      setSyncingDept(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const response = await departmentsAPI.exportExcel({ active: 'all' });
      
      // Create blob and download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `departments_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting departments:', error);
      alert('Error exporting departments: ' + (error.response?.data?.message || error.message));
    } finally {
      setExporting(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name || formData.name.trim().length === 0) {
      errors.name = 'Department name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Department name must be at least 2 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || formData.name.trim(),
        parentId: formData.parentId || null,
        isActive: formData.isActive
      };

      if (showCreateModal) {
        const response = await departmentsAPI.create(submitData);
        const adSync = response.data.department.adSync;
        
        if (adSync?.synced) {
          alert('Department created successfully! Synced to Active Directory.');
        } else if (adSync?.isPermissionError) {
          alert(`Department created successfully in the system, but AD sync failed due to insufficient permissions.\n\n${adSync.message}\n\nPlease contact your Active Directory administrator to grant the necessary permissions.`);
        } else if (adSync?.disabled) {
          alert('Department created successfully! (AD sync is disabled)');
        } else {
          alert(`Department created successfully!${adSync?.message ? `\n\nNote: ${adSync.message}` : ''}`);
        }
      } else if (showEditModal && editingDepartment) {
        const response = await departmentsAPI.update(editingDepartment.id, submitData);
        const adSync = response.data.department.adSync;
        
        if (adSync?.synced) {
          alert('Department updated successfully! Synced to Active Directory.');
        } else if (adSync?.isPermissionError) {
          alert(`Department updated successfully in the system, but AD sync failed due to insufficient permissions.\n\n${adSync.message}\n\nPlease contact your Active Directory administrator to grant the necessary permissions.`);
        } else if (adSync?.disabled) {
          alert('Department updated successfully! (AD sync is disabled)');
        } else {
          alert(`Department updated successfully!${adSync?.message ? `\n\nNote: ${adSync.message}` : ''}`);
        }
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingDepartment(null);
      await loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Error saving department: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter tree nodes based on search
  const filterTree = (nodes, searchTerm) => {
    if (!searchTerm) return nodes;
    
    const filtered = [];
    nodes.forEach(node => {
      const matchesSearch = node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children, searchTerm) : [];
      
      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren
        });
      }
    });
    return filtered;
  };

  const filteredTree = searchTerm ? filterTree(departmentTree, searchTerm) : departmentTree;

  // Count all nodes in tree recursively
  const countTreeNodes = (nodes) => {
    let count = 0;
    nodes.forEach(node => {
      count++;
      if (node.children && node.children.length > 0) {
        count += countTreeNodes(node.children);
      }
    });
    return count;
  };

  const treeNodeCount = countTreeNodes(filteredTree);


  if (!isAdmin()) {
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
                  <Building className="h-6 w-6 mr-2" />
                  Department Management
                </h1>
                <p className="text-sm text-gray-600">Manage departments and sync to Active Directory</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                <button
                  onClick={() => handleViewModeChange('tree')}
                  className={`px-3 py-2 text-sm font-medium flex items-center ${
                    viewMode === 'tree'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Tree View"
                >
                  <FolderTree className="h-4 w-4 mr-1" />
                  Tree
                </button>
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`px-3 py-2 text-sm font-medium flex items-center border-l border-gray-300 ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Table View"
                >
                  <List className="h-4 w-4 mr-1" />
                  Table
                </button>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exporting...' : 'Export to Excel'}
              </button>
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Department
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Departments View */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Departments ({viewMode === 'tree' ? treeNodeCount : filteredDepartments.length})
            </h3>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : viewMode === 'tree' ? (
            <div className="overflow-y-auto max-h-[600px]">
              {filteredTree.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No departments found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search term.' : 'Create your first department to get started.'}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredTree.map(node => (
                    <TreeNode 
                      key={node.id} 
                      node={node}
                      expandedNodes={expandedNodes}
                      onToggle={toggleNode}
                      departments={departments}
                      onSync={handleSyncDepartment}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      syncingDept={syncingDept}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parent Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AD Sync
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDepartments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 mr-2 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">
                            {dept.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {dept.description || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {dept.parentDepartment?.name || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          dept.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {dept.isActive ? (
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {dept.adDn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Not Synced
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {!dept.adDn && (
                            <button
                              onClick={() => handleSyncDepartment(dept)}
                              disabled={syncingDept === dept.id}
                              className={`text-green-600 hover:text-green-900 ${syncingDept === dept.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Sync to Active Directory"
                            >
                              <RefreshCw className={`h-4 w-4 ${syncingDept === dept.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(dept)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit Department"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(dept)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Department"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredDepartments.length === 0 && (
                <div className="text-center py-12">
                  <Building className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No departments found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search term.' : 'Create your first department to get started.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {showCreateModal ? 'Create Department' : 'Edit Department'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingDepartment(null);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.name ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter department name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter department description"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Department
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">None (Root Department)</option>
                    {departments
                      .filter(d => !showEditModal || d.id !== editingDepartment?.id)
                      .map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setEditingDepartment(null);
                      setFormErrors({});
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {submitting ? 'Saving...' : showCreateModal ? 'Create' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;

