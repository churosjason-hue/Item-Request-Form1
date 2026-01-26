import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Filter,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Info,
    Shield,
    ArrowLeft,
    Clock,
    User,
    Layout,
    Activity
} from 'lucide-react';
import { auditLogsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AuditLogs = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null); // For details modal
    const [filters, setFilters] = useState({
        page: 1,
        limit: 15,
        search: '',
        action: '',
        entityType: '',
        startDate: '',
        endDate: ''
    });

    const [pagination, setPagination] = useState({
        total: 0,
        pages: 0,
        page: 1
    });

    // Action options
    const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'DECLINE', 'RETURN', 'SUBMIT', 'CANCEL'];
    const ENTITY_TYPES = ['Request', 'User', 'Workflow', 'Department', 'ServiceVehicleRequest'];

    useEffect(() => {
        // Redirect if not super admin
        if (user && user.role !== 'super_administrator') {
            navigate('/dashboard');
            return;
        }
        fetchLogs();
    }, [filters.page, filters.action, filters.entityType, filters.startDate, filters.endDate]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (filters.search !== undefined) {
                fetchLogs();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [filters.search]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await auditLogsAPI.getAll(filters);
            setLogs(response.data.logs);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setFilters({
            page: 1,
            limit: 15,
            search: '',
            action: '',
            entityType: '',
            startDate: '',
            endDate: ''
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'CREATE': return 'bg-green-100 text-green-800';
            case 'UPDATE': return 'bg-blue-100 text-blue-800';
            case 'DELETE': return 'bg-red-100 text-red-800';
            case 'APPROVE': return 'bg-green-100 text-green-800';
            case 'DECLINE': return 'bg-red-100 text-red-800';
            case 'LOGIN': return 'bg-indigo-100 text-indigo-800';
            case 'LOGOUT': return 'bg-gray-100 text-gray-800';
            case 'SUBMIT': return 'bg-yellow-100 text-yellow-800';
            case 'RETURN': return 'bg-orange-100 text-orange-800';
            case 'CANCEL': return 'bg-gray-100 text-gray-800 border-gray-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Render change details in a nice format
    const renderDetails = (details) => {
        if (!details) return <p className="text-gray-500 italic">No details available</p>;

        // Handle "changes" specially (for UPDATE actions)
        if (details.changes) {
            return (
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 border-b pb-2">Changes</h4>
                    {Object.entries(details.changes).map(([field, change]) => (
                        <div key={field} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                            <div>
                                <span className="text-xs font-bold uppercase text-gray-500 block mb-1">Field</span>
                                <span className="font-mono text-sm text-gray-800">{field}</span>
                            </div>
                            <div className="md:col-span-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-xs text-red-500 block">From</span>
                                        <div className="text-sm bg-red-50 text-red-700 p-1 rounded font-mono break-all">
                                            {JSON.stringify(change.from)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-green-500 block">To</span>
                                        <div className="text-sm bg-green-50 text-green-700 p-1 rounded font-mono break-all">
                                            {JSON.stringify(change.to)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Default JSON renderer
        return (
            <div className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">
                    {JSON.stringify(details, null, 2)}
                </pre>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <Shield className="h-6 w-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        Watching System Activity
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="ID, User, IP..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Action Type */}
                        <div className="w-full md:w-36">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value, page: 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Actions</option>
                                {ACTION_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Entity Type */}
                        <div className="w-full md:w-40">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entity</label>
                            <select
                                value={filters.entityType}
                                onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value, page: 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Entities</option>
                                {ENTITY_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range - Start */}
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:text-white text-sm"
                            />
                        </div>

                        {/* Date Range - End */}
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:text-white text-sm"
                            />
                        </div>

                        <button
                            onClick={clearFilters}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md text-sm font-medium transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    // Simple loading skeleton
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            <Activity className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                                            <p>No audit logs found matching your criteria</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {formatDateTime(log.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                        <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {log.actor_name || 'System'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {log.ip_address || 'Internal'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">{log.entity_type}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                                    #{log.entity_id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                <span className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                                                    <Info className="h-4 w-4 mr-1" />
                                                    View Details
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between sm:px-6">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                Page <span className="font-medium">{pagination.page}</span> of <span className="font-medium">{pagination.pages}</span> ({pagination.total} logs)
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                    disabled={pagination.page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </button>
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                                    disabled={pagination.page === pagination.pages}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setSelectedLog(null)}>
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div
                            className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                                        <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                            Audit Log Details #{selectedLog.id}
                                        </h3>
                                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <span className="text-xs text-gray-500 uppercase">Timestamp</span>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(selectedLog.created_at)}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 uppercase">User</span>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedLog.actor_name} (@{selectedLog.Actor?.username})</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 uppercase">Action</span>
                                                    <div className="flex pt-1"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(selectedLog.action)}`}>{selectedLog.action}</span></div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500 uppercase">Target</span>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedLog.entity_type} #{selectedLog.entity_id}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-xs text-gray-500 uppercase">Network Context</span>
                                                    <div className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">
                                                        IP: {selectedLog.ip_address || 'Unknown'} <br />
                                                        UA: {selectedLog.user_agent || 'Unknown'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                {renderDetails(selectedLog.details)}
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setSelectedLog(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
