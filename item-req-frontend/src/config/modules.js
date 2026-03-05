import { FileText, Car, RotateCcw, Clock, CheckCircle, XCircle, AlertCircle, File, UserCheck, Calendar } from 'lucide-react';
import { requestsAPI, serviceVehicleRequestsAPI } from '../services/api';

// Status color mapping helper
export const getStatusColor = (status, type = 'item') => {
    if (type === 'vehicle') {
        const map = {
            'draft': 'gray',
            'submitted': 'blue',
            'department_approved': 'green',
            'returned': 'orange',
            'declined': 'red',
            'completed': 'green'
        };
        return map[status] || 'gray';
    }

    // Item request status colors
    const map = {
        'draft': 'gray',
        'submitted': 'blue',
        'department_approved': 'green',
        'department_declined': 'red',
        'checked_endorsed': 'green',
        'endorser_declined': 'red',
        'it_manager_approved': 'green',
        'it_manager_declined': 'red',
        'service_desk_processing': 'yellow',
        'ready_to_deploy': 'blue',
        'pr_approved': 'green',
        'completed': 'green',
        'cancelled': 'gray',
        'returned': 'orange'
    };
    return map[status] || 'gray';
};

export const MODULES = {
    ITEM: {
        id: 'item',
        label: 'Item Requests',
        icon: FileText,
        api: requestsAPI,
        routes: {
            view: (id) => `/requests/${id}`,
            edit: (id) => `/requests/${id}/edit`,
            create: '/requests/new',
            delete: 'item' // identifier for delete handler
        },
        // Configuration for the Stats Grid
        getStats: (user, stats) => {
            const cards = [];

            // Any role that isn't an approver/admin role sees requestor-style cards
            // This allows department_approvers, IT managers, etc. who also create requests to see their own
            const approverRoles = ['department_approver', 'endorser', 'it_manager', 'service_desk', 'super_administrator'];
            if (!approverRoles.includes(user.role)) {
                cards.push(
                    { title: 'My Drafts', count: stats.draft || 0, icon: FileText, color: 'gray', filterStatus: 'draft' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange', filterStatus: 'returned' },
                    { title: 'Pending Approval', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow', filterStatus: 'all' },
                    { title: 'Approved', count: (stats.it_manager_approved || 0) + (stats.service_desk_processing || 0), icon: CheckCircle, color: 'green', filterStatus: 'all' },
                    { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0), icon: XCircle, color: 'red', filterStatus: 'all' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue', filterStatus: 'completed' }
                );
            } else if (user.role === 'department_approver') {
                cards.push(
                    { title: 'Pending My Approval', count: stats.pendingMyApproval !== undefined ? stats.pendingMyApproval : (stats.submitted || 0), icon: AlertCircle, color: 'orange', filterStatus: 'submitted' },
                    { title: 'Approved by Me', count: stats.department_approved || 0, icon: CheckCircle, color: 'green', filterStatus: 'department_approved' },
                    { title: 'Declined by Me', count: stats.department_declined || 0, icon: XCircle, color: 'red', filterStatus: 'department_declined' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange', filterStatus: 'returned' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue', filterStatus: 'completed' },
                    { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'gray', filterStatus: 'all' }
                );
            } else if (user.role === 'it_manager') {
                cards.push(
                    // ── Pending action on IT Manager ──
                    { title: 'Pending My Approval', count: stats.pendingMyApproval !== undefined ? stats.pendingMyApproval : (stats.checked_endorsed || 0), icon: AlertCircle, color: 'orange', filterStatus: 'checked_endorsed' },
                    { title: 'Pending Verification', count: stats.verificationStats?.pending || 0, icon: AlertCircle, color: 'purple', filterStatus: 'verification_pending' },
                    { title: 'Verified', count: stats.verificationStats?.verified || 0, icon: CheckCircle, color: 'green', filterStatus: 'verification_verified' },
                    { title: 'Verif. Declined', count: stats.verificationStats?.declined || 0, icon: XCircle, color: 'red', filterStatus: 'verification_declined' },
                    { title: 'Approved by Me', count: stats.it_manager_approved || 0, icon: CheckCircle, color: 'green', filterStatus: 'it_manager_approved' },
                    { title: 'Declined by Me', count: stats.it_manager_declined || 0, icon: XCircle, color: 'red', filterStatus: 'it_manager_declined' },
                    // ── Pre-IT Manager stages ──
                    { title: 'Submitted', count: stats.submitted || 0, icon: File, color: 'blue', filterStatus: 'submitted' },
                    { title: 'Dept. Approved', count: stats.department_approved || 0, icon: UserCheck, color: 'blue', filterStatus: 'department_approved' },
                    { title: 'Dept. Declined', count: stats.department_declined || 0, icon: XCircle, color: 'red', filterStatus: 'department_declined' },
                    { title: 'Checked & Endorsed', count: stats.checked_endorsed || 0, icon: CheckCircle, color: 'green', filterStatus: 'checked_endorsed' },
                    { title: 'Endorser Declined', count: stats.endorser_declined || 0, icon: XCircle, color: 'red', filterStatus: 'endorser_declined' },
                    // ── Post-IT Manager stages (Service Desk) ──
                    { title: 'Service Desk Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow', filterStatus: 'service_desk_processing' },
                    { title: 'PR Approved', count: stats.pr_approved || 0, icon: CheckCircle, color: 'blue', filterStatus: 'pr_approved' },
                    { title: 'Ready to Deploy', count: stats.ready_to_deploy || 0, icon: Calendar, color: 'purple', filterStatus: 'ready_to_deploy' },
                    // ── Terminal states ──
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange', filterStatus: 'returned' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green', filterStatus: 'completed' },
                    { title: 'Cancelled', count: stats.cancelled || 0, icon: XCircle, color: 'gray', filterStatus: 'cancelled' },
                    // ── Total ──
                    { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'gray', filterStatus: 'all' }
                );
            } else if (user.role === 'service_desk') {
                cards.push(
                    { title: 'To Process', count: stats.it_manager_approved || 0, icon: AlertCircle, color: 'orange', filterStatus: 'it_manager_approved' },
                    { title: 'Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow', filterStatus: 'service_desk_processing' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green', filterStatus: 'completed' },
                    { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'blue', filterStatus: 'all' }
                );
            } else if (user.role === 'endorser') {
                cards.push(
                    { title: 'All Requests', count: stats.total || 0, icon: FileText, color: 'blue', filterStatus: 'all' },
                    { title: 'Pending My Endorsement', count: stats.department_approved || 0, icon: AlertCircle, color: 'yellow', filterStatus: 'department_approved' },
                    { title: 'Endorsed', count: stats.checked_endorsed || 0, icon: CheckCircle, color: 'green', filterStatus: 'checked_endorsed' },
                    { title: 'Declined', count: stats.endorser_declined || 0, icon: XCircle, color: 'red', filterStatus: 'endorser_declined' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue', filterStatus: 'completed' }
                );
            } else {
                cards.push(
                    { title: 'All Requests', count: stats.total || 0, icon: FileText, color: 'blue', filterStatus: 'all' },
                    { title: 'Pending', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow', filterStatus: 'all' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green', filterStatus: 'completed' },
                    { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0) + (stats.declined || 0), icon: XCircle, color: 'red', filterStatus: 'all' }
                );
            }
            return cards;
        },
        // Configuration for the Table Columns
        columns: [
            { id: 'request_info', label: 'Request', component: 'RequestInfoCell' },
            { id: 'requestor', label: 'Requestor', component: 'RequestorCell' },
            { id: 'status', label: 'Status', component: 'StatusCell' },
            { id: 'aging', label: 'Aging', component: 'AgingCell' },
            {
                id: 'sd_aging',
                label: 'SD Aging',
                component: 'ServiceDeskAgingCell',
                showCondition: (user) => ['it_manager', 'service_desk', 'super_administrator'].includes(user.role)
            },
            { id: 'completion_date', label: 'Completion Date', component: 'DateCell', field: 'completedAt' },
            { id: 'items_count', label: 'Items', component: 'ItemsCountCell' },
            { id: 'date', label: 'Date', component: 'SubmittedDateCell' },
            { id: 'actions', label: 'Actions', component: 'ActionsCell' }
        ]
    },
    VEHICLE: {
        id: 'vehicle',
        label: 'Vehicle Requests',
        icon: Car,
        api: serviceVehicleRequestsAPI,
        routes: {
            view: (id) => `/service-vehicle-requests/${id}`,
            edit: (id) => `/service-vehicle-requests/${id}/edit`,
            create: '/service-vehicle-requests/new',
            delete: 'vehicle'
        },
        getStats: (user, stats) => {
            const cards = [];
            const verificationStats = stats.verificationStats || {};
            const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC') || user?.role === 'super_administrator';

            const approverRolesV = ['department_approver', 'endorser', 'it_manager', 'service_desk', 'super_administrator'];
            if (!approverRolesV.includes(user.role)) {
                cards.push(
                    { title: 'My Drafts', count: stats.draft || 0, icon: FileText, color: 'gray' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
                    { title: 'Pending Approval', count: stats.submitted || 0, icon: Clock, color: 'yellow' },
                    { title: 'Department Approved', count: stats.department_approved || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Declined', count: stats.declined || 0, icon: XCircle, color: 'red' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' },
                    { title: 'Total Requests', count: stats.total || 0, icon: Car, color: 'gray' }
                );
            } else if (user.role === 'department_approver') {
                const deptCards = [
                    { title: 'Pending My Approval', count: isODHC ? ((stats.submitted || 0) + (stats.department_approved || 0)) : (stats.submitted || 0), icon: AlertCircle, color: 'orange' },
                    { title: isODHC ? 'Department Approved' : 'Approved by Me', count: stats.department_approved || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
                    { title: 'Declined', count: stats.declined || 0, icon: XCircle, color: 'red' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' },
                    { title: 'Total Requests', count: stats.total || 0, icon: Car, color: 'gray' }
                ];

                if (isODHC) {
                    deptCards.unshift(
                        { title: 'Pending Verification', count: verificationStats.pending || 0, icon: UserCheck, color: 'purple' },
                        { title: 'Verif. Declined', count: verificationStats.declined || 0, icon: XCircle, color: 'red' }
                    );
                }
                cards.push(...deptCards);
            } else {
                cards.push(
                    { title: 'Total Vehicle Requests', count: stats.total || 0, icon: Car, color: 'blue' }
                );
            }
            return cards;
        },
        columns: [
            { id: 'reference_code', label: 'Reference Code', component: 'ReferenceCodeCell' },
            { id: 'requestor', label: 'Requestor', component: 'RequestorCell' },
            { id: 'status', label: 'Status', component: 'StatusCell', type: 'vehicle' },
            { id: 'aging', label: 'Aging', component: 'AgingCell' },
            { id: 'request_type', label: 'Request Type', component: 'RequestTypeCell' },
            { id: 'date', label: 'Date', component: 'SubmittedDateCell' },
            { id: 'actions', label: 'Actions', component: 'ActionsCell' }
        ]
    }
};
