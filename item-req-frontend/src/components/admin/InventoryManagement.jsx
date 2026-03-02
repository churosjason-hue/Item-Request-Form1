import React, { useState, useEffect, useContext } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    AlertTriangle,
    CheckCircle,
    X,
    Settings
} from 'lucide-react';
import { categoriesAPI, settingsAPI } from '../../services/api';
import { ToastContext } from '../../contexts/ToastContext';
import ConfirmDialog from '../common/ConfirmDialog';

const InventoryManagement = () => {
    const { success: toastSuccess, error: toastError } = useContext(ToastContext);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

    // Purpose Management State
    const [generalPurposes, setGeneralPurposes] = useState([]);
    const [isPurposeModalOpen, setIsPurposeModalOpen] = useState(false);
    const [newPurpose, setNewPurpose] = useState('');

    // Modal Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        quantity: 0,
        min_stock_level: 5,
        track_stock: true,
        purposes: []
    });

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const [categoriesRes, purposesRes] = await Promise.all([
                categoriesAPI.getAll(),
                settingsAPI.getGeneralPurposes()
            ]);
            setCategories(categoriesRes.data);
            setGeneralPurposes(purposesRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            toastError('Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // Global Purpose Handlers
    const handleAddGeneralPurpose = async (e) => {
        e.preventDefault();
        if (!newPurpose.trim()) return;

        const updatedPurposes = [...generalPurposes, newPurpose.trim()];
        try {
            await settingsAPI.update('general_purposes', updatedPurposes);
            setGeneralPurposes(updatedPurposes);
            setNewPurpose('');
            toastSuccess('Global purpose added');
        } catch (error) {
            console.error('Error updating general purposes:', error);
            toastError('Failed to update general purposes');
        }
    };

    const handleRemoveGeneralPurpose = async (purposeToRemove) => {
        const updatedPurposes = generalPurposes.filter(p => p !== purposeToRemove);
        try {
            await settingsAPI.update('general_purposes', updatedPurposes);
            setGeneralPurposes(updatedPurposes);
            toastSuccess('Global purpose removed');
        } catch (error) {
            console.error('Error updating general purposes:', error);
            toastError('Failed to update general purposes');
        }
    };

    const handleOpenModal = (category = null) => {
        setNewPurpose(''); // Reset input
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                quantity: category.quantity || 0,
                min_stock_level: category.min_stock_level || 5,
                track_stock: category.track_stock !== undefined ? category.track_stock : true,
                purposes: category.purposes || []
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                description: '',
                quantity: 0,
                min_stock_level: 5,
                track_stock: true,
                purposes: []
            });
        }
        setIsModalOpen(true);
    };

    // Item Purpose Handlers
    const handleAddItemPurpose = (e) => {
        e.preventDefault();
        if (!newPurpose.trim()) return;

        if (!formData.purposes.includes(newPurpose.trim())) {
            setFormData(prev => ({
                ...prev,
                purposes: [...prev.purposes, newPurpose.trim()]
            }));
            setNewPurpose('');
        }
    };

    const handleRemoveItemPurpose = (purposeToRemove) => {
        setFormData(prev => ({
            ...prev,
            purposes: prev.purposes.filter(p => p !== purposeToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await categoriesAPI.update(editingCategory.id, formData);
                toastSuccess('Category updated successfully');
            } else {
                await categoriesAPI.create(formData);
                toastSuccess('Category created successfully');
            }
            setIsModalOpen(false);
            fetchCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            toastError(error.response?.data?.message || 'Failed to save category');
        }
    };

    const handleDelete = (category) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Category',
            message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
            onConfirm: async () => {
                try {
                    await categoriesAPI.delete(category.id);
                    toastSuccess('Category deleted successfully');
                    fetchCategories();
                } catch (error) {
                    console.error('Error deleting category:', error);
                    toastError('Failed to delete category');
                } finally {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const getStatusBadge = (category) => {
        if (!category.track_stock) {
            return (
                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    N/A
                </span>
            );
        }

        if (category.quantity === 0) {
            return (
                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    Out of Stock
                </span>
            );
        }

        if (category.quantity <= category.min_stock_level) {
            return (
                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Low Stock
                </span>
            );
        }

        return (
            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                Available
            </span>
        );
    };

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search equipment types..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setNewPurpose('');
                            setIsPurposeModalOpen(true);
                        }}
                        className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        <Settings className="h-5 w-5 mr-2" />
                        Global Purposes
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Add Equipment
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item/Category Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock Qty</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No equipment found</td>
                                </tr>
                            ) : (
                                filteredCategories.map((cat) => (
                                    <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {cat.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                {cat.description || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                            {cat.track_stock ? cat.quantity : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(cat)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleOpenModal(cat)}
                                                className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat)}
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Global Purposes Modal */}
            {isPurposeModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setIsPurposeModalOpen(false)}>
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                        Manage Global Purposes
                                    </h3>
                                    <button onClick={() => setIsPurposeModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newPurpose}
                                            onChange={(e) => setNewPurpose(e.target.value)}
                                            placeholder="Enter generic purpose..."
                                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                        />
                                        <button
                                            onClick={handleAddGeneralPurpose}
                                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                        {generalPurposes.map((purpose, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                                <span className="text-sm text-gray-700 dark:text-gray-200">{purpose}</span>
                                                <button
                                                    onClick={() => handleRemoveGeneralPurpose(purpose)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {generalPurposes.length === 0 && (
                                            <p className="text-sm text-gray-500 text-center py-2">No global purposes defined.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    onClick={() => setIsPurposeModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                        {editingCategory ? 'Edit Equipment' : 'Add New Equipment'}
                                    </h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <form id="categoryForm" onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                        <textarea
                                            rows="3"
                                            value={formData.description}
                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Item Specific Purposes</label>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={newPurpose}
                                                onChange={(e) => setNewPurpose(e.target.value)}
                                                placeholder="Add specific purpose..."
                                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            />
                                            <button
                                                onClick={handleAddItemPurpose}
                                                type="button"
                                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-600 rounded-md p-2">
                                            {formData.purposes && formData.purposes.map((purpose, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-1 bg-gray-50 dark:bg-gray-700 rounded">
                                                    <span className="text-sm text-gray-700 dark:text-gray-200">{purpose}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItemPurpose(purpose)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!formData.purposes || formData.purposes.length === 0) && (
                                                <p className="text-xs text-gray-500 text-center">No specific purposes added.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center mb-4">
                                        <input
                                            id="track_stock"
                                            type="checkbox"
                                            checked={formData.track_stock}
                                            onChange={(e) => setFormData(prev => ({ ...prev, track_stock: e.target.checked }))}
                                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="track_stock" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                            Track Stock Quantity
                                        </label>
                                    </div>

                                    {formData.track_stock && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    required
                                                    value={formData.quantity}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Low Stock Alert Level</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    required
                                                    value={formData.min_stock_level}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, min_stock_level: parseInt(e.target.value) || 0 }))}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="submit"
                                    form="categoryForm"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    {editingCategory ? 'Save Changes' : 'Create Equipment'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default InventoryManagement;
