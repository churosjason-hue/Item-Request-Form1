import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, ArrowLeft, RefreshCw, CheckCircle, RotateCcw, Trash2 } from 'lucide-react';
import { requestsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ToastContext } from '../../contexts/ToastContext';
import ConfirmDialog from '../common/ConfirmDialog';

export default function DeployedAssets() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { success, error } = useContext(ToastContext);

    const [loading, setLoading] = useState(true);
    const [deployedItems, setDeployedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [confirmDialogState, setConfirmDialogState] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "warning",
        confirmText: "Confirm"
    });

    useEffect(() => {
        // Only Service Desk and Admin should access this
        if (user && !['service_desk', 'super_administrator', 'it_manager'].includes(user.role)) {
            navigate('/dashboard');
            return;
        }
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Fetch all completed requests
            const response = await requestsAPI.getAll({ status: 'completed', limit: 100 });

            // Flatten requests into items list
            const itemsList = [];

            // Since getAll only returns high-level request data, we might need to fetch details for each if items aren't included
            // But typically getAll includes Items? Let's check logic.
            // Based on previous controller code, getAll DOES include RequestItem as 'Items'.
            // So we can iterate.

            if (response.data && response.data.requests) {
                // Need to fetch details to get Items if they aren't fully populated in list view,
                // OR rely on what's there. The dashboard list usually has summary data.
                // Let's assume we need to fetch individual request details OR rely on the existing Items array in the list response.
                // Looking at controller: getAllRequests includes Items.

                for (const req of response.data.requests) {
                    // We need to map the items.
                    // Note: getAllRequests response maps itemsCount, but maybe not the full items array in the mapped object?
                    // Let's check controller getAllRequests logic... 
                    // It maps: itemsCount: request.Items?.length || 0. 
                    // It DOES NOT return the actual items array in the mapped object.
                    // So we actually need to fetch the detailed request for each completed request to get the items.
                    // This could be slow if there are many. 
                    // Ideally we'd have a specific endpoint /api/assets/deployed but for now let's fetch details.

                    // Optimization: We can just use the raw `requests` array from the `findAndCountAll` if we were in backend.
                    // But we are in frontend.
                    // Let's try to fetch details for the top 20 completed requests or similar?
                    // Or better, let's just make a quick loop.
                    try {
                        const detailRes = await requestsAPI.getById(req.id);
                        const fullReq = detailRes.data.request;

                        if (fullReq && fullReq.items) {
                            fullReq.items.forEach(item => {
                                itemsList.push({
                                    ...item,
                                    requestId: fullReq.id,
                                    requestNumber: fullReq.requestNumber,
                                    requestorName: fullReq.requestor.fullName,
                                    userName: fullReq.userName,
                                    userPosition: fullReq.userPosition,
                                    departmentName: fullReq.department.name,
                                    deployedDate: fullReq.completedAt,
                                    isReturned: item.isReturned,
                                    returnedAt: item.returnedAt
                                });
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to fetch details for request ${req.id}`, err);
                    }
                }
            }

            setDeployedItems(itemsList);
        } catch (err) {
            console.error('Error loading deployed assets:', err);
            error('Failed to load deployed assets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRestock = async (requestId, itemId) => {
        setConfirmDialogState({
            isOpen: true,
            title: "Return to Inventory",
            message: "Are you sure you want to return this item to inventory? This will increase the stock quantity.",
            variant: "warning",
            confirmText: "Return Item",
            onConfirm: async () => {
                setConfirmDialogState(prev => ({ ...prev, isOpen: false }));
                try {
                    setRefreshing(true);
                    await requestsAPI.restockItem(requestId, itemId);
                    success('Item returned to inventory successfully');
                    await loadData();
                } catch (err) {
                    console.error('Error restocking item:', err);
                    error(err.response?.data?.message || 'Failed to restock item');
                    setRefreshing(false);
                }
            }
        });
    };

    const handleDelete = async (requestId, itemId) => {
        setConfirmDialogState({
            isOpen: true,
            title: "Delete Asset Record",
            message: "Are you sure you want to delete this deployed asset record? This action cannot be undone.",
            variant: "danger",
            confirmText: "Delete",
            onConfirm: async () => {
                setConfirmDialogState(prev => ({ ...prev, isOpen: false }));
                try {
                    setRefreshing(true);
                    await requestsAPI.deleteItem(requestId, itemId);
                    success('Asset record deleted successfully');
                    await loadData();
                } catch (err) {
                    console.error('Error deleting item:', err);
                    error(err.response?.data?.message || 'Failed to delete item');
                    setRefreshing(false);
                }
            }
        });
    };

    const filteredItems = deployedItems.filter(item =>
        item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requestNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemDescription?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-200 rounded-full">
                            <ArrowLeft className="h-6 w-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <Package className="h-8 w-8 mr-3 text-blue-600" />
                                Deployed Assets Tracking
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Track deployed items and manage inventory returns
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setRefreshing(true); loadData(); }}
                        disabled={refreshing || loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by User Name, Request #, Item, or Category..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
                            Loading assets...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No deployed assets found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Info</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deployed To (User)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Details</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deployed Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status / Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredItems.map((item, index) => (
                                        <tr key={`${item.requestId}-${index}`} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                                                        {item.category?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{item.category}</div>
                                                        <div className="text-sm text-gray-500">{item.itemDescription}</div>
                                                        <div className="text-xs text-gray-400 mt-1">Qty: {item.quantity} | {item.inventoryNumber || 'No Inv#'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                                                <div className="text-sm text-gray-500">{item.userPosition}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-blue-600 font-medium">{item.requestNumber}</div>
                                                <div className="text-sm text-gray-500">{item.departmentName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {item.deployedDate ? new Date(item.deployedDate).toLocaleDateString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end space-x-3">
                                                    {item.isReturned ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Returned
                                                            </span>
                                                            {item.returnedAt && (
                                                                <span className="text-xs text-gray-400 mt-1">
                                                                    {new Date(item.returnedAt).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRestock(item.requestId, item.id)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                        >
                                                            <RotateCcw className="h-3 w-3 mr-1" />
                                                            Return to Stock
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleDelete(item.requestId, item.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialogState.isOpen}
                onClose={() => setConfirmDialogState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialogState.onConfirm}
                title={confirmDialogState.title}
                message={confirmDialogState.message}
                variant={confirmDialogState.variant}
                confirmText={confirmDialogState.confirmText}
            />
        </div>
    );
}
