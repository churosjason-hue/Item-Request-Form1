import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, ChevronDown, ChevronUp, Info, Car, ArrowUpDown } from 'lucide-react';
import { vehicleManagementApi } from '../services/api.js';
import { useToast } from '../hooks/useToast';

const VehicleManagement = () => {
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [formData, setFormData] = useState({ make: '', model: '', year: '', plate: '', seaters: '' });
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, vehicleId: null });
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'year', direction: 'desc' });
  const [loading, setLoading] = useState(true);

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await vehicleManagementApi.getAll();
      setVehicles(response.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field as user types
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.make.trim()) {
      newErrors.make = 'Make is required';
    }
    if (!formData.model.trim()) {
      newErrors.model = 'Model is required';
    }
    if (!String(formData.year).trim()) {
      newErrors.year = 'Year is required';
    } else if (!/^\d{4}$/.test(String(formData.year))) {
      newErrors.year = 'Year must be a 4-digit number';
    }
    if (!formData.plate.trim()) {
      newErrors.plate = 'License plate is required';
    }
    if (!String(formData.seaters).trim()) {
      newErrors.seaters = 'Seaters capacity is required';
    } else if (!/^\d+$/.test(String(formData.seaters)) || parseInt(formData.seaters) < 1) {
      newErrors.seaters = 'Seaters capacity must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddVehicle = () => {
    if (!validateForm()) {
      return;
    }
    
    if (editingId) {
      // Show confirmation modal for update
      setConfirmModal({ isOpen: true, action: 'update', vehicleId: editingId });
    } else {
      // Add new vehicle
      setConfirmModal({ isOpen: true, action: 'create', vehicleId: null });
    }
  };

  const handleConfirmUpdate = async () => {
    try {
      const vehicleData = {
        make: formData.make,
        model: formData.model,
        year: formData.year,
        plate: formData.plate,
        seaters: formData.seaters
      };

      if (editingId) {
        // Update existing vehicle
        await vehicleManagementApi.update(editingId, vehicleData);
        toast.success('Vehicle updated successfully');
      } else {
        // Create new vehicle
        await vehicleManagementApi.create(vehicleData);
        toast.success('Vehicle added successfully');
      }
      
      // Refresh vehicles list
      await fetchVehicles();
      setEditingId(null);
      setFormData({ make: '', model: '', year: '', plate: '', seaters: '' });
      setErrors({});
    } catch (error) {
      console.error('Error saving vehicle:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save vehicle';
      toast.error(errorMessage);
    }
    setConfirmModal({ isOpen: false, action: null, vehicleId: null });
  };

  const handleEditVehicle = (vehicle) => {
    setFormData(vehicle);
    setEditingId(vehicle.id);
    // Remove vehicle from list while editing
    setVehicles(vehicles.filter(v => v.id !== vehicle.id));
  };

  const handleDeleteVehicle = (id) => {
    setConfirmModal({ isOpen: true, action: 'delete', vehicleId: id });
  };

  const handleConfirmDelete = async () => {
    try {
      await vehicleManagementApi.delete(confirmModal.vehicleId);
      toast.success('Vehicle deleted successfully');
      await fetchVehicles();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to delete vehicle';
      toast.error(errorMessage);
    }
    setConfirmModal({ isOpen: false, action: null, vehicleId: null });
  };

  const handleCloseConfirmModal = () => {
    setConfirmModal({ isOpen: false, action: null, vehicleId: null });
  };

  const handleCancel = () => {
    if (editingId) {
       fetchVehicles();
    }
    setFormData({ make: '', model: '', year: '', plate: '', seaters: '' });
    setEditingId(null);
    setErrors({});
  };

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedVehicles = () => {
    const sorted = [...vehicles].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle numeric values
      if (sortConfig.key === 'year') {
        return sortConfig.direction === 'asc' 
          ? parseInt(aValue) - parseInt(bValue)
          : parseInt(bValue) - parseInt(aValue);
      }

      // Handle string values
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    return sorted;
  };

  const SortableHeader = ({ label, sortKey, colSpan }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
      >
        <span>{label}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? (
            <ChevronUp className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
        </div>

        {/* Form Section - Collapsible */}
        <div className="border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setIsFormExpanded(!isFormExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-md font-semibold text-gray-900">
              {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
            </h3>
            {isFormExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {isFormExpanded && (
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="make"
                    placeholder="e.g., Toyota"
                    value={formData.make}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.make ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.make && <p className="text-red-600 text-xs mt-1">{errors.make}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="model"
                    placeholder="e.g., Camry"
                    value={formData.model}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.model ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.model && <p className="text-red-600 text-xs mt-1">{errors.model}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="year"
                    placeholder="e.g., 2023"
                    value={formData.year}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.year ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.year && <p className="text-red-600 text-xs mt-1">{errors.year}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="plate"
                    placeholder="e.g., ABC-1234"
                    value={formData.plate}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.plate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.plate && <p className="text-red-600 text-xs mt-1">{errors.plate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seaters Capacity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="seaters"
                    placeholder="e.g., 5"
                    value={formData.seaters}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.seaters ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.seaters && <p className="text-red-600 text-xs mt-1">{errors.seaters}</p>}
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-4">
                {editingId && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleAddVehicle}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {editingId ? 'Update' : 'Add'} Vehicle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Vehicles List */}
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin">
              <Car className="h-12 w-12 text-blue-600" />
            </div>
            <p className="text-gray-500 font-medium mt-4">Loading vehicles...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium mb-1">No vehicles added yet</p>
            <p className="text-sm text-gray-400">Add your first vehicle using the form above</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
              <div className="md:col-span-1"></div>
              <div className="md:col-span-2">
                <SortableHeader label="Vehicle" sortKey="make" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader label="Make" sortKey="make" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader label="Model" sortKey="model" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader label="Year" sortKey="year" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader label="Seaters" sortKey="seaters" />
              </div>
              <div className="md:col-span-1 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-200">
              {getSortedVehicles().map((vehicle) => {
                return (
                  <div key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-colors">
                    {/* Desktop View */}
                    <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center">
                      <div className="md:col-span-1">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="md:col-span-2">
                        <p className="font-semibold text-gray-900">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{vehicle.plate}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-gray-700 font-medium">{vehicle.make}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-gray-700 font-medium">{vehicle.model}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-gray-700 font-medium">{vehicle.year}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                          {vehicle.seaters} Seaters
                        </span>
                      </div>
                      <div className="md:col-span-1 flex justify-end items-center space-x-1">
                        <button
                          onClick={() => handleEditVehicle(vehicle)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <Car className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              License Plate: <span className="font-medium text-gray-700">{vehicle.plate}</span>
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Seaters: <span className="font-medium text-gray-700">{vehicle.seaters}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditVehicle(vehicle)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full mb-6 ${
                confirmModal.action === 'delete'
                  ? 'bg-red-50'
                  : 'bg-blue-50'
              }">
                <Info className={`h-8 w-8 ${
                  confirmModal.action === 'delete'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`} />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {confirmModal.action === 'delete' ? 'Delete Vehicle' : confirmModal.action === 'create' ? 'Add Vehicle' : 'Update Vehicle'}
              </h3>
              
              <p className="text-gray-600 text-base leading-relaxed mb-8">
                {confirmModal.action === 'delete'
                  ? 'This action cannot be undone. The vehicle will be permanently removed from the system.'
                  : confirmModal.action === 'create'
                  ? 'Please confirm to add this vehicle to the system.'
                  : 'Please confirm the changes you want to make to this vehicle.'}
              </p>
            </div>
            
            <div className="bg-gray-50 px-8 py-6 flex gap-3 rounded-b-2xl">
              <button
                onClick={handleCloseConfirmModal}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action === 'delete' ? handleConfirmDelete : handleConfirmUpdate}
                className={`flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors ${
                  confirmModal.action === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.action === 'delete' ? 'Delete' : confirmModal.action === 'create' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleManagement;
