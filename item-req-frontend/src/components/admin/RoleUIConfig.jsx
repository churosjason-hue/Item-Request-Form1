import React, { useState, useEffect, useContext } from 'react';
import { settingsAPI } from '../../services/api';
import { ToastContext } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Save, RotateCcw } from 'lucide-react';

// ── All configurable sidebar items ─────────────────────────────
export const ALL_MENU_ITEMS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'it_requisition', label: 'IT Requisition Form' },
    { key: 'service_vehicle', label: 'Service Vehicle Request' },
    { key: 'users', label: 'Manage Users' },
    { key: 'departments', label: 'Departments' },
    { key: 'workflow_setup', label: 'Workflow Setup' },
    { key: 'workflows', label: 'Workflows' },
    { key: 'approval_matrix', label: 'Approval Matrix' },
    { key: 'audit_logs', label: 'Audit Logs' },
    { key: 'inventory', label: 'Inventory Management' },
    { key: 'deployed_assets', label: 'Deployed Assets' },
    { key: 'role_access', label: 'Role Access Config' },
];

// ── All roles ───────────────────────────────────────────────────
const ALL_ROLES = [
    { value: 'requestor', label: 'Requestor' },
    { value: 'department_approver', label: 'Department Approver' },
    { value: 'endorser', label: 'Endorser' },
    { value: 'it_manager', label: 'IT Manager' },
    { value: 'service_desk', label: 'Service Desk' },
    { value: 'super_administrator', label: 'Super Administrator' },
];

// ── Default config (what each role sees by default) ──────────────
export const DEFAULT_ROLE_UI_CONFIG = {
    requestor: ['dashboard', 'it_requisition', 'service_vehicle'],
    department_approver: ['dashboard', 'it_requisition', 'service_vehicle'],
    endorser: ['dashboard', 'it_requisition'],
    it_manager: ['dashboard', 'it_requisition', 'inventory', 'deployed_assets'],
    service_desk: ['dashboard', 'it_requisition', 'inventory', 'deployed_assets'],
    super_administrator: ALL_MENU_ITEMS.map(i => i.key),
};

const RoleUIConfig = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { success: toastSuccess, error: toastError } = useContext(ToastContext);

    const [config, setConfig] = useState(DEFAULT_ROLE_UI_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Redirect non-admins
    useEffect(() => {
        if (user && user.role !== 'super_administrator') {
            navigate('/dashboard');
        }
    }, [user]);

    // Load saved config
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = await settingsAPI.getRoleUIConfig();
                if (res.data.value && typeof res.data.value === 'object') {
                    // Merge with defaults so any new roles/items are included
                    setConfig({ ...DEFAULT_ROLE_UI_CONFIG, ...res.data.value });
                }
            } catch (err) {
                console.error('Failed to load role UI config:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggle = (role, menuKey) => {
        setConfig(prev => {
            const current = prev[role] || [];
            const updated = current.includes(menuKey)
                ? current.filter(k => k !== menuKey)
                : [...current, menuKey];
            return { ...prev, [role]: updated };
        });
    };

    const isChecked = (role, menuKey) => (config[role] || []).includes(menuKey);

    const toggleAll = (menuKey) => {
        const allChecked = ALL_ROLES.every(r => isChecked(r.value, menuKey));
        setConfig(prev => {
            const next = { ...prev };
            ALL_ROLES.forEach(r => {
                const current = next[r.value] || [];
                if (allChecked) {
                    next[r.value] = current.filter(k => k !== menuKey);
                } else {
                    if (!current.includes(menuKey)) next[r.value] = [...current, menuKey];
                }
            });
            return next;
        });
    };

    const toggleRole = (role) => {
        const allChecked = ALL_MENU_ITEMS.every(m => isChecked(role, m.key));
        setConfig(prev => ({
            ...prev,
            [role]: allChecked ? [] : ALL_MENU_ITEMS.map(m => m.key),
        }));
    };

    const handleReset = () => {
        if (confirm('Reset all permissions to defaults?')) {
            setConfig(DEFAULT_ROLE_UI_CONFIG);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsAPI.updateRoleUIConfig(config);
            toastSuccess('Role access configuration saved! Changes take effect on next sidebar load.');
        } catch (err) {
            console.error('Failed to save role UI config:', err);
            toastError(err.response?.data?.message || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Shield className="h-7 w-7 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Access Configuration</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure which sidebar menus are visible for each user role.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset to Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto shadow-sm">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-700/50 text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[180px] z-10">
                                Sidebar Item
                            </th>
                            {ALL_ROLES.map(role => (
                                <th key={role.value} className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">
                                    <div>{role.label}</div>
                                    {/* Toggle whole role column */}
                                    <button
                                        onClick={() => toggleRole(role.value)}
                                        className="mt-1 text-[10px] text-blue-500 hover:text-blue-700 font-normal underline"
                                    >
                                        {ALL_MENU_ITEMS.every(m => isChecked(role.value, m.key)) ? 'Uncheck all' : 'Check all'}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ALL_MENU_ITEMS.map((item, idx) => {
                            const allChecked = ALL_ROLES.every(r => isChecked(r.value, item.key));
                            return (
                                <tr
                                    key={item.key}
                                    className={`border-b border-gray-100 dark:border-gray-700 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                                >
                                    <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-800 dark:text-gray-200 z-10 border-r border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <span>{item.label}</span>
                                            {/* Toggle whole row */}
                                            <button
                                                onClick={() => toggleAll(item.key)}
                                                className="text-[10px] text-blue-500 hover:text-blue-700 underline ml-1"
                                                title={allChecked ? 'Uncheck all roles' : 'Check all roles'}
                                            >
                                                {allChecked ? 'none' : 'all'}
                                            </button>
                                        </div>
                                    </td>
                                    {ALL_ROLES.map(role => (
                                        <td key={role.value} className="px-3 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isChecked(role.value, item.key)}
                                                onChange={() => toggle(role.value, item.key)}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                                title={`${role.label} — ${item.label}`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                ℹ️ Changes take effect the next time a user loads the sidebar (page refresh after saving).
                Direct URL access is unaffected by these settings.
            </p>
        </div>
    );
};

export default RoleUIConfig;
