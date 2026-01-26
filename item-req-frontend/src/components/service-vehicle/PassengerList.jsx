import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function PassengerList({
    passengers = [{ name: "" }],
    onAdd,
    onRemove,
    onChange,
    loading,
    errors = {},
    isViewing,
    getInputProps
}) {
    return (
        <div className="border-t border-gray-300 pt-4 mt-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-900">
                    Passengers
                </h3>
                {!isViewing && (
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={loading}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm no-print"
                    >
                        <Plus className="h-4 w-4" />
                        Add Passenger
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {passengers.map((passenger, index) => (
                    <div
                        key={index}
                        className="bg-gray-50 p-3 border border-gray-300"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-gray-700">
                                Passenger {index + 1}
                            </span>
                            {!isViewing && passengers.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(index)}
                                    disabled={loading}
                                    className="text-red-600 hover:text-red-800 no-print"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Name <span className="text-red-600">*</span>
                                </label>
                                <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                                    <input
                                        type="text"
                                        value={passenger.name}
                                        {...getInputProps({
                                            onChange: (e) => onChange(index, "name", e.target.value),
                                            className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                                            disabled: loading,
                                        })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {errors.passengers && (
                <p className="text-red-500 text-xs mt-1">{errors.passengers}</p>
            )}
        </div>
    );
}
