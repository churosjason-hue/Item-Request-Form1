import React from 'react';
import {
    FileText, Car, Bell, Eye, Trash2, Calendar, UserCheck, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStatusColor } from '../../config/modules';

// --- Cell Components ---

const RequestInfoCell = ({ request, user, isPendingApproval }) => (
    <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
            {isPendingApproval && (
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
);

const ReferenceCodeCell = ({ request, user, isPendingApproval }) => {
    const isAssignedVerifier = request.verifier_id === user.id && request.verification_status === 'pending';
    // Check for Sunday in range (simple check)
    const isSundayInRange = (start, end) => {
        if (!start || !end) return false;
        const d1 = new Date(start);
        const d2 = new Date(end);
        for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0) return true;
        }
        return false;
    };
    const hasSunday = isSundayInRange(request.travel_date_from, request.travel_date_to);
    const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC');

    return (
        <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                {isPendingApproval && (
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
        </div>
    );
}

const RequestorCell = ({ request }) => {
    // Normalize fields between Item and Vehicle requests if possible, or handle both
    const requestorName = request.requestor?.fullName || request.RequestedByUser?.fullName || request.requestor_name || 'Unknown';
    const deptName = request.department?.name || request.Department?.name || 'No Dept';

    return (
        <>
            <div className="text-sm text-gray-900 dark:text-white">{requestorName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{deptName}</div>
        </>
    );
};

const StatusCell = ({ request, type, user }) => {
    const isPendingVerification = type === 'vehicle' && request.status === 'submitted' && request.verification_status === 'pending';
    const isRequestorCompleted = user?.role === 'requestor' && request.status === 'completed';

    // If pending verification, override the status color and text for the main badge
    let displayStatus = isPendingVerification ? 'PENDING VERIFICATION' : (request.status ? request.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN');
    if (isRequestorCompleted) {
        displayStatus = 'APPROVED';
    }
    const color = isPendingVerification ? 'purple' : getStatusColor(request.status, type);

    const colorClasses = {
        gray: 'bg-gray-100 text-gray-800',
        blue: 'bg-primary-100 text-primary-800',
        green: 'bg-green-100 text-green-800',
        red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        orange: 'bg-orange-100 text-orange-800',
        purple: 'bg-purple-100 text-purple-800'
    };

    return (
        <div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color] || 'bg-gray-100'}`}>
                {displayStatus}
            </span>
            {/* Verification Status Badges for Vehicle */}
            {type === 'vehicle' && request.verification_status === 'verified' && (
                <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <UserCheck className="w-3 h-3 mr-1" />Verified
                    </span>
                </div>
            )}
            {type === 'vehicle' && request.verification_status === 'declined' && (
                <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />Verif. Declined
                    </span>
                </div>
            )}
        </div>
    );
};

const AgingCell = ({ request }) => {
    const isDraft = request.status === 'draft';
    if (isDraft) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>;

    const dateToUse = request.submittedAt || request.submitted_at || request.requested_date || request.createdAt || request.created_at;
    if (!dateToUse) return <span className="text-sm text-gray-900 dark:text-white">-</span>;
    const created = new Date(dateToUse);
    if (isNaN(created.getTime())) return <span className="text-sm text-gray-900 dark:text-white">-</span>;

    let end = new Date();
    const terminalStatuses = [
        'completed', 'declined', 'returned', 'cancelled',
        'it_manager_declined', 'department_declined', 'endorser_declined',
    ];
    if (terminalStatuses.includes(request.status)) {
        // Find end timestamp if request is closed effectively
        const completed = new Date(request.completedAt || request.completed_at || request.updatedAt || request.updated_at);
        if (!isNaN(completed.getTime())) {
            end = completed;
        }
    }

    const diffTime = Math.abs(end - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

    let displayStr = '';
    if (diffDays > 0) displayStr += `${diffDays}d `;
    if (diffHours > 0 || diffDays > 0) displayStr += `${diffHours}h `;
    displayStr += `${diffMinutes}m`;

    let colorClass = "text-gray-900 dark:text-gray-100"; // default
    if (terminalStatuses.includes(request.status)) {
        colorClass = "text-gray-500 dark:text-gray-400"; // neutral for closed items
    } else if (diffDays >= 7) {
        colorClass = "text-red-600 dark:text-red-400 font-bold";
    } else if (diffDays >= 3) {
        colorClass = "text-orange-600 dark:text-orange-400 font-semibold";
    } else {
        colorClass = "text-green-600 dark:text-green-400 font-medium";
    }

    return <span className={`text-sm ${colorClass}`}>{displayStr}</span>;
};

const DateCell = ({ request, field }) => {
    const val = request[field];
    return <span className="text-sm text-gray-900 dark:text-white">{val ? new Date(val).toLocaleString() : '-'}</span>;
};

const ItemsCountCell = ({ request }) => (
    <span className="text-sm text-gray-900 dark:text-white">
        {request.itemsCount} item{request.itemsCount !== 1 ? 's' : ''}
    </span>
);


const RequestTypeCell = ({ request }) => {
    const type = request.request_type || request.type;
    return (
        <span className="text-sm text-gray-900 dark:text-white">
            {type ? type.replace(/_/g, ' ').toUpperCase() : '-'}
        </span>
    );
};

const SubmittedDateCell = ({ request }) => {
    // Try multiple fields
    const val = request.submittedAt || request.submitted_at || request.requested_date || request.createdAt || request.created_at;
    const isDraft = request.status === 'draft';

    return (
        <span className="text-sm text-gray-500 dark:text-gray-400">
            {isDraft ? 'Not submitted yet' : (val ? new Date(val).toLocaleString() : '-')}
        </span>
    );
};

const ActionsCell = ({ request, user, config, onDelete, navigate }) => {
    // Determine if editable: draft or returned AND current user is requestor
    const requestorId = request.requestor?.id || request.requested_by;
    const isRequestor = user.id === requestorId;
    // (NOT department_approved or any approval stage)
    const editableStatuses = ['draft', 'returned'];
    const canEdit = editableStatuses.includes(request.status) && isRequestor;

    // Determine if deletable: (isRequestor AND (draft or declined)) OR Admin OR (ODHC & Vehicle)
    // We can use a simpler rule or pass a prop. For now logic similar to original dashboard:
    const isSuperAdmin = user.role === 'super_administrator';
    const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC');
    // For Vehicle: ODHC can delete. For Item: ?? 
    // Let's stick closer to the generic rule:
    const canDelete =
        (isRequestor && ['draft', 'declined'].includes(request.status)) ||
        isSuperAdmin ||
        (config.id === 'item' && isODHC) || // Legacy rule?
        (config.id === 'vehicle' && isODHC);

    return (
        <div className="flex items-center text-sm font-medium">
            <button
                onClick={() => {
                    if (canEdit) {
                        navigate(config.routes.edit(request.id || request.request_id));
                    } else {
                        navigate(config.routes.view(request.id || request.request_id));
                    }
                }}
                className="text-primary-600 hover:text-primary-900 flex items-center mr-3"
            >
                <Eye className="h-4 w-4 mr-1" />
                {canEdit ? 'Edit' : 'View'}
            </button>

            {canDelete && (
                <button
                    onClick={() => onDelete(request.id || request.request_id, config.id)}
                    className="text-red-600 hover:text-red-900 flex items-center"
                    title="Delete Request"
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                </button>
            )}
        </div>
    );
};

// --- Main ModuleTable Component ---

const ModuleTable = ({
    config,
    data,
    user,
    isLoading,
    onDelete,
    pagination,
    filters,
    setFilters,
    selectedIds,
    onToggleSelection,
    onToggleAll
}) => {
    const navigate = useNavigate();

    // Helper to check if pending approval
    const isPendingMyApproval = (request) => {
        // Basic logic - needs to be robust for both types
        // For Item:
        if (config.id === 'item' && request.approvals) {
            return request.approvals.some(a => a.status === 'pending' && a.approver && a.approver.id === user.id);
        }
        // For Vehicle:
        if (config.id === 'vehicle') {
            if (['completed', 'declined', 'draft'].includes(request.status)) return false;
            // Dept approver logic
            if ((user.role === 'department_approver' || user.role === 'super_administrator') &&
                (request.status === 'submitted' || request.status === 'returned')) {
                return true;
            }
            // Verifier logic handled by server flag usually, or manual check?
            // For now simple check:
            return false; // Vehicle specific checking is complex, relied on bell icon logic in cells
        }
        return false;
    };

    const getCellComponent = (componentName) => {
        switch (componentName) {
            case 'RequestInfoCell': return RequestInfoCell;
            case 'ReferenceCodeCell': return ReferenceCodeCell;
            case 'RequestorCell': return RequestorCell;
            case 'StatusCell': return StatusCell;
            case 'AgingCell': return AgingCell;
            case 'DateCell': return DateCell;
            case 'ItemsCountCell': return ItemsCountCell;
            case 'RequestTypeCell': return RequestTypeCell;
            case 'SubmittedDateCell': return SubmittedDateCell;
            case 'ActionsCell': return ActionsCell;
            default: return null;
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    // Filter columns based on showCondition
    const visibleColumns = config.columns.filter(col => !col.showCondition || col.showCondition(user));

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-colors duration-200">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Recent {config.label}
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            {/* Render Checkbox Column if needed (custom logic for now) */}
                            {config.id === 'vehicle' && user?.department?.name?.toUpperCase()?.includes('ODHC') && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                            onChange={(e) => onToggleAll(e.target.checked)}
                                            checked={data.length > 0 && selectedIds.size === data.length}
                                        />
                                    </div>
                                </th>
                            )}

                            {visibleColumns.map((col) => (
                                <th key={col.id} className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center text-gray-500">
                                    <config.icon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                                    <p>No {config.label.toLowerCase()} found</p>
                                    {user.role === 'requestor' && (
                                        <button
                                            onClick={() => navigate(config.routes.create)}
                                            className="mt-2 text-primary-600 hover:text-primary-800"
                                        >
                                            Create your first request
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            data.map((request) => {
                                const requestId = request.id || request.request_id;
                                const isVerifier = request.verifier_id === user.id && request.verification_status === 'pending';
                                const rowClass = `hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 ${isVerifier ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`;

                                return (
                                    <tr key={requestId} className={rowClass}>
                                        {/* Checkbox Cell */}
                                        {config.id === 'vehicle' && user?.department?.name?.toUpperCase()?.includes('ODHC') && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                    checked={selectedIds.has(requestId)}
                                                    onChange={() => onToggleSelection(requestId)}
                                                />
                                            </td>
                                        )}

                                        {visibleColumns.map((col) => {
                                            const CellComponent = getCellComponent(col.component);
                                            if (!CellComponent) return <td key={col.id} className="px-6 py-4">?</td>;

                                            return (
                                                <td key={col.id} className="px-2 py-2">
                                                    <CellComponent
                                                        request={request}
                                                        user={user}
                                                        config={config} // Pass config to cells if needed
                                                        navigate={navigate}
                                                        onDelete={onDelete}
                                                        type={config.id} // 'item' or 'vehicle'
                                                        field={col.field}
                                                        isPendingApproval={isPendingMyApproval(request)}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.pages > 1 && (
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
                                {/* Simplified Pagination for now */}
                                <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                                    Page {pagination.currentPage} of {pagination.pages}
                                </span>
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
    );
};

export default ModuleTable;
