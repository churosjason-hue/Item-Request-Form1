import React from 'react';
import PassengerList from './PassengerList';

export default function TripDetails({
    formData,
    errors = {},
    loading,
    isViewing,
    getInputProps,
    handleChange,
    user,
    passengerActions // { add, remove, change }
}) {
    const getConditionalConfig = () => {
        const configs = {
            drop_passenger_only: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS DROP PASSENGER ONLY",
                fields: [
                    { name: "pick_up_location", label: "Pick-Up Location", type: "text", span: 1 },
                    { name: "pick_up_time", label: "Pick-Up Time", type: "time", span: 1 },
                    { name: "drop_off_location", label: "Drop-Off Location", type: "text", span: 1 },
                    { name: "drop_off_time", label: "Drop-Off Time", type: "time", span: 1 },
                    { name: "destination", label: "Destination (Please specify the location in cases where multiple destinations are applicable.)", type: "text", span: 2 },
                ],
                showPassengers: true,
            },
            passenger_pickup_only: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS PASSENGER PICK-UP ONLY",
                fields: [
                    { name: "pick_up_location", label: "Pick-Up Location", type: "text", span: 1 },
                    { name: "pick_up_time", label: "Pick-Up Time", type: "time", span: 1 },
                    { name: "drop_off_location", label: "Drop-Off Location", type: "text", span: 1 },
                    { name: "destination", label: "Destination (Please specify the location in cases where multiple destinations are applicable.)", type: "text", span: 2 },
                ],
                showPassengers: true,
                passengerLabel: "Passengers to Pick Up",
            },
            item_pickup: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS ITEM PICK-UP",
                fields: [
                    { name: "pick_up_location", label: "Pick-Up Location", type: "text", span: 1 },
                    { name: "pick_up_time", label: "Pick-Up Time", type: "time", span: 1 },
                    { name: "drop_off_location", label: "Drop-Off Location", type: "text", span: 1 },
                    { name: "drop_off_time", label: "Drop-Off Time", type: "time", span: 1 },
                    { name: "destination", label: "Destination (Please specify the location in cases where multiple destinations are applicable.)", type: "text", span: 2 },
                ],
                showPassengers: true,
                passengerLabel: "Optional Passengers (For Department Approvers)",
            },
            item_delivery: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS ITEM DELIVERY",
                fields: [
                    { name: "pick_up_location", label: "Pick-Up Location", type: "text", span: 1 },
                    { name: "pick_up_time", label: "Pick-Up Time", type: "time", span: 1 },
                    { name: "drop_off_location", label: "Drop-Off Location", type: "text", span: 1 },
                    { name: "drop_off_time", label: "Drop-Off Time", type: "time", span: 1 },
                    { name: "destination", label: "Destination (Please specify the location in cases where multiple destinations are applicable.)", type: "text", span: 2 },
                ],
                showPassengers: false,
            },
            point_to_point_service: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS POINT-TO-POINT",
                fields: [
                    { name: "pick_up_location", label: "Pick-Up Location", type: "text", span: 1 },
                    { name: "pick_up_time", label: "Pick-Up Time", type: "time", span: 1 },
                    { name: "drop_off_location", label: "Drop-Off Location", type: "text", span: 1 },
                    { name: "drop_off_time", label: "Drop-Off Time", type: "time", span: 1 },
                    { name: "destination", label: "Destination (Please specify the location in cases where multiple destinations are applicable.)", type: "text", span: 2 },
                    { name: "departure_time", label: "Departure Time", type: "time", span: 1 },
                ],
                showPassengers: true,
                passengerLabel: "Passengers",
            },
            car_only: {
                title: "ACCOMPLISH THIS PART IF REQUEST IS CAR ONLY",
                fields: [
                    { name: "destination_car", label: "Destination / Car Use", type: "text", span: 2 },
                ],
                showPassengers: false,
            },
        };
        return configs[formData.request_type] || null;
    };

    const config = getConditionalConfig();
    if (!config) return null;

    // For item_pickup, passengers can ONLY be added by department approver or super admin
    const isApproverOrAdmin = user?.role === 'department_approver' || user?.role === 'super_administrator';
    const isPassengerViewing = (formData.request_type === 'item_pickup' && !isApproverOrAdmin) ? true : isViewing;

    return (
        <div className="space-y-4">
            <div className="bg-gray-50 p-3 border border-gray-300 print:p-2">
                <h3 className="text-xs font-bold text-gray-900 mb-3 print:mb-2">
                    {config.title}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 print:gap-3 print:mb-2 print:grid-cols-4">
                    {config.fields.map((field) => (
                        <div
                            key={field.name}
                            className={field.span === 2 ? "col-span-1 md:col-span-2" : ""}
                        >
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                {field.label} <span className="text-red-600">*</span>
                            </label>
                            <div
                                className={`border-b-2 pb-1 print:border-b-0 ${errors[field.name] ? "border-red-500" : "border-gray-400"
                                    }`}
                            >
                                <input
                                    type={field.type}
                                    name={field.name}
                                    value={formData[field.name] || ""}
                                    {...getInputProps({
                                        onChange: handleChange,
                                        className: "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs",
                                        disabled: loading,
                                    })}
                                />
                            </div>
                            {errors[field.name] && (
                                <p className="text-red-500 text-xs mt-1">
                                    {errors[field.name]}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Passengers Section */}
                {config.showPassengers && (
                    <div className="mt-4">
                        {config.passengerLabel && (
                            <div className="text-xs font-semibold text-gray-600 mb-1">{config.passengerLabel}</div>
                        )}
                        <PassengerList
                            passengers={formData.passengers}
                            onAdd={passengerActions.add}
                            onRemove={passengerActions.remove}
                            onChange={passengerActions.change}
                            loading={loading}
                            errors={errors}
                            isViewing={isPassengerViewing}
                            getInputProps={getInputProps}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
