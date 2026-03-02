import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ReturnRequestModal({
    isOpen,
    onClose,
    onConfirm,
    returnOptions = [], // [{label: 'Requestor', value: 'requestor'}]
    loading = false
}) {
    const [reason, setReason] = useState("");
    const [returnTo, setReturnTo] = useState("requestor");

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setReason("");
            // Default to requestor if options empty, or first option
            setReturnTo(returnOptions.length > 0 ? returnOptions[0].value : "requestor");
        }
    }, [isOpen, returnOptions]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(reason, returnTo);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    aria-hidden="true"
                    onClick={loading ? undefined : onClose}
                ></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Return Request
                                    </h3>
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    {returnOptions.length > 1 && (
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Return To
                                            </label>
                                            <select
                                                value={returnTo}
                                                onChange={(e) => setReturnTo(e.target.value)}
                                                className="shadow-sm focus:ring-yellow-500 focus:border-yellow-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                                disabled={loading}
                                            >
                                                {returnOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Reason for Return
                                        </label>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="shadow-sm focus:ring-yellow-500 focus:border-yellow-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                            placeholder="Please explain why you are returning this request..."
                                            rows={4}
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse -mx-6 -mb-6 mt-6">
                                        <button
                                            type="submit"
                                            disabled={loading || !reason.trim()}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? 'Returning...' : 'Return Request'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            disabled={loading}
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
}
