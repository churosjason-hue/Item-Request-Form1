import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, X, Shield, Building, User, FileText, ArrowLeft, Settings } from 'lucide-react';
import { approvalMatrixAPI, departmentsAPI, workflowsAPI, USER_ROLES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const FORM_TYPES = [
    { value: 'item_request', label: 'Item Request' },
    { value: 'vehicle_request', label: 'Vehicle Request' }
];

export default function ApprovalMatrixSettings() {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const [rules, setRules] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        form_type: 'item_request',
        department_id: '',
        role: 'department_approver',
        user_id: '',
        is_active: true
    });

    useEffect(() => {
        if (!isAdmin()) {
            navigate('/dashboard');
            return;
        }
        loadData();
    }, [isAdmin, navigate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rulesRes, deptsRes, usersRes] = await Promise.all([
                approvalMatrixAPI.getAll(),
                departmentsAPI.getAll(),
                workflowsAPI.getAllUsers()
            ]);
            setRules(rulesRes.data?.rules || []);
            setDepartments(deptsRes.data?.departments || deptsRes.data || []);
            setUsers(usersRes.data?.users || usersRes.data || []);
        } catch (err) {
            console.error('Failed to load matrix rules data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                form_type: rule.form_type,
                department_id: rule.department_id,
                role: rule.role,
                user_id: rule.user_id,
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            setFormData({
                form_type: 'item_request',
                department_id: departments.length > 0 ? departments[0].id : '',
                role: 'department_approver',
                user_id: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this routing rule?')) return;
        try {
            await approvalMatrixAPI.delete(id);
            setRules(rules.filter(r => r.id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting rule');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.department_id) {
            alert('Please select a department');
            return;
        }
        if (!formData.user_id) {
            alert('Please select a user');
            return;
        }

        setSaving(true);
        try {
            if (editingRule) {
                await approvalMatrixAPI.update(editingRule.id, formData);
            } else {
                await approvalMatrixAPI.create(formData);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving rule');
        } finally {
            setSaving(false);
        }
    };

    const getFormLabel = (val) => FORM_TYPES.find(f => f.value === val)?.label || val;
    const getRoleLabel = (val) => USER_ROLES.find(r => r.value === val)?.label || val;

    if (loading && rules.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/settings/workflows')}
                        className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" />
                        Back to Workflows Settings
                    </button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Approval Matrix Rules</h1>
                            <p className="text-gray-600 mt-1">Explicitly map specific users to act as an approver for certain departments and forms.</p>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Add Rule
                        </button>
                    </div>
                </div>

                {/* Rules Table */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {rules.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <Settings className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-2">No custom routing rules configured.</p>
                            <p className="text-sm text-gray-400">By default, workflows look for users in the requestor's department that have the required role.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form/Request Type</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Department</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow Role</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Approver (User)</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {rules.map((rule) => (
                                        <tr key={rule.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center text-sm font-medium text-gray-900">
                                                    <FileText className="h-4 w-4 text-gray-400 mr-2" />
                                                    {getFormLabel(rule.form_type)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center text-sm text-gray-700">
                                                    <Building className="h-4 w-4 text-blue-400 mr-2" />
                                                    {rule.Department?.name || `Dept ID: ${rule.department_id}`}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                                    {getRoleLabel(rule.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center text-sm text-gray-900">
                                                    <User className="h-4 w-4 text-green-500 mr-2" />
                                                    {rule.User ? `${rule.User.first_name} ${rule.User.last_name}` : `User ID: ${rule.user_id}`}
                                                </div>
                                                <div className="text-xs text-gray-500 ml-6">
                                                    {rule.User?.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenModal(rule)}
                                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)}></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-xl leading-6 font-semibold text-gray-900" id="modal-title">
                                    {editingRule ? 'Edit Approval Matrix Rule' : 'New Approval Matrix Rule'}
                                </h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <span className="sr-only">Close</span>
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Form Type</label>
                                    <select
                                        value={formData.form_type}
                                        onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        required
                                    >
                                        {FORM_TYPES.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Target Department</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                            <Building className="h-4 w-4" />
                                        </span>
                                        <select
                                            value={formData.department_id}
                                            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            required
                                        >
                                            <option value="">Select a department...</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Workflow Role To Fulfill</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                            <Shield className="h-4 w-4" />
                                        </span>
                                        <input
                                            type="text"
                                            list="roleSuggestions"
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            required
                                            placeholder="e.g., Supervisor, department_approver"
                                        />
                                        <datalist id="roleSuggestions">
                                            {USER_ROLES.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Assigned Approver (User)</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                            <User className="h-4 w-4" />
                                        </span>
                                        <select
                                            value={formData.user_id}
                                            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            required
                                        >
                                            <option value="">Select a user...</option>
                                            {users.filter(u => u.is_active).map(u => (
                                                <option key={u.id} value={u.id}>{u.fullName || `${u.first_name} ${u.last_name}`} - {u.email} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        This user will receive approval requests for the selected Form, Department, and Role regardless of their actual department.
                                    </p>
                                </div>

                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Rule'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
