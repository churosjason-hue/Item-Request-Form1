import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

const ReplenishmentModal = ({ isOpen, onClose, onConfirm, items }) => {
    const [replenishmentData, setReplenishmentData] = useState({});
    const [errors, setErrors] = useState({});

    // Initialize state when items change
    useEffect(() => {
        if (isOpen && items) {
            const initialData = {};
            items.forEach(item => {
                initialData[item.id] = {
                    prNumber: '',
                    addedQty: '' // Start empty
                };
            });
            setReplenishmentData(initialData);
            setErrors({});
        }
    }, [isOpen, items]);

    if (!isOpen) return null;

    const handleChange = (itemId, field, value) => {
        setReplenishmentData(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));

        // Clear error for this field
        if (errors[itemId]?.[field]) {
            setErrors(prev => ({
                ...prev,
                [itemId]: {
                    ...prev[itemId],
                    [field]: null
                }
            }));
        }
    };

    const validate = () => {
        const newErrors = {};
        let isValid = true;

        items.forEach(item => {
            const data = replenishmentData[item.id];
            const itemErrors = {};

            if (!data.prNumber) {
                itemErrors.prNumber = 'PR Number is required';
                isValid = false;
            } else if (!/^\d{8}$/.test(data.prNumber)) {
                itemErrors.prNumber = 'PR Number must be 8 digits';
                isValid = false;
            }

            if (!data.addedQty) {
                itemErrors.addedQty = 'Quantity is required';
                isValid = false;
            } else if (parseInt(data.addedQty) <= 0) {
                itemErrors.addedQty = 'Must be greater than 0';
                isValid = false;
            }

            if (Object.keys(itemErrors).length > 0) {
                newErrors[item.id] = itemErrors;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onConfirm(replenishmentData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Insufficient Stock
                                    </h3>
                                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="mt-2 mb-4">
                                    <p className="text-sm text-gray-500">
                                        The following items have insufficient stock. Please provide PR details to replenish stock before completing this request.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                        {items.map(item => (
                                            <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-medium text-gray-900">{item.category}</h4>
                                                    <div className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">
                                                        Requested: {item.requestedQty} | Stock: {item.currentStock}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            PR Number (8 digits)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={replenishmentData[item.id]?.prNumber || ''}
                                                            onChange={(e) => handleChange(item.id, 'prNumber', e.target.value)}
                                                            className={`block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${errors[item.id]?.prNumber ? 'border-red-500' : ''}`}
                                                            placeholder="00000000"
                                                            maxLength={8}
                                                        />
                                                        {errors[item.id]?.prNumber && (
                                                            <p className="mt-1 text-xs text-red-600">{errors[item.id].prNumber}</p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Quantity to Add
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={replenishmentData[item.id]?.addedQty || ''}
                                                            onChange={(e) => handleChange(item.id, 'addedQty', e.target.value)}
                                                            className={`block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${errors[item.id]?.addedQty ? 'border-red-500' : ''}`}
                                                            placeholder="Qty"
                                                            min="1"
                                                        />
                                                        {errors[item.id]?.addedQty && (
                                                            <p className="mt-1 text-xs text-red-600">{errors[item.id].addedQty}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-white pt-4 sm:flex sm:flex-row-reverse">
                                        <button
                                            type="submit"
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Replenish & Complete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReplenishmentModal;
