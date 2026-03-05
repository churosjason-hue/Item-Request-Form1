import React, { useState, useEffect, useCallback } from 'react';
import {
    Building, Tag, Users, GitBranch, Plus, Trash2, Edit2, Save,
    X, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader, ArrowRight, Shield,
    User as UserIcon
} from 'lucide-react';
import { departmentsAPI, usersAPI, workflowsAPI, settingsAPI, approvalMatrixAPI, USER_ROLES } from '../../services/api';

import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const FORM_TYPES = [
    { value: 'item_request', label: 'Item Request' },
    { value: 'vehicle_request', label: 'Vehicle Request' }
];

const TABS = [
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'roles', label: 'Roles', icon: Tag },
    { id: 'users', label: 'User → Role', icon: Users },
    { id: 'sequences', label: 'Approval Sequences', icon: GitBranch },
    { id: 'matrix', label: 'Approval Matrix', icon: Shield }
];

// ─── Toast helper ────────────────────────────────────────────────
function useToast() {
    const [toast, setToast] = useState(null);
    const show = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };
    return { toast, show };
}

function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all
      ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
        </div>
    );
}

// ─── Tab 1: Departments ──────────────────────────────────────────
function DepartmentsTab({ departments, setDepartments, toast }) {
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [editing, setEditing] = useState(null); // { id, name, description }
    const [saving, setSaving] = useState(false);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const res = await departmentsAPI.create({ name: newName.trim(), description: newDesc.trim() });
            const dept = res.data?.department || res.data;
            setDepartments(prev => [...prev, dept]);
            setNewName(''); setNewDesc('');
            toast.show('Department created');
        } catch (e) { toast.show(e.response?.data?.message || 'Error creating department', 'error'); }
        finally { setSaving(false); }
    };

    const handleUpdate = async () => {
        if (!editing?.name?.trim()) return;
        setSaving(true);
        try {
            await departmentsAPI.update(editing.id, { name: editing.name, description: editing.description });
            setDepartments(prev => prev.map(d => d.id === editing.id ? { ...d, ...editing } : d));
            setEditing(null);
            toast.show('Department updated');
        } catch (e) { toast.show(e.response?.data?.message || 'Error updating department', 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this department? This cannot be undone.')) return;
        try {
            await departmentsAPI.delete(id);
            setDepartments(prev => prev.filter(d => d.id !== id));
            toast.show('Department deleted');
        } catch (e) { toast.show(e.response?.data?.message || 'Error deleting department', 'error'); }
    };

    return (
        <div className="space-y-4">
            {/* Add form */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-700 mb-3">Add New Department</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder="Department name *"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving || !newName.trim()}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {departments.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No departments yet. Add one above.</p>
                )}
                {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
                        {editing?.id === dept.id ? (
                            <>
                                <Building className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <input
                                    value={editing.name}
                                    onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                    className="flex-1 border-b border-blue-400 text-sm bg-transparent focus:outline-none"
                                />
                                <input
                                    value={editing.description || ''}
                                    onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                                    className="flex-1 border-b border-gray-300 text-sm text-gray-500 bg-transparent focus:outline-none"
                                    placeholder="Description"
                                />
                                <button onClick={handleUpdate} disabled={saving} className="p-1 text-green-600 hover:text-green-700">
                                    <Save className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-800">{dept.name}</div>
                                    {dept.description && <div className="text-xs text-gray-400 truncate">{dept.description}</div>}
                                </div>
                                <button onClick={() => setEditing({ id: dept.id, name: dept.name, description: dept.description })} className="p-1 text-gray-400 hover:text-blue-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(dept.id)} className="p-1 text-gray-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Tab 2: Roles ────────────────────────────────────────────────
const ROLES_SETTINGS_KEY = 'workflow_custom_roles';

function RolesTab({ roles, setRoles, toast }) {
    const [newRole, setNewRole] = useState('');
    const [saving, setSaving] = useState(false);

    const persistRoles = async (updatedRoles) => {
        setSaving(true);
        try {
            await settingsAPI.update(ROLES_SETTINGS_KEY, updatedRoles);
        } catch (e) {
            toast.show('Could not save roles to database', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAdd = async () => {
        const val = newRole.trim();
        if (!val || roles.includes(val)) return;
        const updated = [...roles, val];
        setRoles(updated);
        setNewRole('');
        toast.show(`Role "${val}" saved`);
        await persistRoles(updated);
    };

    const handleDelete = async (role) => {
        const updated = roles.filter(r => r !== role);
        setRoles(updated);
        toast.show(`Role "${role}" removed`);
        await persistRoles(updated);
    };

    return (
        <div className="space-y-4 max-w-lg">
            <p className="text-sm text-gray-500">
                Define the custom role names used in your approval workflows. These are the labels you'll assign to users and plot on approval steps (e.g., <em>Supervisor</em>, <em>Head Manager</em>).
            </p>

            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="New role name (e.g. Supervisor)"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newRole.trim() || saving}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {roles.length === 0 && (
                    <p className="text-gray-400 text-sm">No custom roles yet.</p>
                )}
                {roles.map(role => (
                    <span key={role} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full text-sm font-medium">
                        <Tag className="w-3 h-3" />
                        {role}
                        <button onClick={() => handleDelete(role)} disabled={saving} className="ml-1 text-indigo-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Tab 3: User → Role Assignment ──────────────────────────────
function UsersTab({ users, setUsers, roles, departments, toast }) {
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [systemRoleFilter, setSystemRoleFilter] = useState('');
    const [customRoleFilter, setCustomRoleFilter] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [bulkDept, setBulkDept] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);

    // Derive unique custom roles across all users for the filter dropdown
    const allCustomRoles = [...new Set(users.flatMap(u => u.customRoles || []))].sort();

    const filtered = users.filter(u => {
        const matchSearch = !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
        const matchDept = !deptFilter || u.department?.id === Number(deptFilter);
        const matchSystemRole = !systemRoleFilter || u.role === systemRoleFilter;
        const matchCustomRole = !customRoleFilter || (u.customRoles || []).includes(customRoleFilter);
        return matchSearch && matchDept && matchSystemRole && matchCustomRole;
    });

    const allChecked = filtered.length > 0 && filtered.every(u => checkedIds.has(u.id));
    const someChecked = checkedIds.size > 0;

    const toggleCheck = (id, e) => {
        e.stopPropagation();
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (allChecked) setCheckedIds(new Set());
        else setCheckedIds(new Set(filtered.map(u => u.id)));
    };

    const handleBulkAssign = async () => {
        setBulkSaving(true);
        const ids = [...checkedIds];
        const dept = bulkDept ? departments.find(d => d.id === Number(bulkDept)) : null;
        try {
            await Promise.all(ids.map(id => usersAPI.assignDepartment(id, bulkDept || null)));
            setUsers(prev => prev.map(u =>
                checkedIds.has(u.id)
                    ? { ...u, department: dept ? { id: dept.id, name: dept.name } : null }
                    : u
            ));
            if (selectedUser && checkedIds.has(selectedUser.id)) {
                setSelectedUser(prev => ({ ...prev, department: dept ? { id: dept.id, name: dept.name } : null }));
            }
            toast.show(`Department assigned to ${ids.length} user${ids.length !== 1 ? 's' : ''}`);
            setCheckedIds(new Set());
            setBulkDept('');
        } catch (e) {
            toast.show(e.response?.data?.message || 'Error during bulk assign', 'error');
        } finally {
            setBulkSaving(false);
        }
    };

    const handleAddRole = async () => {
        const val = newTag.trim();
        if (!val || !selectedUser) return;
        const current = selectedUser.customRoles || [];
        if (current.includes(val)) return;
        await saveRoles([...current, val]);
        setNewTag('');
    };

    const handleRemoveRole = async (role) => {
        await saveRoles((selectedUser.customRoles || []).filter(r => r !== role));
    };

    const saveRoles = async (newRoles) => {
        setSaving(true);
        try {
            await usersAPI.updateCustomRoles(selectedUser.id, newRoles);
            const updatedUser = { ...selectedUser, customRoles: newRoles };
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
            toast.show('Roles saved');
        } catch (e) { toast.show(e.response?.data?.message || 'Error saving roles', 'error'); }
        finally { setSaving(false); }
    };

    const handleRoleChange = async (newRole) => {
        setSaving(true);
        try {
            await usersAPI.updateRole(selectedUser.id, newRole);
            const updatedUser = { ...selectedUser, role: newRole };
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
            toast.show('System role updated');
        } catch (e) { toast.show(e.response?.data?.message || 'Error updating role', 'error'); }
        finally { setSaving(false); }
    };

    const handleDeptChange = async (deptId) => {
        setSaving(true);
        try {
            await usersAPI.assignDepartment(selectedUser.id, deptId || null);
            const newDept = deptId ? departments.find(d => d.id === Number(deptId)) : null;
            const updatedUser = { ...selectedUser, department: newDept ? { id: newDept.id, name: newDept.name } : null };
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
            toast.show('Department saved');
        } catch (e) { toast.show(e.response?.data?.message || 'Error saving department', 'error'); }
        finally { setSaving(false); }
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* Left: User list with checkboxes */}
            <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="bg-gray-50 border-b border-gray-200 p-3 space-y-2">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <select
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                    >
                        <option value="">All departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select
                        value={systemRoleFilter}
                        onChange={e => setSystemRoleFilter(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                    >
                        <option value="">All system roles</option>
                        {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select
                        value={customRoleFilter}
                        onChange={e => setCustomRoleFilter(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                    >
                        <option value="">All custom roles</option>
                        {allCustomRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {/* Select-all bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">
                        {someChecked ? `${checkedIds.size} selected` : `Select all (${filtered.length})`}
                    </span>
                    {someChecked && (
                        <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    )}
                </div>
                {/* User rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No users found</p>}
                    {filtered.map(u => (
                        <div
                            key={u.id}
                            onClick={() => { if (!someChecked) setSelectedUser(u); }}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer
                                ${selectedUser?.id === u.id && !someChecked ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
                                ${checkedIds.has(u.id) ? 'bg-indigo-50' : ''}`}
                        >
                            <input
                                type="checkbox"
                                checked={checkedIds.has(u.id)}
                                onChange={e => toggleCheck(u.id, e)}
                                className="mt-1 w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
                                onClick={e => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0" onClick={() => setSelectedUser(u)}>
                                <div className="font-medium text-sm text-gray-800">{u.firstName} {u.lastName}</div>
                                <div className="text-xs text-gray-400 truncate">{u.email}</div>
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <Building className="w-3 h-3 flex-shrink-0" />
                                    {u.department?.name || <span className="italic text-gray-300">No dept</span>}
                                </div>
                                {u.customRoles?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {u.customRoles.map(r => (
                                            <span key={r} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded">{r}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Editor */}
            <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-4">
                {someChecked ? (
                    /* Bulk assign panel */
                    <>
                        <div className="pb-3 border-b border-gray-100">
                            <div className="font-semibold text-gray-800">{checkedIds.size} user{checkedIds.size !== 1 ? 's' : ''} selected</div>
                            <div className="text-xs text-gray-400 mt-0.5">Assign all selected users to a department at once.</div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assign to Department</label>
                            <select
                                value={bulkDept}
                                onChange={e => setBulkDept(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">— No department (unassign) —</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <button
                                onClick={handleBulkAssign}
                                disabled={bulkSaving}
                                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {bulkSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {bulkSaving ? 'Saving...' : `Assign ${checkedIds.size} User${checkedIds.size !== 1 ? 's' : ''}`}
                            </button>
                            <p className="text-xs text-gray-400 mt-2">This only updates the app database, not Active Directory.</p>
                        </div>
                    </>
                ) : !selectedUser ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                        <div className="text-center">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <div>✓ Check users to bulk-assign a department</div>
                            <div className="mt-1 text-xs">or click a row to edit individually</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* User info */}
                        <div className="pb-3 border-b border-gray-100">
                            <div className="font-semibold text-gray-800">{selectedUser.firstName} {selectedUser.lastName}</div>
                            <div className="text-sm text-gray-500">{selectedUser.email}</div>
                        </div>

                        {/* System Role (editable) */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">System Role</label>
                            <select
                                value={selectedUser.role || ''}
                                onChange={e => handleRoleChange(e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">— Select role —</option>
                                {USER_ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Department assignment */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Department</label>
                            <select
                                value={selectedUser.department?.id || ''}
                                onChange={e => handleDeptChange(e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                            >
                                <option value="">— No department —</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">This only updates the app database, not Active Directory.</p>
                        </div>

                        {/* Custom roles */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Custom Roles</label>
                            <div className="flex flex-wrap gap-2 min-h-8 mb-2">
                                {(selectedUser.customRoles || []).length === 0 && (
                                    <span className="text-xs text-gray-400 italic">No roles assigned</span>
                                )}
                                {(selectedUser.customRoles || []).map(role => (
                                    <span key={role} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                                        {role}
                                        <button onClick={() => handleRemoveRole(role)} disabled={saving} className="text-indigo-400 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    list="roleTagList"
                                    placeholder="Add a role..."
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                                <datalist id="roleTagList">
                                    {roles.map(r => <option key={r} value={r} />)}
                                </datalist>
                                <button
                                    onClick={handleAddRole}
                                    disabled={saving || !newTag.trim()}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Type a role name or pick from your saved Roles list.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


// ─── Tab 4: Approval Sequences ───────────────────────────────────
// Common request statuses users can pick for each approval step
const STATUS_OPTIONS = [
    { value: 'department_approved', label: 'Department Approved' },
    { value: 'it_manager_approved', label: 'IT Manager Approved' },
    { value: 'service_desk_processing', label: 'Service Desk Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending_verification', label: 'Pending Verification' },
    { value: 'verified', label: 'Verified' },
    { value: 'approved', label: 'Approved (Generic)' },
];

// Default status per step index (keeps backward compat when user doesn't pick)
const DEFAULT_STATUS = (idx) => {
    const map = ['department_approved', 'it_manager_approved', 'service_desk_processing'];
    return map[idx] || `step_${idx + 1}_approved`;
};

function SequencesTab({ departments, roles, toast }) {
    const [formType, setFormType] = useState('item_request');
    const [workflows, setWorkflows] = useState([]); // [{id?, department_id, steps:[{role}]}]
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false); // dept_id being saved (or 'global' for null department)

    // Load workflows for the selected form type
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await workflowsAPI.getAll({ form_type: formType });
            const wfs = res.data?.workflows || res.data || [];
            // Build a workflow entry per department (and global)
            const byDept = {};
            wfs.forEach(wf => {
                const key = wf.department_id ?? 'global';
                byDept[key] = {
                    id: wf.id,
                    department_id: wf.department_id,
                    name: wf.name || wf.workflow_name,
                    is_default: wf.is_default,
                    steps: (wf.steps || wf.Steps || [])
                        .slice()
                        .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
                        .map(s => ({
                            id: s.id,
                            role: s.approver_role || s.approver_type,
                            status: s.status_on_approval || '',
                            step_order: s.step_order
                        }))
                };
            });
            setWorkflows(Object.values(byDept));
        } catch (e) { toast.show('Failed to load workflows', 'error'); }
        finally { setLoading(false); }
    }, [formType]);

    useEffect(() => { load(); }, [load]);

    // Add a new blank department config
    const addDeptConfig = (deptId) => {
        // deptId may be null (global) or a numeric id
        const key = deptId ?? 'global';
        if (workflows.find(w => (w.department_id ?? 'global') === key)) return; // already added
        setWorkflows(prev => [...prev, { department_id: deptId, steps: [{ role: '', status: DEFAULT_STATUS(0) }] }]);
    };

    const updateStep = (deptId, stepIdx, field, value) => {
        setWorkflows(prev => prev.map(w => {
            if (w.department_id !== deptId) return w;
            const steps = [...w.steps];
            steps[stepIdx] = { ...steps[stepIdx], [field]: value };
            return { ...w, steps };
        }));
    };

    const addStep = (deptId) => {
        setWorkflows(prev => prev.map(w => {
            if (w.department_id !== deptId) return w;
            const nextIdx = w.steps.length;
            return { ...w, steps: [...w.steps, { role: '', status: DEFAULT_STATUS(nextIdx) }] };
        }));
    };

    const removeStep = (deptId, stepIdx) => {
        setWorkflows(prev => prev.map(w => {
            if (w.department_id !== deptId) return w;
            const steps = w.steps.filter((_, i) => i !== stepIdx);
            return { ...w, steps: steps.length ? steps : [{ role: '' }] };
        }));
    };

    const removeConfig = (deptId) => {
        setWorkflows(prev => prev.filter(w => w.department_id !== deptId));
    };

    const saveConfig = async (wf) => {
        // Guard: all steps must have a role name
        const emptySteps = wf.steps.filter(s => !s.role?.trim());
        if (emptySteps.length > 0) {
            toast.show('Please fill in all role names before saving.', 'error');
            return;
        }
        setSaving(wf.department_id ?? 'global');
        try {
            const dept = departments.find(d => d.id === wf.department_id);
            const deptName = dept?.name || 'Global';
            const payload = {
                form_type: formType,
                department_id: wf.department_id ?? null,
                name: `${deptName} - ${FORM_TYPES.find(f => f.value === formType)?.label || formType} Workflow`,
                is_active: true,
                is_default: !wf.department_id,
                steps: wf.steps.map((s, idx) => ({
                    step_name: `Step ${idx + 1}`,
                    step_order: idx + 1,
                    approver_type: 'custom_matrix_role',
                    approver_role: s.role,
                    requires_same_department: true,
                    status_on_approval: s.status?.trim() || DEFAULT_STATUS(idx)
                }))
            };

            if (wf.id) {
                await workflowsAPI.update(wf.id, payload);
            } else {
                const res = await workflowsAPI.create(payload);
                const newId = res.data?.workflow?.id;
                setWorkflows(prev => prev.map(w => w.department_id === wf.department_id ? { ...w, id: newId } : w));
            }
            toast.show(`Workflow saved for ${deptName}`);
        } catch (e) {
            const msg = e.response?.data?.message || 'Error saving workflow';
            toast.show(msg, 'error');
        }
        finally { setSaving(false); }
    };

    const availableDepts = departments.filter(d => !workflows.find(w => w.department_id === d.id));

    return (
        <div className="space-y-4">
            {/* Form type picker */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Form Type:</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {FORM_TYPES.map(ft => (
                        <button
                            key={ft.value}
                            onClick={() => setFormType(ft.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${formType === ft.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            {ft.label}
                        </button>
                    ))}
                </div>
                {loading && <Loader className="w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {/* Department configs */}
            <div className="space-y-3">
                {workflows.length === 0 && !loading && (
                    <p className="text-sm text-gray-400 text-center py-8">No sequences configured yet for this form type. Add a department below.</p>
                )}

                {workflows.map(wf => {
                    const dept = departments.find(d => d.id === wf.department_id);
                    return (
                        <div key={wf.department_id ?? 'global'} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                <Building className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-sm text-gray-700 flex-1">
                                    {dept?.name || 'Global (All Departments)'}
                                </span>
                                {wf.id && <span className="text-xs text-green-600 font-medium">Saved</span>}
                                <button
                                    onClick={() => saveConfig(wf)}
                                    disabled={saving === (wf.department_id ?? 'global')}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving === (wf.department_id ?? 'global') ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Save
                                </button>
                                <button onClick={() => removeConfig(wf.department_id)} className="p-1 text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Steps */}
                            <div className="p-4 space-y-2">
                                {wf.steps.map((step, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-14 text-xs font-semibold text-gray-400 text-right flex-shrink-0">Step {idx + 1}</span>
                                            <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                            {/* Role input */}
                                            <input
                                                type="text"
                                                list="seqRoleList"
                                                placeholder="Role (e.g. Supervisor)"
                                                value={step.role}
                                                onChange={e => updateStep(wf.department_id, idx, 'role', e.target.value)}
                                                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            {/* Status — free text + preset suggestions */}
                                            <input
                                                type="text"
                                                list="seqStatusList"
                                                placeholder="Status on approval..."
                                                value={step.status || DEFAULT_STATUS(idx)}
                                                onChange={e => updateStep(wf.department_id, idx, 'status', e.target.value)}
                                                className="w-52 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <datalist id="seqStatusList">
                                                {STATUS_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </datalist>
                                            <button onClick={() => removeStep(wf.department_id, idx)} className="p-1 text-gray-300 hover:text-red-500">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="ml-20 text-[10px] text-gray-400">
                                            When approved → sets status to <code className="bg-gray-100 px-1 rounded">{step.status || DEFAULT_STATUS(idx)}</code>
                                        </div>
                                    </div>
                                ))}
                                <datalist id="seqRoleList">
                                    {roles.map(r => <option key={r} value={r} />)}
                                </datalist>
                                <button
                                    onClick={() => addStep(wf.department_id)}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Step
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add department / Global buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Global button — only show if no global workflow yet */}
                {!workflows.find(w => w.department_id == null) && (
                    <button
                        onClick={() => addDeptConfig(null)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-blue-400 text-blue-600 rounded-md text-sm hover:bg-blue-50"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Global (All Departments)
                    </button>
                )}

                {/* Department-specific selector */}
                {availableDepts.length > 0 && (
                    <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 max-w-xs"
                        defaultValue=""
                        onChange={e => {
                            if (e.target.value) {
                                addDeptConfig(Number(e.target.value));
                                e.target.value = '';
                            }
                        }}
                    >
                        <option value="">+ Add department configuration...</option>
                        {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                )}
            </div>
        </div>
    );
}

// ─── Tab 5: Approval Matrix ──────────────────────────────────
function ApprovalMatrixTab({ departments, users, roles, toast }) {
    const [formType, setFormType] = useState('item_request');
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Matrix list filters
    const [matrixSearch, setMatrixSearch] = useState('');
    const [matrixDeptFilter, setMatrixDeptFilter] = useState('');

    // Form state for adding a new rule
    const [form, setForm] = useState({ department_id: '', role: '', user_id: '' });

    // Searchable dropdown state
    const [deptSearch, setDeptSearch] = useState('');
    const [deptOpen, setDeptOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [userOpen, setUserOpen] = useState(false);

    // Derived selected labels
    const selectedDeptLabel = form.department_id === '__global__'
        ? '🌐 Global (All Departments)'
        : departments.find(d => String(d.id) === String(form.department_id))?.name || '';
    const selectedUserLabel = (() => {
        const u = users.find(u => String(u.id) === String(form.user_id));
        return u ? `${u.firstName || u.first_name} ${u.lastName || u.last_name}${u.department?.name ? ' (' + u.department.name + ')' : ''}` : '';
    })();

    // Filtered options
    const filteredDepts = [
        { id: '__global__', name: '🌐 Global (All Departments)' },
        ...departments
    ].filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()));

    const filteredUsers = users.filter(u => {
        const name = `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.toLowerCase();
        const dept = (u.department?.name || '').toLowerCase();
        const q = userSearch.toLowerCase();
        return name.includes(q) || dept.includes(q);
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await approvalMatrixAPI.getAll();
            setRules(res.data?.rules || []);
        } catch (e) {
            toast.show('Failed to load approval matrix', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filteredRules = rules.filter(r => {
        // 1. Form Type
        if (r.form_type !== formType) return false;

        // 2. Department filter
        if (matrixDeptFilter) {
            if (matrixDeptFilter === '__global__' && r.department_id !== null) return false;
            if (matrixDeptFilter !== '__global__' && String(r.department_id) !== matrixDeptFilter) return false;
        }

        // 3. Search filter
        if (matrixSearch) {
            const q = matrixSearch.toLowerCase();
            const deptName = r.Department?.name?.toLowerCase() || (r.department_id == null ? 'global all departments' : '');
            const role = (r.role || '').toLowerCase();
            const uName = `${r.User?.first_name || ''} ${r.User?.last_name || ''}`.toLowerCase();
            const email = (r.User?.email || '').toLowerCase();

            if (!deptName.includes(q) && !role.includes(q) && !uName.includes(q) && !email.includes(q)) {
                return false;
            }
        }

        return true;
    });

    const handleAdd = async () => {
        if (!form.department_id || !form.role?.trim() || !form.user_id) {
            toast.show('Please fill in Department, Role, and User', 'error');
            return;
        }
        setSaving(true);
        try {
            const isGlobal = form.department_id === '__global__';
            const res = await approvalMatrixAPI.create({
                form_type: formType,
                department_id: isGlobal ? null : Number(form.department_id),
                role: form.role.trim(),
                user_id: Number(form.user_id),
                is_active: true
            });
            setRules(prev => [...prev, res.data.rule]);
            setForm({ department_id: '', role: '', user_id: '' });
            toast.show('Matrix rule added');
        } catch (e) {
            toast.show(e.response?.data?.message || 'Error adding rule', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this matrix rule?')) return;
        try {
            await approvalMatrixAPI.delete(id);
            setRules(prev => prev.filter(r => r.id !== id));
            toast.show('Rule deleted');
        } catch (e) {
            toast.show('Error deleting rule', 'error');
        }
    };

    const handleToggle = async (rule) => {
        try {
            const res = await approvalMatrixAPI.update(rule.id, { is_active: !rule.is_active });
            setRules(prev => prev.map(r => r.id === rule.id ? res.data.rule : r));
            toast.show(rule.is_active ? 'Rule deactivated' : 'Rule activated');
        } catch (e) {
            toast.show('Error updating rule', 'error');
        }
    };

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-500">
                Map a specific user as the approver for a <strong>Department + Role + Form Type</strong> combination.
                This overrides the default role-based lookup — useful for cross-department approvers.
            </p>

            {/* Form type filter */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Form Type:</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {FORM_TYPES.map(ft => (
                        <button
                            key={ft.value}
                            onClick={() => setFormType(ft.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${formType === ft.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            {ft.label}
                        </button>
                    ))}
                </div>
                {loading && <Loader className="w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {/* Add new rule form */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add New Rule</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Department — searchable combobox */}
                    <div className="relative">
                        <div
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer bg-white ${deptOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
                            onClick={() => { setDeptOpen(o => !o); setDeptSearch(''); }}
                        >
                            <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className={selectedDeptLabel ? 'text-gray-800' : 'text-gray-400'}>
                                {selectedDeptLabel || 'Select department...'}
                            </span>
                        </div>
                        {deptOpen && (
                            <div className="absolute z-20 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg">
                                <div className="p-2 border-b border-gray-100">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Search department..."
                                        value={deptSearch}
                                        onChange={e => setDeptSearch(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {filteredDepts.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
                                    )}
                                    {filteredDepts.map(d => (
                                        <div
                                            key={d.id}
                                            onClick={() => {
                                                setForm(f => ({ ...f, department_id: String(d.id) }));
                                                setDeptOpen(false);
                                                setDeptSearch('');
                                            }}
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${String(form.department_id) === String(d.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                                }`}
                                        >
                                            {d.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Role (free-type + datalist from roles list) */}
                    <div className="relative">
                        <input
                            type="text"
                            list="matrixRoleList"
                            placeholder="Role (e.g. Supervisor)"
                            value={form.role}
                            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <datalist id="matrixRoleList">
                            {roles.map(r => <option key={r} value={r} />)}
                        </datalist>
                    </div>

                    {/* User — searchable combobox */}
                    <div className="relative">
                        <div
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer bg-white ${userOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
                            onClick={() => { setUserOpen(o => !o); setUserSearch(''); }}
                        >
                            <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className={selectedUserLabel ? 'text-gray-800' : 'text-gray-400'}>
                                {selectedUserLabel || 'Select approver user...'}
                            </span>
                        </div>
                        {userOpen && (
                            <div className="absolute z-20 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg">
                                <div className="p-2 border-b border-gray-100">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Search name or department..."
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {filteredUsers.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
                                    )}
                                    {filteredUsers.map(u => {
                                        const label = `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`;
                                        const deptName = u.department?.name || '';
                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => {
                                                    setForm(f => ({ ...f, user_id: String(u.id) }));
                                                    setUserOpen(false);
                                                    setUserSearch('');
                                                }}
                                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${String(form.user_id) === String(u.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                                    }`}
                                            >
                                                <span className="font-medium">{label}</span>
                                                {deptName && <span className="ml-1.5 text-xs text-gray-400">({deptName})</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add Rule
                    </button>
                </div>
            </div>

            {/* Matrix Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    placeholder="Search by approver name, role, or department..."
                    value={matrixSearch}
                    onChange={e => setMatrixSearch(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                    value={matrixDeptFilter}
                    onChange={e => setMatrixDeptFilter(e.target.value)}
                    className="sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">All Departments</option>
                    <option value="__global__">🌐 Global (All Departments)</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {/* Rules table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Approver</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                            <th className="px-4 py-2.5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRules.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center text-gray-400 py-8 text-sm">
                                    {loading ? 'Loading...' : 'No matrix rules configured for this form type yet.'}
                                </td>
                            </tr>
                        )}
                        {filteredRules.map(rule => (
                            <tr key={rule.id} className={`${!rule.is_active ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="font-medium text-gray-800">
                                            {rule.Department?.name || (rule.department_id == null ? '🌐 Global (All Departments)' : `Dept #${rule.department_id}`)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                        <Tag className="w-3 h-3" />{rule.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-800">
                                        {rule.User ? `${rule.User.first_name} ${rule.User.last_name}` : `User #${rule.user_id}`}
                                    </div>
                                    <div className="text-xs text-gray-400">{rule.User?.email}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => handleToggle(rule)}
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.is_active
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                    >
                                        {rule.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleDelete(rule.id)} className="text-gray-300 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkflowSetup() {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('departments');
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState(['Supervisor', 'Head Manager', 'Manager', 'Director', 'VP']);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin()) { navigate('/dashboard'); return; }
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [deptsRes, usersRes, rolesRes] = await Promise.all([
                departmentsAPI.getAll(),
                usersAPI.getAll({ limit: 500 }),
                settingsAPI.get('workflow_custom_roles').catch(() => ({ data: { value: null } }))
            ]);
            setDepartments(deptsRes.data?.departments || deptsRes.data || []);
            const loadedUsers = usersRes.data?.users || usersRes.data || [];
            setUsers(loadedUsers);

            // Build role list: start with saved settings, then merge in any user customRoles
            const savedRoles = Array.isArray(rolesRes.data?.value) ? rolesRes.data.value : ['Supervisor', 'Head Manager', 'Manager', 'Director', 'VP'];
            const allRoles = new Set(savedRoles);
            loadedUsers.forEach(u => (u.customRoles || []).forEach(r => allRoles.add(r)));
            setRoles(Array.from(allRoles));
        } catch (e) {
            toast.show('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <Toast toast={toast.toast} />

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <GitBranch className="w-6 h-6 text-blue-500" />
                    Workflow Setup
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    Configure departments, roles, user assignments, approval sequences, and approval matrix — all in one place.
                </p>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                {TABS.map((tab, idx) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                                {idx + 1}
                            </span>
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'departments' && (
                    <DepartmentsTab departments={departments} setDepartments={setDepartments} toast={toast} />
                )}
                {activeTab === 'roles' && (
                    <RolesTab roles={roles} setRoles={setRoles} toast={toast} />
                )}
                {activeTab === 'users' && (
                    <UsersTab users={users} setUsers={setUsers} roles={roles} departments={departments} toast={toast} />
                )}
                {activeTab === 'sequences' && (
                    <SequencesTab departments={departments} roles={roles} toast={toast} />
                )}
                {activeTab === 'matrix' && (
                    <ApprovalMatrixTab departments={departments} users={users} roles={roles} toast={toast} />
                )}
            </div>
        </div>
    );
}
