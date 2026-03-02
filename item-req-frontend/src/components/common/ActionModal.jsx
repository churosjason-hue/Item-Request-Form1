import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ActionModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    inputLabel,
    confirmText = "Confirm",
    cancelText = "Cancel",
    inputType = "text",
    placeholder = "",
    startValue = "",
    loading = false,
    allowEmpty = false,
    options = [], // [{label: 'Option 1', value: '1'}]
    variant = "primary" // primary, danger, success
}) {
    const [inputValue, setInputValue] = useState(startValue);

    // Reset input when modal opens
    useEffect(() => {
        if (isOpen) {
            setInputValue(startValue);
        }
    }, [isOpen, startValue]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(inputValue);
    };

    const getButtonColor = () => {
        switch (variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'success': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
            default: return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
        }
    };

    const isConfirmDisabled = loading || (!allowEmpty && inputLabel && !inputValue.trim());

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    aria-hidden="true"
                    onClick={loading ? undefined : onClose}
                ></div>

                {/* Center trick */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        {title}
                                    </h3>
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                {message && (
                                    <div className="mt-2 text-sm text-gray-500 mb-4">
                                        {message}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    {inputLabel && (
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {inputLabel}
                                        </label>
                                    )}
                                    {inputType === 'textarea' ? (
                                        <textarea
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder={placeholder}
                                            rows={4}
                                            disabled={loading}
                                            autoFocus
                                        />
                                    ) : inputType === 'select' ? (
                                        <select
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            disabled={loading}
                                            autoFocus
                                        >
                                            {options && options.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={inputType}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder={placeholder}
                                            disabled={loading}
                                            autoFocus
                                        />
                                    )}

                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse -mx-6 -mb-6 mt-6">
                                        <button
                                            type="submit"
                                            disabled={isConfirmDisabled}
                                            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${getButtonColor()} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {loading ? 'Processing...' : confirmText}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            disabled={loading}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            {cancelText}
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
}
