import React, { useState } from 'react';
import { PenTool } from 'lucide-react';
import SignatureModal from '../SignatureModal';

export default function SignatureSection({
    formData,
    user,
    id,
    isReadOnly,
    onSignatureSave
}) {
    const [showModal, setShowModal] = useState(false);
    const [tempSignature, setTempSignature] = useState("");

    // Check if current user is the requestor
    const isRequestor = user?.id === formData.requested_by;
    // Can sign if: 
    // 1. Not read only AND
    // 2. (Is the requestor OR it's a new request)
    const canSign = !isReadOnly && (isRequestor || !id);

    const handleClick = () => {
        if (canSign) {
            setTempSignature(formData.requestor_signature || "");
            setShowModal(true);
        }
    };

    return (
        <>
            <div className="border border-gray-400 p-4 mb-6 print:break-inside-avoid">
                <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                    <h2 className="text-sm font-bold text-gray-900 uppercase">
                        Section 3: Requestor Signature
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Name and Signature
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0 min-h-[40px] flex items-end">
                            {formData.requestor_signature ? (
                                <div className="w-full">
                                    <div
                                        className={`mb-0 ${canSign ? "cursor-pointer group relative" : ""}`}
                                        onClick={handleClick}
                                    >
                                        <img
                                            src={formData.requestor_signature}
                                            alt="Signature"
                                            className="h-10 object-contain -mb-4 relative z-10"
                                        />
                                        {canSign && (
                                            <span className="block text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-900 -mt-2 leading-tight relative z-0">{formData.requestor_name}</p>
                                </div>
                            ) : (
                                <div
                                    className={`w-full flex items-center justify-between ${canSign ? "cursor-pointer hover:bg-gray-50 p-1 rounded" : ""}`}
                                    onClick={handleClick}
                                >
                                    <span className="text-sm text-gray-900">{formData.requestor_name || "Select to Sign"}</span>
                                    {canSign && (
                                        <PenTool className="h-4 w-4 text-gray-400" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Date
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1 print:border-b-0">
                            <input
                                type="date"
                                name="requested_by_date"
                                value={formData.requested_by_date || ""}
                                readOnly
                                className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <SignatureModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setTempSignature('');
                }}
                value={tempSignature}
                onChange={setTempSignature}
                approverName={formData.requestor_name}
                approverTitle="Requestor"
                label="Requestor E-Signature"
                onSave={() => {
                    onSignatureSave(tempSignature);
                    setShowModal(false);
                }}
            />
        </>
    );
}
