import React, { useState } from 'react';
import { CalendarCheck, CalendarX, Info, AlertTriangle } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Returns day abbreviation for compact display
const dayAbbr = (day) => day ? day.slice(0, 3) : '';

// Check if a vehicle is on coding on a given day
const isCodingDay = (vehicle, day) => day && vehicle.coding_sched === day;

export default function GeneralServicesSection({
    formData,
    isODHCUser,
    isViewing,
    isEditing,
    loading,
    availableDrivers,
    selectedVehicle,
    availableVehicles,
    handleChange,
    handleSaveSection4
}) {
    const [showSchedule, setShowSchedule] = useState(false);

    // Derive the day of the week for the travel date
    const getTravelDayOfWeek = () => {
        if (!formData.travel_date_from) return null;
        const date = new Date(formData.travel_date_from);
        if (isNaN(date.getTime())) return null;
        // Add 1 day to compensate for UTC offset in DATEONLY fields
        const adjusted = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        return DAYS[adjusted.getDay()];
    };

    const travelDay = getTravelDayOfWeek();

    // Find currently selected vehicle object
    const currentVehicle = selectedVehicle ||
        (formData.assigned_vehicle
            ? availableVehicles.find(v => v.id === parseInt(formData.assigned_vehicle))
            : null);

    const selectedCoding = currentVehicle?.coding_sched || null;
    const selectedOnCoding = currentVehicle && isCodingDay(currentVehicle, travelDay);

    return (
        <div className="border border-gray-400 p-4 mb-6 print:mb-3 print:p-2 print:break-inside-avoid">
            <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                    To Be Accomplished by OD &amp; Human Capital – General Services
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-4 print:gap-2">
                {/* Reference Code */}
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Reference Code
                    </label>
                    <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                        <div className="text-sm text-gray-500">{formData.reference_code || '-'}</div>
                    </div>
                </div>

                {/* Assigned Driver */}
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Assigned Driver
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <select
                                name="assigned_driver"
                                value={formData.assigned_driver || ''}
                                onChange={handleChange}
                                disabled={loading || availableDrivers.length === 0}
                                className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 text-center"
                            >
                                <option value="">Select a driver</option>
                                {availableDrivers.map((driver) => (
                                    <option key={driver.id} value={driver.name}>
                                        {driver.name} - {driver.license_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">{formData.assigned_driver || '-'}</div>
                        </div>
                    )}
                </div>

                {/* Approval Date */}
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Approval Date
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <input
                            type="date"
                            name="approval_date"
                            value={formData.approval_date || ''}
                            onChange={handleChange}
                            disabled={loading}
                            className="w-full bg-transparent border-b-2 border-gray-400 pb-1 print:border-b-0 focus:outline-none text-sm text-gray-900 text-center"
                        />
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {formData.approval_date
                                    ? new Date(formData.approval_date).toLocaleDateString()
                                    : '-'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Assigned Vehicle */}
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Assigned Vehicle
                    </label>
                    {isODHCUser && (isViewing || isEditing) ? (
                        <div
                            onMouseEnter={() => setShowSchedule(true)}
                            onMouseLeave={() => setShowSchedule(false)}
                        >
                            <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                                <select
                                    name="assigned_vehicle"
                                    value={formData.assigned_vehicle || ''}
                                    onChange={handleChange}
                                    disabled={loading || availableVehicles.length === 0}
                                    className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 text-center"
                                >
                                    <option value="">Select a vehicle</option>
                                    {availableVehicles.map((vehicle) => {
                                        const onCoding = isCodingDay(vehicle, travelDay);
                                        return (
                                            <option
                                                key={vehicle.id}
                                                value={vehicle.id}
                                                disabled={onCoding}
                                            >
                                                {vehicle.plate} - {vehicle.make} {vehicle.model}
                                                &nbsp;({vehicle.seaters} seaters{vehicle.coding_sched ? `, Coding: ${vehicle.coding_sched}` : ''})
                                                {onCoding ? ' — Not Available (Coding)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            {!showSchedule && (
                                <p className="text-[10px] text-gray-400 italic mt-1 text-center select-none">
                                    Hover to view vehicle schedule
                                </p>
                            )}

                            {/* ── Vehicle Schedule Availability Panel ── */}
                            <div className={`mt-2 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden no-print transition-all duration-200 ease-in-out ${showSchedule ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0 pointer-events-none border-0'}`}>
                                {/* Header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200">
                                    <Info className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                        Vehicle Schedule Availability
                                        {travelDay && (
                                            <span className="ml-1 text-blue-600 font-bold">— Travel Day: {travelDay}</span>
                                        )}
                                    </span>
                                </div>

                                {/* Selected vehicle status */}
                                {currentVehicle && (
                                    <div className={`px-3 py-2 flex items-start gap-2 border-b border-gray-200 ${selectedOnCoding ? 'bg-red-50' : 'bg-green-50'}`}>
                                        {selectedOnCoding ? (
                                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <CalendarCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div>
                                            <p className={`text-xs font-semibold ${selectedOnCoding ? 'text-red-700' : 'text-green-700'}`}>
                                                {currentVehicle.plate} — {currentVehicle.make} {currentVehicle.model}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${selectedOnCoding ? 'text-red-600' : 'text-green-600'}`}>
                                                {selectedOnCoding
                                                    ? `⚠ Coding day is ${selectedCoding} — this vehicle is NOT available on the travel date.`
                                                    : selectedCoding
                                                        ? `✔ Available on ${travelDay || 'travel date'} (Coding: ${selectedCoding})`
                                                        : `✔ No coding schedule — available any day`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* All vehicles availability grid */}
                                <div className="px-3 py-2">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">All Vehicles</p>
                                    <div className="space-y-1.5">
                                        {availableVehicles.map((vehicle) => {
                                            const onCoding = isCodingDay(vehicle, travelDay);
                                            const isSelected = currentVehicle?.id === vehicle.id;
                                            return (
                                                <div
                                                    key={vehicle.id}
                                                    className={`flex items-center justify-between rounded px-2 py-1.5 text-xs border
                                                        ${isSelected
                                                            ? onCoding
                                                                ? 'bg-red-100 border-red-300'
                                                                : 'bg-green-100 border-green-300'
                                                            : 'bg-white border-gray-100'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {onCoding
                                                            ? <CalendarX className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                                            : <CalendarCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                                                        <span className={`font-medium truncate ${onCoding ? 'text-red-700' : 'text-gray-700'}`}>
                                                            {vehicle.plate}
                                                        </span>
                                                        <span className="text-gray-400 truncate hidden sm:inline">
                                                            {vehicle.make} {vehicle.model}
                                                        </span>
                                                        <span className="text-gray-400">({vehicle.seaters})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                        {/* Coding day pills */}
                                                        <div className="flex gap-0.5">
                                                            {DAYS.map((day) => (
                                                                <span
                                                                    key={day}
                                                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[9px] font-bold
                                                                        ${vehicle.coding_sched === day
                                                                            ? 'bg-red-500 text-white'
                                                                            : travelDay === day
                                                                                ? 'bg-blue-100 text-blue-500 ring-1 ring-blue-300'
                                                                                : 'bg-gray-100 text-gray-400'}
                                                                    `}
                                                                    title={day}
                                                                >
                                                                    {dayAbbr(day)[0]}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                                            ${onCoding
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-green-100 text-green-700'}`}>
                                                            {onCoding ? 'Coding' : 'Available'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Legend */}
                                    <div className="mt-2 pt-2 border-t border-gray-200 flex gap-4 flex-wrap text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Coding day
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 ring-1 ring-blue-300" /> Travel day
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-sm bg-gray-100" /> Other day
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* end schedule panel */}
                        </div>
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {currentVehicle
                                    ? `${currentVehicle.plate} - ${currentVehicle.make} ${currentVehicle.model} (${currentVehicle.seaters} seaters)`
                                    : formData.assigned_vehicle
                                        ? (() => {
                                            const v = availableVehicles.find(v => v.id === parseInt(formData.assigned_vehicle));
                                            return v ? `${v.plate} - ${v.make} ${v.model} (${v.seaters} seaters)` : '-';
                                        })()
                                        : '-'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Section 4 button + action required notice */}
            {isODHCUser && (isViewing || isEditing) && (
                <div className="mt-4">
                    {!(
                        formData.assigned_driver &&
                        formData.assigned_driver.trim() &&
                        formData.assigned_vehicle &&
                        formData.approval_date
                    ) && formData.status === 'submitted' && (
                            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                <strong>Action Required:</strong> Please complete Section 4 (Assigned Driver, Assigned Vehicle, and Approval Date) before approving this request.
                            </div>
                        )}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSaveSection4}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Section 4'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
