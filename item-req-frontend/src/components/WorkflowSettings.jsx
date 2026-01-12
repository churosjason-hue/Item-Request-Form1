import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Edit, 
  Check, 
  X, 
  Settings as SettingsIcon,
  FileText,
  Car,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { workflowsAPI, usersAPI, departmentsAPI } from '../services/api';

const FORM_TYPES = [
  { value: 'item_request', label: 'Item Request Form', icon: FileText },
  { value: 'vehicle_request', label: 'Vehicle Request Form', icon: Car }
];

const APPROVER_TYPES = [
  { value: 'role', label: 'By Role' },
  { value: 'user', label: 'By User' },
  { value: 'department', label: 'By Department' }
];

const APPROVER_ROLES = [
  { value: 'department_approver', label: 'Department Approver' },
  { value: 'it_manager', label: 'IT Manager' },
  { value: 'service_desk', label: 'Service Desk' },
  { value: 'super_administrator', label: 'Super Administrator' }
];

const SCOPE_OPTIONS = [
  { value: 'same_department', label: 'Same Department' },
  { value: 'cross_department', label: 'Cross Department' },
  { value: 'any', label: 'Any Department' }
];

export default function WorkflowSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    form_type: '',
    workflow_name: '',
    description: '',
    is_active: true,
    steps: []
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user?.role !== 'super_administrator') {
      navigate('/dashboard');
      return;
    }
    loadWorkflows();
    loadUsers();
    loadDepartments();
  }, [user, navigate]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await workflowsAPI.getAll();
      setWorkflows(response.data.workflows || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
      alert('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const handleEdit = (workflow) => {
    setFormData({
      form_type: workflow.form_type,
      workflow_name: workflow.workflow_name,
      description: workflow.description || '',
      is_active: workflow.is_active,
      steps: workflow.steps.map((step, index) => ({
        ...step,
        step_number: index + 1
      }))
    });
    setEditingId(workflow.id);
    setShowCreateForm(true);
  };

  const handleCreateNew = () => {
    setFormData({
      form_type: '',
      workflow_name: '',
      description: '',
      is_active: true,
      steps: []
    });
    setEditingId(null);
    setShowCreateForm(true);
    setErrors({});
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData({
      form_type: '',
      workflow_name: '',
      description: '',
      is_active: true,
      steps: []
    });
    setErrors({});
  };

  const addStep = () => {
    const newStepNumber = formData.steps.length + 1;
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          step_number: newStepNumber,
          approver_type: 'role',
          approver_role: '',
          approver_user_id: null,
          approver_department_id: null,
          scope: 'same_department',
          is_required: true
        }
      ]
    });
  };

  const removeStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step_number: i + 1
    }));
    setFormData({
      ...formData,
      steps: newSteps
    });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };
    setFormData({
      ...formData,
      steps: newSteps
    });
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.form_type) {
      newErrors.form_type = 'Form type is required';
    }
    
    if (!formData.workflow_name.trim()) {
      newErrors.workflow_name = 'Workflow name is required';
    }
    
    if (formData.steps.length === 0) {
      newErrors.steps = 'At least one approval step is required';
    }
    
    formData.steps.forEach((step, index) => {
      if (!step.approver_type) {
        newErrors[`step_${index}_approver_type`] = 'Approver type is required';
      }
      
      if (step.approver_type === 'role' && !step.approver_role) {
        newErrors[`step_${index}_approver_role`] = 'Approver role is required';
      }
      
      if (step.approver_type === 'user' && !step.approver_user_id) {
        newErrors[`step_${index}_approver_user`] = 'Approver user is required';
      }
      
      if (step.approver_type === 'department' && !step.approver_department_id) {
        newErrors[`step_${index}_approver_department`] = 'Approver department is required';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Ensure step numbers are sequential
      const stepsWithNumbers = formData.steps.map((step, index) => ({
        ...step,
        step_number: index + 1
      }));

      const dataToSave = {
        ...formData,
        steps: stepsWithNumbers
      };

      if (editingId) {
        await workflowsAPI.update(editingId, dataToSave);
        alert('Workflow updated successfully!');
      } else {
        await workflowsAPI.create(dataToSave);
        alert('Workflow created successfully!');
      }

      await loadWorkflows();
      handleCancel();
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert(error.response?.data?.message || 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      setLoading(true);
      await workflowsAPI.delete(id);
      alert('Workflow deleted successfully!');
      await loadWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert(error.response?.data?.message || 'Failed to delete workflow');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (workflow) => {
    try {
      setLoading(true);
      await workflowsAPI.update(workflow.id, {
        is_active: !workflow.is_active
      });
      await loadWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert(error.response?.data?.message || 'Failed to update workflow');
    } finally {
      setLoading(false);
    }
  };

  if (loading && workflows.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <SettingsIcon className="h-8 w-8 mr-3 text-blue-600" />
                Approval Workflow Settings
              </h1>
              <p className="text-gray-600 mt-2">
                Configure approval workflows for different form types
              </p>
            </div>
            {!showCreateForm && (
              <button
                onClick={handleCreateNew}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Workflow
              </button>
            )}
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Workflow' : 'Create New Workflow'}
            </h2>

            <div className="space-y-6">
              {/* Form Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Form Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.form_type}
                  onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                  disabled={!!editingId}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.form_type ? 'border-red-500' : 'border-gray-300'
                  } ${editingId ? 'bg-gray-100' : ''}`}
                >
                  <option value="">Select Form Type</option>
                  {FORM_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.form_type && (
                  <p className="text-red-500 text-sm mt-1">{errors.form_type}</p>
                )}
              </div>

              {/* Workflow Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Workflow Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.workflow_name}
                  onChange={(e) => setFormData({ ...formData, workflow_name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.workflow_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Standard Item Request Workflow"
                />
                {errors.workflow_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.workflow_name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description of this workflow"
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                  Active (Only one active workflow per form type)
                </label>
              </div>

              {/* Approval Steps */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Approval Steps <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                  </button>
                </div>

                {errors.steps && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-600 text-sm">{errors.steps}</p>
                  </div>
                )}

                {formData.steps.map((step, index) => (
                  <div key={index} className="mb-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">
                        Step {step.step_number}
                      </h3>
                      {formData.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Approver Type */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Approver Type <span className="text-red-600">*</span>
                        </label>
                        <select
                          value={step.approver_type}
                          onChange={(e) => updateStep(index, 'approver_type', e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors[`step_${index}_approver_type`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select Type</option>
                          {APPROVER_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        {errors[`step_${index}_approver_type`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`step_${index}_approver_type`]}</p>
                        )}
                      </div>

                      {/* Approver Role */}
                      {step.approver_type === 'role' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Approver Role <span className="text-red-600">*</span>
                          </label>
                          <select
                            value={step.approver_role}
                            onChange={(e) => updateStep(index, 'approver_role', e.target.value)}
                            className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              errors[`step_${index}_approver_role`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select Role</option>
                            {APPROVER_ROLES.map(role => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          {errors[`step_${index}_approver_role`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`step_${index}_approver_role`]}</p>
                          )}
                        </div>
                      )}

                      {/* Approver User */}
                      {step.approver_type === 'user' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Approver User <span className="text-red-600">*</span>
                          </label>
                          <select
                            value={step.approver_user_id || ''}
                            onChange={(e) => updateStep(index, 'approver_user_id', parseInt(e.target.value))}
                            className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              errors[`step_${index}_approver_user`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select User</option>
                            {users.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.fullName || `${user.firstName} ${user.lastName}`} ({user.role})
                              </option>
                            ))}
                          </select>
                          {errors[`step_${index}_approver_user`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`step_${index}_approver_user`]}</p>
                          )}
                        </div>
                      )}

                      {/* Approver Department */}
                      {step.approver_type === 'department' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Approver Department <span className="text-red-600">*</span>
                          </label>
                          <select
                            value={step.approver_department_id || ''}
                            onChange={(e) => updateStep(index, 'approver_department_id', parseInt(e.target.value))}
                            className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              errors[`step_${index}_approver_department`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select Department</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                          {errors[`step_${index}_approver_department`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`step_${index}_approver_department`]}</p>
                          )}
                        </div>
                      )}

                      {/* Scope */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Scope
                        </label>
                        <select
                          value={step.scope || 'same_department'}
                          onChange={(e) => updateStep(index, 'scope', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {SCOPE_OPTIONS.map(scope => (
                            <option key={scope.value} value={scope.value}>
                              {scope.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Required */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={step.is_required !== false}
                          onChange={(e) => updateStep(index, 'is_required', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-xs font-medium text-gray-700">
                          Required Step
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? 'Update' : 'Create'} Workflow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workflows List */}
        {!showCreateForm && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Existing Workflows</h2>
            </div>
            
            {workflows.length === 0 ? (
              <div className="p-12 text-center">
                <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No workflows configured yet</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-4 text-blue-600 hover:text-blue-800"
                >
                  Create your first workflow
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {workflows.map((workflow) => {
                  const FormIcon = FORM_TYPES.find(t => t.value === workflow.form_type)?.icon || FileText;
                  return (
                    <div key={workflow.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <FormIcon className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {workflow.workflow_name}
                              </h3>
                              {workflow.is_active && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              )}
                              {!workflow.is_active && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Form Type: <span className="font-medium">{FORM_TYPES.find(t => t.value === workflow.form_type)?.label}</span>
                            </p>
                            {workflow.description && (
                              <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                            )}
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">Approval Steps:</p>
                              <div className="flex flex-wrap gap-2">
                                {workflow.steps.map((step, index) => (
                                  <div key={index} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                    Step {step.step_number}: {step.approver_type === 'role' ? step.approver_role : step.approver_type === 'user' ? 'Specific User' : 'Department'} ({step.scope || 'same_department'})
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Created by {workflow.Creator?.fullName || 'Unknown'} on {new Date(workflow.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleActive(workflow)}
                            className={`p-2 rounded-md ${
                              workflow.is_active 
                                ? 'text-yellow-600 hover:bg-yellow-50' 
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={workflow.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {workflow.is_active ? <X className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                          </button>
                          <button
                            onClick={() => handleEdit(workflow)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                            title="Edit"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(workflow.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
