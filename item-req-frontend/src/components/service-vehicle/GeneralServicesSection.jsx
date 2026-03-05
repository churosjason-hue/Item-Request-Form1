import React, { useState } from 'react';
import { CalendarCheck, CalendarX, Info, AlertTriangle, Ban, Clock } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UVVRP_WEEKDAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

const dayAbbr = (day) => day ? day.slice(0, 3) : '';

// Convert "HH:mm" or "HH:mm:ss" to total minutes from midnight
const timeToMins = (t) => {
    if (!t) return null;
    const parts = t.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
};

/**
 * UVVRP Coding Status
 * Returns: 'peak' | 'window' | 'none'
 *   'peak'   → coding restriction in effect (7–10 AM or 5–8 PM on coding day, weekday)
 *   'window' → coding day but window hour (10:01 AM–4:59 PM) — travel allowed
 *   'none'   → not affected (not coding day, weekend, before 7 AM, after 8 PM)
 */
const uvvrpStatus = (vehicle, travelDay, pickUpTime, holidays = [], travelDateStr = '') => {
    // Prefer server-computed status when available (already accounts for day/holiday)
    if (vehicle.uvvrpStatus) return vehicle.uvvrpStatus;

    if (!vehicle.coding_sched || vehicle.coding_sched !== travelDay) return 'none';
    if (!UVVRP_WEEKDAYS.has(travelDay)) return 'none';
    if (travelDateStr && holidays.includes(travelDateStr)) return 'none';

    const mins = timeToMins(pickUpTime);
    if (mins === null) return 'peak'; // No time = assume worst case

    // Window hour: 10:01 AM (601) to 4:59 PM (1019)
    if (mins >= 601 && mins <= 1019) return 'window';

    // Peak hours: 7:00 AM (420–600) and 5:00 PM (1020–1200)
    if ((mins >= 420 && mins <= 600) || (mins >= 1020 && mins <= 1200)) return 'peak';

    return 'none'; // Before 7 AM or after 8 PM
};

const UVVRP_BADGE = {
    peak: { bg: 'bg-red-100 text-red-700', icon: '🚫', label: 'Coding' },
    window: { bg: 'bg-blue-100 text-blue-700', icon: '🕐', label: 'Window Hr' },
    none: { bg: 'bg-green-100 text-green-700', icon: '✔', label: 'Available' },
};

const formatTime = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};

const formatDate = (d) => {
    if (!d) return '';
    const [y, mo, day] = d.split('-');
    return new Date(Number(y), Number(mo) - 1, Number(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function GeneralServicesSection({
    formData,
    isODHCUser,
    isViewing,
    isEditing,
    loading,
    availableDrivers,
    selectedVehicle,
    availableVehicles,
    unavailableVehicles = [],
    handleChange,
    handleSaveSection4
}) {
    const [showSchedule, setShowSchedule] = useState(false);

    const getTravelDayOfWeek = () => {
        if (!formData.travel_date_from) return null;
        const date = new Date(formData.travel_date_from);
        if (isNaN(date.getTime())) return null;
        const adjusted = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        return DAYS[adjusted.getDay()];
    };

    const travelDay = getTravelDayOfWeek();
    const pickUpTime = formData.pick_up_time || null;

    const isOtherVehicle = formData.assigned_vehicle === 'other';

    const currentVehicle = selectedVehicle ||
        (!isOtherVehicle && formData.assigned_vehicle
            ? (availableVehicles.find(v => v.id === parseInt(formData.assigned_vehicle)) ||
                unavailableVehicles.find(v => v.id === parseInt(formData.assigned_vehicle)))
            : null);

    const selectedCoding = currentVehicle?.coding_sched || null;
    const selectedUvvrp = !isOtherVehicle && currentVehicle
        ? uvvrpStatus(currentVehicle, travelDay, pickUpTime, [], formData.travel_date_from)
        : 'none';
    const bookedVehicleData = !isOtherVehicle ? (unavailableVehicles.find(v => v.id === currentVehicle?.id) || null) : null;
    const isCurrentVehicleBooked = !!bookedVehicleData;

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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Reference Code</label>
                    <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                        <div className="text-sm text-gray-500">{formData.reference_code || '-'}</div>
                    </div>
                </div>

                {/* Assigned Driver */}
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Driver</label>
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Approval Date</label>
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
                                {formData.approval_date ? new Date(formData.approval_date).toLocaleDateString() : '-'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Assigned Vehicle */}
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Vehicle</label>
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
                                    disabled={loading || (availableVehicles.length === 0 && unavailableVehicles.length === 0)}
                                    className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 text-center"
                                >
                                    <option value="">Select a vehicle</option>
                                    {availableVehicles.map((vehicle) => {
                                        const vStatus = uvvrpStatus(vehicle, travelDay, pickUpTime, [], formData.travel_date_from);
                                        const isPeak = vStatus === 'peak';
                                        const isWindow = vStatus === 'window';
                                        return (
                                            <option key={vehicle.id} value={vehicle.id} disabled={isPeak}>
                                                {vehicle.plate} - {vehicle.make} {vehicle.model}
                                                &nbsp;({vehicle.seaters} seaters{vehicle.coding_sched ? `, Coding: ${vehicle.coding_sched}` : ''})
                                                {isPeak ? ' — Coding restriction (UVVRP)' : ''}
                                                {isWindow ? ' — Window hour (allowed)' : ''}
                                            </option>
                                        );
                                    })}
                                    {unavailableVehicles.length > 0 && (
                                        <optgroup label="── Booked on Selected Dates ──">
                                            {unavailableVehicles.map((vehicle) => (
                                                <option key={vehicle.id} value={vehicle.id} disabled>
                                                    {vehicle.plate} - {vehicle.make} {vehicle.model} — BOOKED
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="── Other ──">
                                        <option value="other">Other Vehicle (specify below)</option>
                                    </optgroup>
                                </select>

                                {/* Free-text input when "Other" is selected */}
                                {isOtherVehicle && (
                                    <input
                                        type="text"
                                        name="assigned_vehicle_other"
                                        value={formData.assigned_vehicle_other || ''}
                                        onChange={handleChange}
                                        disabled={loading}
                                        placeholder="Enter vehicle name / description..."
                                        className="mt-2 w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                )}
                            </div>

                            {!showSchedule && (
                                <p className="text-[10px] text-gray-400 italic mt-1 text-center select-none">
                                    Hover to view vehicle schedule
                                </p>
                            )}

                            {/* ── Vehicle Schedule Availability Panel ── */}
                            <div className={`mt-2 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden no-print transition-all duration-200 ease-in-out ${showSchedule ? 'opacity-100 max-h-[900px]' : 'opacity-0 max-h-0 pointer-events-none border-0'}`}>

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
                                {isOtherVehicle ? (
                                    <div className="px-3 py-2 flex items-start gap-2 border-b border-gray-200 bg-blue-50">
                                        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-blue-800">Other Vehicle</p>
                                            <p className="text-xs mt-0.5 text-blue-700">Availability check bypassed for this selection.</p>
                                            {formData.assigned_vehicle_other && (
                                                <p className="text-xs mt-1 text-blue-600 italic">"{formData.assigned_vehicle_other}"</p>
                                            )}
                                        </div>
                                    </div>
                                ) : currentVehicle && (() => {
                                    if (isCurrentVehicleBooked) {
                                        const c = bookedVehicleData?.conflict;
                                        const fromFmt = c ? formatDate(c.from) : '';
                                        const toFmt = c ? formatDate(c.to) : '';
                                        const pickUp = c?.pick_up_time ? formatTime(c.pick_up_time) : null;
                                        const dropOff = c?.drop_off_time ? formatTime(c.drop_off_time) : null;
                                        return (
                                            <div className="px-3 py-2 flex items-start gap-2 border-b border-gray-200 bg-orange-50">
                                                <Ban className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs font-semibold text-orange-800">
                                                        {currentVehicle.plate} — {currentVehicle.make} {currentVehicle.model}
                                                    </p>
                                                    <p className="text-xs mt-0.5 text-orange-700 font-medium">⚠ This vehicle is already booked on the selected dates.</p>
                                                    {c && (
                                                        <div className="mt-1 space-y-0.5 text-[10px] text-orange-600">
                                                            <p>📅 {fromFmt}{fromFmt !== toFmt ? ` → ${toFmt}` : ''}</p>
                                                            {(pickUp || dropOff) && <p>🕐 {pickUp || '—'} → {dropOff || '—'}</p>}
                                                            {c.reference_code && <p>Ref: {c.reference_code}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className={`px-3 py-2 flex items-start gap-2 border-b border-gray-200 ${selectedUvvrp === 'peak' ? 'bg-red-50'
                                                : selectedUvvrp === 'window' ? 'bg-blue-50'
                                                    : 'bg-green-50'
                                            }`}>
                                            {selectedUvvrp === 'peak'
                                                ? <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                : selectedUvvrp === 'window'
                                                    ? <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                    : <CalendarCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                            }
                                            <div>
                                                <p className={`text-xs font-semibold ${selectedUvvrp === 'peak' ? 'text-red-700'
                                                        : selectedUvvrp === 'window' ? 'text-blue-700'
                                                            : 'text-green-700'
                                                    }`}>
                                                    {currentVehicle.plate} — {currentVehicle.make} {currentVehicle.model}
                                                </p>
                                                <p className={`text-xs mt-0.5 ${selectedUvvrp === 'peak' ? 'text-red-600'
                                                        : selectedUvvrp === 'window' ? 'text-blue-600'
                                                            : 'text-green-600'
                                                    }`}>
                                                    {selectedUvvrp === 'peak'
                                                        ? `🚫 UVVRP coding restriction — ${selectedCoding} peak hour. Vehicle restricted.`
                                                        : selectedUvvrp === 'window'
                                                            ? `🕐 Coding day (${selectedCoding}) but within window hour — travel allowed.`
                                                            : selectedCoding
                                                                ? `✔ Available on ${travelDay || 'travel date'} (Coding: ${selectedCoding})`
                                                                : `✔ No coding schedule — available any day`}
                                                </p>
                                                {(selectedUvvrp === 'peak' || selectedUvvrp === 'window') && (
                                                    <p className="text-[10px] mt-1 text-gray-500 italic">
                                                        UVVRP: Peak 7–10 AM &amp; 5–8 PM · Window 10:01 AM–4:59 PM (Mon–Fri)
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* All vehicles list */}
                                <div className="px-3 py-2">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">All Vehicles</p>
                                    <div className="space-y-1.5">

                                        {/* Available vehicles */}
                                        {availableVehicles.map((vehicle) => {
                                            const vStatus = uvvrpStatus(vehicle, travelDay, pickUpTime, [], formData.travel_date_from);
                                            const isPeak = vStatus === 'peak';
                                            const isWindow = vStatus === 'window';
                                            const isSelected = currentVehicle?.id === vehicle.id;
                                            const badge = UVVRP_BADGE[vStatus];
                                            return (
                                                <div
                                                    key={vehicle.id}
                                                    className={`flex items-center justify-between rounded px-2 py-1.5 text-xs border ${isSelected
                                                        ? isPeak ? 'bg-red-100 border-red-300'
                                                            : isWindow ? 'bg-blue-100 border-blue-300'
                                                                : 'bg-green-100 border-green-300'
                                                        : 'bg-white border-gray-100'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {isPeak
                                                            ? <CalendarX className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                                            : isWindow
                                                                ? <Clock className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                                : <CalendarCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                                        }
                                                        <span className={`font-medium truncate ${isPeak ? 'text-red-700' : isWindow ? 'text-blue-700' : 'text-gray-700'}`}>{vehicle.plate}</span>
                                                        <span className="text-gray-400 truncate hidden sm:inline">{vehicle.make} {vehicle.model}</span>
                                                        <span className="text-gray-400">({vehicle.seaters})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                        <div className="flex gap-0.5">
                                                            {DAYS.map((day) => (
                                                                <span
                                                                    key={day}
                                                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[9px] font-bold ${vehicle.coding_sched === day
                                                                        ? 'bg-red-500 text-white'
                                                                        : travelDay === day
                                                                            ? 'bg-blue-100 text-blue-500 ring-1 ring-blue-300'
                                                                            : 'bg-gray-100 text-gray-400'
                                                                        }`}
                                                                    title={day}
                                                                >
                                                                    {dayAbbr(day)[0]}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg}`}>
                                                            {badge.icon} {badge.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    </div>

                                    {/* UVVRP Legend */}
                                    <div className="mt-2 pt-2 border-t border-gray-200 flex gap-3 flex-wrap text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Coding (peak hr)</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-100 ring-1 ring-blue-300" /> Window hr (10AM–5PM)</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-100 ring-1 ring-green-300" /> Available</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-100 ring-1 ring-orange-300" /> Booked</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-gray-100" /> Other day</span>
                                    </div>
                                </div>
                            </div>
                            {/* end schedule panel */}
                        </div>
                    ) : (
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <div className="text-sm text-gray-500">
                                {isOtherVehicle
                                    ? (formData.assigned_vehicle_other ? `Other: ${formData.assigned_vehicle_other}` : 'Other Vehicle')
                                    : currentVehicle
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

            {/* Save Section 4 button */}
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
