import React from 'react';

export default function GeneralServicesSection({
    formData,
    isODHCUser,
    isViewing,
    isEditing,
    loading,
    availableDrivers,
    getRecommendedVehicles,
    getAvailableVehiclesMessage,
    isDriverAvailable,
    isVehicleAvailable,
    isVehicleRecommended,
    selectedVehicle,
    availableVehicles,
    handleChange,
    handleSaveSection4
}) {
    return (
        <div className="border border-gray-400 p-4 mb-6 print:break-inside-avoid">
            <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                    Section 4: To Be Accomplished by OD & Human Capital – General
                    Services
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Reference Code
                    </label>
                    <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                        <div className="text-sm text-gray-500">
                            {formData.reference_code || "-"}
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Assigned Driver
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <select
                                name="assigned_driver"
                                value={formData.assigned_driver || ""}
                                onChange={handleChange}
                                disabled={
                                    loading || getRecommendedVehicles().length === 0
                                }
                                className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                            >
                                <option value="">Select a driver</option>
                                {availableDrivers.map((driver) => {
                                    const isAvailable = isDriverAvailable(driver.name);
                                    return (
                                        <option
                                            key={driver.id}
                                            value={driver.name}
                                            disabled={!isAvailable}
                                            className={!isAvailable ? "text-gray-400 bg-gray-100" : ""}
                                        >
                                            {driver.name} - {driver.license_number}
                                            {!isAvailable ? " (Unavailable)" : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {formData.assigned_driver || "-"}
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Approval Date
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <input
                            type="date"
                            name="approval_date"
                            value={formData.approval_date || ""}
                            onChange={handleChange}
                            disabled={loading}
                            className="w-full bg-transparent border-b-2 border-gray-400 pb-1 print:border-b-0 focus:outline-none text-sm text-center"
                        />
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {formData.approval_date
                                    ? new Date(
                                        formData.approval_date
                                    ).toLocaleDateString()
                                    : "-"}
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Assigned Vehicle
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <div>
                            <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                                <select
                                    name="assigned_vehicle"
                                    value={formData.assigned_vehicle || ""}
                                    onChange={handleChange}
                                    disabled={
                                        loading || getRecommendedVehicles().length === 0
                                    }
                                    className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                                >
                                    <option value="">Select a vehicle</option>
                                    {getRecommendedVehicles().map((vehicle) => {
                                        const isRecommended = isVehicleRecommended(
                                            vehicle.id
                                        );
                                        return (
                                            <option
                                                key={vehicle.id}
                                                value={vehicle.id}
                                                disabled={!isVehicleAvailable(vehicle.id)}
                                                className={!isVehicleAvailable(vehicle.id) ? "text-gray-400 bg-gray-100" : ""}
                                            >
                                                {vehicle.plate} - {vehicle.year} {vehicle.make}{" "}
                                                {vehicle.model} ({vehicle.seaters} seaters)
                                                {isRecommended ? " - Recommended ✓" : ""}
                                                {!isVehicleAvailable(vehicle.id) ? " (Unavailable)" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            {getAvailableVehiclesMessage()}
                        </div>
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {selectedVehicle
                                    ? `${selectedVehicle.plate} - ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.seaters} seaters)`
                                    : formData.assigned_vehicle
                                        ? (() => {
                                            const vehicle = availableVehicles.find(
                                                (v) =>
                                                    v.id === parseInt(formData.assigned_vehicle)
                                            );
                                            return vehicle
                                                ? `${vehicle.plate} - ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.seaters} seaters)`
                                                : "-";
                                        })()
                                        : "-"}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {isODHCUser && (isViewing || isEditing) && (
                <div className="mt-4">
                    {!(
                        formData.assigned_driver &&
                        formData.assigned_driver.trim() &&
                        formData.assigned_vehicle &&
                        formData.approval_date
                    ) &&
                        formData.status === "submitted" && (
                            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                <strong> Action Required:</strong> Please complete
                                Section 4 (Assigned Driver, Assigned Vehicle, and
                                Approval Date) before approving this request.
                            </div>
                        )}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSaveSection4}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save Section 4"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
