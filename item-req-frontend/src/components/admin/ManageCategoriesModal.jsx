import React, { useState, useEffect, useContext } from 'react';
import {
    Plus,
    Trash2,
    X,
    Edit2,
    Check,
    RotateCcw
} from 'lucide-react';
import { categoriesAPI } from '../../services/api';
import { ToastContext } from '../../contexts/ToastContext';

const ManageCategoriesModal = ({ isOpen, onClose, onCategoriesChange }) => {
    const { success: toastSuccess, error: toastError } = useContext(ToastContext);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', description: '' });

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await categoriesAPI.getAll();
            setCategories(response.data);
            if (onCategoriesChange) onCategoriesChange(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
            toastError('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newCategory.name.trim()) return;

        try {
            await categoriesAPI.create(newCategory);
            toastSuccess('Category created successfully');
            setNewCategory({ name: '', description: '' });
            fetchCategories();
        } catch (error) {
            console.error('Error creating category:', error);
            toastError(error.response?.data?.message || 'Failed to create category');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await categoriesAPI.update(id, editForm);
            toastSuccess('Category updated successfully');
            setEditingId(null);
            fetchCategories();
        } catch (error) {
            console.error('Error updating category:', error);
            toastError('Failed to update category');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;

        try {
            await categoriesAPI.delete(id);
            toastSuccess('Category deleted successfully');
            fetchCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            toastError('Failed to delete category');
        }
    };

    const startEdit = (category) => {
        setEditingId(category.id);
        setEditForm({ name: category.name, description: category.description || '' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                Manage Categories
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Create New Form */}
                        <form onSubmit={handleCreate} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Category</h4>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Category Name"
                                    required
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white sm:text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Description (Optional)"
                                    value={newCategory.description}
                                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white sm:text-sm"
                                />
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </form>

                        {/* List */}
                        <div className="overflow-y-auto max-h-96">
                            {loading ? (
                                <div className="text-center py-4 text-gray-500">Loading categories...</div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {categories.map((cat) => (
                                            <tr key={cat.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {editingId === cat.id ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.name}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 sm:text-sm"
                                                        />
                                                    ) : (
                                                        cat.name
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {editingId === cat.id ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.description}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 sm:text-sm"
                                                        />
                                                    ) : (
                                                        cat.description || '-'
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {editingId === cat.id ? (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleUpdate(cat.id)} className="text-green-600 hover:text-green-900"><Check className="h-4 w-4" /></button>
                                                            <button onClick={() => setEditingId(null)} className="text-gray-600 hover:text-gray-900"><X className="h-4 w-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => startEdit(cat)} className="text-primary-600 hover:text-primary-900"><Edit2 className="h-4 w-4" /></button>
                                                            <button onClick={() => handleDelete(cat.id, cat.name)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageCategoriesModal;
