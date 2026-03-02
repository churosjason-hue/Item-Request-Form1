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

            if (user.role === 'requestor') {
                cards.push(
                    { title: 'My Drafts', count: stats.draft || 0, icon: FileText, color: 'gray' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
                    { title: 'Pending Approval', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow' },
                    { title: 'Approved', count: (stats.it_manager_approved || 0) + (stats.service_desk_processing || 0), icon: CheckCircle, color: 'green' },
                    { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0), icon: XCircle, color: 'red' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' }
                );
            } else if (user.role === 'department_approver') {
                cards.push(
                    { title: 'Pending My Approval', count: stats.pendingMyApproval !== undefined ? stats.pendingMyApproval : (stats.submitted || 0), icon: AlertCircle, color: 'orange' },
                    { title: 'Approved by Me', count: stats.department_approved || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Declined by Me', count: stats.department_declined || 0, icon: XCircle, color: 'red' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' },
                    { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'gray' }
                );
            } else if (user.role === 'it_manager') {
                cards.push(
                    { title: 'Pending My Approval', count: stats.pendingMyApproval !== undefined ? stats.pendingMyApproval : (stats.department_approved || 0), icon: AlertCircle, color: 'orange' },
                    { title: 'Approved by Me', count: stats.it_manager_approved || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Declined by Me', count: stats.it_manager_declined || 0, icon: XCircle, color: 'red' },
                    { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
                    { title: 'In Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' }
                );
            } else if (user.role === 'service_desk') {
                cards.push(
                    { title: 'To Process', count: stats.it_manager_approved || 0, icon: AlertCircle, color: 'orange' },
                    { title: 'Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'blue' }
                );
            } else {
                cards.push(
                    { title: 'All Requests', count: stats.total || 0, icon: FileText, color: 'blue' },
                    { title: 'Pending', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow' },
                    { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green' },
                    { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0) + (stats.declined || 0), icon: XCircle, color: 'red' }
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

            if (user.role === 'requestor') {
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
