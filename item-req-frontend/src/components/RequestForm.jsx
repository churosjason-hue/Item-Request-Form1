import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, Send, ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestsAPI, departmentsAPI, EQUIPMENT_CATEGORIES, PRIORITY_OPTIONS } from '../services/api';
import SignaturePad from './SignaturePad';

const RequestForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const currentPath = window.location.pathname;
  const isEditing = currentPath.includes('/edit');
  const isViewing = !!id && !isEditing;
  const isCreating = !id;

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [requestData, setRequestData] = useState(null);
  const [formData, setFormData] = useState({
    userName: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || '',
    userPosition: user?.title || '',
    departmentId: user?.department?.id || user?.Department?.id || '',
    dateRequired: '',
    reason: '',
    priority: 'medium',
    comments: '',
    requestorSignature: '',
    items: [
      {
        category: 'laptop',
        itemDescription: '',
        quantity: 1,
        inventoryNumber: '',
        proposedSpecs: '',
        purpose: '',
        estimatedCost: '',
        vendorInfo: '',
        isReplacement: false,
        replacedItemInfo: '',
        urgencyReason: ''
      }
    ]
  });
  const [errors, setErrors] = useState({});

  const canEditReturned = requestData?.status === 'returned' && 
                          requestData?.requestor?.id === user?.id && 
                          isViewing;

  const getInputProps = (baseProps = {}) => {
    if (isViewing) {
      return {
        ...baseProps,
        disabled: true,
        className: `${baseProps.className || ''} bg-gray-50`.trim()
      };
    }
    return baseProps;
  };

  // Helper function to get requestor's full name
  const getRequestorName = () => {
    if (user?.fullName) return user.fullName;
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user?.firstName) return user.firstName;
    if (user?.lastName) return user.lastName;
    if (user?.username) return user.username;
    return '';
  };

  useEffect(() => {
    if (isCreating && user?.role !== 'requestor') {
      alert('Only users with the requestor role can create equipment requests');
      navigate('/dashboard');
      return;
    }
    loadDepartments();
    if (isEditing || isViewing) {
      loadRequest();
    }
  }, [id]);

  const loadDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll({ active: 'true' });
      setDepartments(response.data.departments);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadRequest = async () => {
    try {
      setLoading(true);
      const response = await requestsAPI.getById(id);
      const request = response.data.request;
      setRequestData(request);
      
      // Debug: Log permissions to check why button might not appear
      console.log('Request status:', request.status);
      console.log('Permissions:', request.permissions);
      console.log('User role:', user?.role);
      console.log('Requestor:', request.requestor);
      console.log('User ID:', user?.id);
      console.log('Requestor ID:', request.requestor?.id);
      console.log('Is viewing:', isViewing);
      
      if (isEditing && !['draft', 'returned'].includes(request.status)) {
        navigate('/dashboard');
        return;
      }

      setFormData({
        requestNumber: request.requestNumber,
        status: request.status,
        userName: request.userName || '',
        userPosition: request.userPosition || '',
        departmentId: request.department?.id,
        dateRequired: request.dateRequired || '',
        reason: request.reason || '',
        priority: request.priority,
        comments: request.comments || '',
        requestorSignature: request.requestorSignature || '',
        items: request.items.map(item => ({
          id: item.id,
          category: item.category,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          inventoryNumber: item.inventoryNumber || '',
          proposedSpecs: item.proposedSpecs || '',
          purpose: item.purpose || '',
          estimatedCost: item.estimatedCost || '',
          vendorInfo: item.vendorInfo || '',
          isReplacement: item.isReplacement,
          replacedItemInfo: item.replacedItemInfo || '',
          urgencyReason: item.urgencyReason || ''
        }))
      });
    } catch (error) {
      console.error('Error loading request:', error);
      if (!isViewing) {
        navigate('/dashboard');
      } else {
        setErrors({ load: error.response?.data?.message || 'Failed to load request' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        category: 'laptop',
        itemDescription: '',
        quantity: 1,
        inventoryNumber: '',
        proposedSpecs: '',
        purpose: '',
        estimatedCost: '',
        vendorInfo: '',
        isReplacement: false,
        replacedItemInfo: '',
        urgencyReason: ''
      }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.userName.trim()) {
      newErrors.userName = 'User name is required';
    }
    if (!formData.departmentId) {
      newErrors.departmentId = 'Department is required';
    }
    formData.items.forEach((item, index) => {
      if (!item.itemDescription.trim()) {
        newErrors[`item_${index}_description`] = 'Item description is required';
      }
      if (item.quantity < 1) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be at least 1';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      if (isEditing) {
        await requestsAPI.update(id, formData);
      } else {
        const response = await requestsAPI.create(formData);
        navigate(`/requests/${response.data.request.id}`);
        return;
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving request:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to save request' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      let requestId = id;
      if (!isEditing) {
        const response = await requestsAPI.create(formData);
        requestId = response.data.request.id;
      } else {
        await requestsAPI.update(id, formData);
      }
      await requestsAPI.submit(requestId);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting request:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to submit request' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const comments = prompt('Enter approval comments (optional):');
    if (comments === null) return;
    try {
      setLoading(true);
      await requestsAPI.approve(id, { comments });
      alert('Request approved successfully!');
      // Reload request data to show updated status and permissions
      await loadRequest();
    } catch (error) {
      console.error('Error approving request:', error);
      alert(error.response?.data?.message || 'Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    const comments = prompt('Enter reason for declining (required):');
    if (!comments || comments.trim() === '') {
      alert('Decline reason is required');
      return;
    }
    if (!confirm('Are you sure you want to decline this request?')) return;
    try {
      setLoading(true);
      await requestsAPI.decline(id, { comments });
      alert('Request declined');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error declining request:', error);
      alert(error.response?.data?.message || 'Failed to decline request');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this draft request? This action cannot be undone.')) {
      return;
    }
    try {
      setLoading(true);
      await requestsAPI.delete(id);
      alert('Draft request deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting request:', error);
      alert(error.response?.data?.message || 'Failed to delete request');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    let returnTo = 'requestor';
    if (user.role === 'it_manager' || user.role === 'super_administrator') {
      const choice = confirm(
        'Where do you want to return this request?\n\n' +
        'Click "OK" to return to Department Approver\n' +
        'Click "Cancel" to return to Requestor'
      );
      returnTo = choice ? 'department_approver' : 'requestor';
    }
    const returnReason = prompt('Enter reason for returning (required):');
    if (!returnReason || returnReason.trim() === '') {
      alert('Return reason is required');
      return;
    }
    try {
      setLoading(true);
      await requestsAPI.return(id, { returnReason, returnTo });
      alert(`Request returned to ${returnTo === 'department_approver' ? 'Department Approver' : 'Requestor'}`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error returning request:', error);
      alert(error.response?.data?.message || 'Failed to return request');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-4 px-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>
      </div>

      {/* PDF-like Form Container */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.15)' }}>
        <div className="p-8 md:p-12" style={{ minHeight: '11in' }}>
          {/* Header Section */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  STC
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900">STYROTECH CORPORATION</div>
                  <div className="text-sm text-gray-600">Packaging Solutions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Form No.</div>
                <div className="text-sm font-semibold text-gray-700">ITD-FM-001 rev.02</div>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
                IT Equipment Request Form
              </h1>
              {(isViewing || isEditing) && (
                <div className="text-sm text-gray-600 mt-2">
                  Request ID: <span className="font-semibold">{formData.requestNumber || id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Decline/Return Notification */}
          {requestData && (formData.status === 'department_declined' || formData.status === 'it_manager_declined' || formData.status === 'returned') && (
            <div className={`mb-6 p-4 border-2 ${
              formData.status === 'returned' 
                ? 'bg-yellow-50 border-yellow-400' 
                : 'bg-red-50 border-red-400'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {formData.status === 'returned' ? (
                    <RotateCcw className="h-6 w-6 text-yellow-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-lg font-semibold ${
                    formData.status === 'returned' ? 'text-yellow-800' : 'text-red-800'
                  }`}>
                    {formData.status === 'returned' ? 'Request Returned for Revision' : 'Request Declined'}
                  </h3>
                  {requestData.approvals?.map((approval, index) => {
                    if (approval.status === 'declined' || approval.status === 'returned') {
                      return (
                        <div key={index} className="mt-2">
                          <p className="text-sm font-medium text-gray-700">
                            {approval.approver?.fullName} ({approval.approver?.role?.replace('_', ' ')})
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Reason:</strong> {approval.returnReason || approval.comments || 'No reason provided'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form className="space-y-6">
            {/* Section 1: Requestor Information */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 1: Requestor Information</h2>
              </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                   <label className="block text-xs font-semibold text-gray-700 mb-1">
                     Name of Requestor <span className="text-red-600">*</span>
                   </label>
                   <div className="border-b-2 border-gray-400 pb-1">
                     <input
                       type="text"
                       value={getRequestorName()}
                       disabled
                       className="w-full bg-transparent border-0 focus:outline-none text-sm"
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-700 mb-1">
                     Position
                   </label>
                   <div className="border-b-2 border-gray-400 pb-1">
                     <input
                       type="text"
                       value={user?.title || user?.position || ''}
                       disabled
                       className="w-full bg-transparent border-0 focus:outline-none text-sm"
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-700 mb-1">
                     Department <span className="text-red-600">*</span>
                   </label>
                   <div className="border-b-2 border-gray-400 pb-1">
                     <input
                       type="text"
                       value={user?.department?.name || user?.Department?.name || ''}
                       disabled
                       className="w-full bg-transparent border-0 focus:outline-none text-sm"
                     />
                   </div>
                 </div>
               </div>
            </div>

            {/* Section 2: User Information */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 2: User Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    User's Name <span className="text-red-600">*</span>
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.userName ? 'border-red-500' : 'border-gray-400'}`}>
                    <input
                      type="text"
                      value={formData.userName}
                      {...getInputProps({
                        onChange: (e) => handleInputChange('userName', e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        placeholder: "Name of person who will use the equipment"
                      })}
                    />
                  </div>
                  {errors.userName && (
                    <p className="text-red-500 text-xs mt-1">{errors.userName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Position
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
                      value={formData.userPosition}
                      {...getInputProps({
                        onChange: (e) => handleInputChange('userPosition', e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        placeholder: "Position of the user"
                      })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date Required
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="date"
                      value={formData.dateRequired}
                      {...getInputProps({
                        onChange: (e) => handleInputChange('dateRequired', e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Equipment Required */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 3: Equipment Required</h2>
              </div>
              
              {/* Equipment Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse" style={{ border: '1px solid #000' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>✓</th>
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>ITEM DESCRIPTION</th>
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>QTY</th>
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>INV</th>
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>PROPOSED SPECS</th>
                      <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>PURPOSE</th>
                      {!isViewing && <th className="border border-gray-600 px-2 py-2 text-left text-xs font-bold" style={{ border: '1px solid #000' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-600 px-2 py-2 text-center" style={{ border: '1px solid #000' }}>
                          <input type="checkbox" checked readOnly className="w-4 h-4" />
                        </td>
                        <td className="border border-gray-600 px-2 py-2" style={{ border: '1px solid #000' }}>
                          <select
                            value={item.category}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'category', e.target.value),
                              className: "w-full px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent"
                            })}
                          >
                            {EQUIPMENT_CATEGORIES.map(cat => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={item.itemDescription}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'itemDescription', e.target.value),
                              placeholder: "Detailed description...",
                              className: `w-full mt-1 px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent ${
                                errors[`item_${index}_description`] ? 'border-red-500' : ''
                              }`,
                              rows: 2
                            })}
                          />
                          {errors[`item_${index}_description`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_description`]}</p>
                          )}
                        </td>
                        <td className="border border-gray-600 px-2 py-2" style={{ border: '1px solid #000' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1),
                              className: `w-16 px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent ${
                                errors[`item_${index}_quantity`] ? 'border-red-500' : ''
                              }`
                            })}
                          />
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                          )}
                        </td>
                        <td className="border border-gray-600 px-2 py-2" style={{ border: '1px solid #000' }}>
                          <input
                            type="text"
                            value={item.inventoryNumber}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'inventoryNumber', e.target.value),
                              placeholder: "INV#",
                              className: "w-full px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent"
                            })}
                          />
                        </td>
                        <td className="border border-gray-600 px-2 py-2" style={{ border: '1px solid #000' }}>
                          <textarea
                            value={item.proposedSpecs}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'proposedSpecs', e.target.value),
                              placeholder: "Technical specifications...",
                              className: "w-full px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent",
                              rows: 2
                            })}
                          />
                        </td>
                        <td className="border border-gray-600 px-2 py-2" style={{ border: '1px solid #000' }}>
                          <textarea
                            value={item.purpose}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'purpose', e.target.value),
                              placeholder: "Intended use...",
                              className: "w-full px-1 py-1 border-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-xs bg-transparent",
                              rows: 2
                            })}
                          />
                        </td>
                        {!isViewing && (
                          <td className="border border-gray-600 px-2 py-2 text-center" style={{ border: '1px solid #000' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              disabled={formData.items.length === 1}
                              className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isViewing && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-4 text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              )}

              {/* Additional Item Details */}
              <div className="space-y-4 mt-6">
                {formData.items.map((item, index) => (
                  <div key={index} className="border border-gray-300 p-3">
                    <h4 className="font-semibold text-sm mb-3">Additional Details for Item {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Estimated Cost:
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1">
                          <input
                            type="number"
                            step="0.01"
                            value={item.estimatedCost}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'estimatedCost', e.target.value),
                              className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                              placeholder: "0.00"
                            })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Vendor Information:
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1">
                          <input
                            type="text"
                            value={item.vendorInfo}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'vendorInfo', e.target.value),
                              className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                              placeholder: "Preferred vendor or supplier"
                            })}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={item.isReplacement}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'isReplacement', e.checked),
                              className: "mr-2"
                            })}
                          />
                          This is a replacement for existing equipment
                        </label>
                        {item.isReplacement && (
                          <div className="border-b-2 border-gray-400 pb-1 mt-2">
                            <textarea
                              value={item.replacedItemInfo}
                              {...getInputProps({
                                onChange: (e) => handleItemChange(index, 'replacedItemInfo', e.target.value),
                                placeholder: "Information about the item being replaced...",
                                className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                                rows: 2
                              })}
                            />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Urgency Reason (if applicable):
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1">
                          <textarea
                            value={item.urgencyReason}
                            {...getInputProps({
                              onChange: (e) => handleItemChange(index, 'urgencyReason', e.target.value),
                              placeholder: "Explain why this item is urgently needed...",
                              className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                              rows: 2
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Request Details */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 4: Request Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reason for Equipment Request:
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <textarea
                      value={formData.reason}
                      {...getInputProps({
                        onChange: (e) => handleInputChange('reason', e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        rows: 3,
                        placeholder: "Explain why this equipment is needed..."
                      })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Priority:
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <select
                      value={formData.priority}
                      {...getInputProps({
                        onChange: (e) => handleInputChange('priority', e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                      })}
                    >
                      {PRIORITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Comments:
                </label>
                <div className="border-b-2 border-gray-400 pb-1">
                  <textarea
                    value={formData.comments}
                    {...getInputProps({
                      onChange: (e) => handleInputChange('comments', e.target.value),
                      className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                      rows: 3,
                      placeholder: "Any additional information or special requirements..."
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Requestor Signature */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 5: Requestor Signature</h2>
              </div>
              <div className="space-y-4">
                {isViewing ? (
                  <div className="border-2 border-gray-400 rounded p-4 bg-white">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Requestor Signature
                    </label>
                    <div className="relative border-b-2 border-gray-400 pb-2 pt-4 min-h-[100px]">
                      {/* Name as base layer - always visible, left-aligned */}
                      <div className="relative inline-block">
                        <p className="text-sm font-semibold text-gray-900 mb-1 relative z-0 text-left">
                          {getRequestorName()}
                        </p>
                        {/* Signature overlapping the name area - ALWAYS centered over the name */}
                        {formData.requestorSignature ? (
                          <div 
                            className="absolute top-0 z-10 pointer-events-none"
                            style={{ 
                              left: '50%',
                              transform: 'translate(-50%, -8px)'
                            }}
                          >
                            <img 
                              src={formData.requestorSignature} 
                              alt="Requestor Signature" 
                              className="h-auto opacity-90"
                              style={{ height: '20px', maxWidth: '400px', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1 block text-left">
                            (No signature provided - Name only)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <SignaturePad
                    value={formData.requestorSignature}
                    onChange={(signature) => handleInputChange('requestorSignature', signature)}
                    disabled={isViewing}
                    requestorName={getRequestorName()}
                  />
                )}
              </div>
            </div>

            {/* Error Display */}
            {errors.load && (
              <div className="bg-red-50 border-2 border-red-400 p-4 mb-4">
                <p className="text-red-600 text-sm">{errors.load}</p>
              </div>
            )}
            
            {errors.submit && (
              <div className="bg-red-50 border-2 border-red-400 p-4 mb-4">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-400 mt-8">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-sm font-semibold"
              >
                {isViewing ? 'Back' : 'Cancel'}
              </button>
              
              {canEditReturned && (
                <button
                  type="button"
                  onClick={() => navigate(`/requests/${id}/edit`)}
                  className="flex items-center px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-semibold"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Edit & Resubmit
                </button>
              )}
              
              {!isViewing && user.role === 'requestor' && (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {formData.status === 'returned' ? 'Resubmit' : 'Submit'}
                  </button>
                </>
              )}

              {((isViewing || isEditing) && 
                (requestData?.status === 'draft' || formData?.status === 'draft') && 
                requestData?.requestor?.id === user?.id) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Draft
                </button>
              )}

              {isViewing && (requestData?.permissions?.canApprove || requestData?.permissions?.canProcess) && (
                <>
                  {/* Only show Return/Decline for department_approver and it_manager, not for service_desk completing */}
                  {(requestData?.permissions?.canApprove || (requestData?.status !== 'service_desk_processing')) && (
                    <>
                      <button
                        type="button"
                        onClick={handleReturn}
                        disabled={loading}
                        className="flex items-center px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm font-semibold"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Return
                      </button>
                      <button
                        type="button"
                        onClick={handleDecline}
                        disabled={loading}
                        className="flex items-center px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-semibold"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Decline
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {requestData?.status === 'service_desk_processing' ? 'Complete' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestForm;
