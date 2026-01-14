import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  User,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowUpDown,
} from "lucide-react";
import { driverManagementApi } from "../services/api";
import { useToast } from "../hooks/useToast";

const DriverManagement = () => {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    license_number: "",
    license_expiration: "",
    status: "active",
  });
  const [errors, setErrors] = useState({});
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    driverId: null,
  });
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  const TABLE_HEADERS = [
    { key: "name", label: "Driver Name", sortable: true },
    { key: "phone", label: "Contact Number", sortable: true },
    { key: "license_number", label: "License Number", sortable: true },
    { key: "license_expiration", label: "Expiration", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ];

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await driverManagementApi.getAll();
      setDrivers(response.data?.drivers || response.data || []);
    } catch (error) {
      console.error("Error loading drivers:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to load drivers";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleAddDriver = () => {
    if (!validateForm()) {
      return;
    }

    if (editingDriver) {
      setConfirmModal({
        isOpen: true,
        action: "update",
        driverId: editingDriver.id,
      });
    } else {
      setConfirmModal({ isOpen: true, action: "create", driverId: null });
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      setLoading(true);

      if (editingDriver) {
        await driverManagementApi.update(editingDriver.id, formData);
        toast.success("Driver updated successfully!");
      } else {
        await driverManagementApi.create(formData);
        toast.success("Driver added successfully!");
      }

      await loadDrivers();
      handleCancel();
    } catch (error) {
      console.error("Error saving driver:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to save driver";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setConfirmModal({ isOpen: false, action: null, driverId: null });
    }
  };

  const handleEditDriver = (driver) => {
    setFormData({
      name: driver.name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      license_number: driver.license_number || "",
      license_expiration: driver.license_expiration
        ? new Date(driver.license_expiration).toISOString().split("T")[0]
        : "",
      status: driver.status || "active",
    });
    setEditingDriver(driver);
    setDrivers(drivers.filter((d) => d.id !== driver.id));
  };

  const handleDeleteDriver = (driverId) => {
    setConfirmModal({ isOpen: true, action: "delete", driverId });
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      await driverManagementApi.delete(confirmModal.driverId);
      toast.success("Driver deleted successfully!");
      await loadDrivers();
    } catch (error) {
      console.error("Error deleting driver:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to delete driver";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setConfirmModal({ isOpen: false, action: null, driverId: null });
    }
  };

  const handleCloseConfirmModal = () => {
    setConfirmModal({ isOpen: false, action: null, driverId: null });
  };

  const handleCancel = () => {
    if (editingDriver) {
      loadDrivers();
    }
    setFormData({
      name: "",
      email: "",
      phone: "",
      license_number: "",
      license_expiration: "",
      status: "active",
    });
    setEditingDriver(null);
    setErrors({});
  };

  const handleSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const getSortedDrivers = () => {
    const sorted = [...drivers].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === "license_expiration") {
        const aDate = new Date(aValue || 0);
        const bDate = new Date(bValue || 0);
        return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
      }

      const aStr = String(aValue || "").toLowerCase();
      const bStr = String(bValue || "").toLowerCase();
      return sortConfig.direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    return sorted;
  };

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
      >
        <span>{label}</span>
        {isActive ? (
          sortConfig.direction === "asc" ? (
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

  const isLicenseExpired = (expirationDate) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Driver name is required";
    }
    if (!formData.phone) {
      newErrors.phone = "Contact number is required";
    } else if (!/^\d{10,}$/.test(String(formData.phone).replace(/\D/g, ""))) {
      newErrors.phone = "Contact number must be at least 10 digits";
    }
    if (!formData.license_number.trim()) {
      newErrors.license_number = "License number is required";
    }
    if (!formData.license_expiration.trim()) {
      newErrors.license_expiration = "License expiration date is required";
    } else if (isLicenseExpired(formData.license_expiration)) {
      newErrors.license_expiration =
        "License has expired. Cannot add or update driver with expired license.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            Driver Management
          </h1>
        </div>

        {/* Form Section - Collapsible */}
        <div className="border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setIsFormExpanded(!isFormExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-md font-semibold text-gray-900">
              {editingDriver ? "Edit Driver" : "Add New Driver"}
            </h3>
            {isFormExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {isFormExpanded && (
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Juan Dela Cruz"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.name ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-600 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g., 09123456789"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.phone ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    placeholder="e.g., A01-12-345678"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.license_number
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.license_number && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.license_number}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Expiration Date{" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="license_expiration"
                    value={formData.license_expiration}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.license_expiration
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.license_expiration && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.license_expiration}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-4">
                {editingDriver && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleAddDriver}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingDriver ? "Update" : "Add"} Driver
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drivers List */}
        {loading && drivers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin">
              <User className="h-12 w-12 text-blue-600" />
            </div>
            <p className="text-gray-500 font-medium mt-4">Loading drivers...</p>
          </div>
        ) : drivers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <User className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium mb-1">No drivers found</p>
            <p className="text-sm text-gray-400">
              Add your first driver using the form above
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Desktop Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
              <div className="md:col-span-1"></div>
              <div className="md:col-span-3">
                <SortableHeader label="Driver Name" sortKey="name" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader label="Contact Number" sortKey="phone" />
              </div>
              <div className="md:col-span-2">
                <SortableHeader
                  label="License Number"
                  sortKey="license_number"
                />
              </div>
              <div className="md:col-span-2">
                <SortableHeader
                  label="Expiration"
                  sortKey="license_expiration"
                />
              </div>
              <div className="md:col-span-1">
                <SortableHeader label="Status" sortKey="status" />
              </div>
              <div className="md:col-span-1 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-200">
              {getSortedDrivers().map((driver) => (
                <div
                  key={driver.id}
                  className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-colors"
                >
                  {/* Desktop View */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center">
                    <div className="md:col-span-1">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="md:col-span-3">
                      <p className="font-semibold text-gray-900">
                        {driver.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {driver.email || "No email"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-700 font-medium">
                        {driver.phone || "-"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-700 font-medium">
                        {driver.license_number || "-"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      {driver.license_expiration ? (
                        <p
                          className={`text-sm ${
                            isLicenseExpired(driver.license_expiration)
                              ? "text-red-600 font-semibold"
                              : "text-gray-600"
                          }`}
                        >
                          {new Date(
                            driver.license_expiration
                          ).toLocaleDateString()}
                          {isLicenseExpired(driver.license_expiration) && (
                            <span className="text-xs text-red-600 block">
                              (Expired)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">-</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          driver.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {driver.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="md:col-span-1 flex justify-end items-center space-x-1">
                      <button
                        onClick={() => handleEditDriver(driver)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(driver.id)}
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
                        <User className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {driver.name}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Contact:{" "}
                            <span className="font-medium text-gray-700">
                              {driver.phone || "N/A"}
                            </span>
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            License:{" "}
                            <span className="font-medium text-gray-700">
                              {driver.license_number || "N/A"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditDriver(driver)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(driver.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-8 text-center">
              <div
                className={`flex items-center justify-center w-16 h-16 mx-auto rounded-full mb-6 ${
                  confirmModal.action === "delete" ? "bg-red-50" : "bg-blue-50"
                }`}
              >
                <Info
                  className={`h-8 w-8 ${
                    confirmModal.action === "delete"
                      ? "text-red-600"
                      : "text-blue-600"
                  }`}
                />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {confirmModal.action === "delete"
                  ? "Delete Driver"
                  : confirmModal.action === "create"
                  ? "Add Driver"
                  : "Update Driver"}
              </h3>

              <p className="text-gray-600 text-base leading-relaxed mb-8">
                {confirmModal.action === "delete"
                  ? "This action cannot be undone. The driver will be permanently removed from the system."
                  : confirmModal.action === "create"
                  ? "Please confirm to add this driver to the system."
                  : "Please confirm the changes you want to make to this driver."}
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
                onClick={
                  confirmModal.action === "delete"
                    ? handleConfirmDelete
                    : handleConfirmSubmit
                }
                className={`flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors ${
                  confirmModal.action === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmModal.action === "delete"
                  ? "Delete"
                  : confirmModal.action === "create"
                  ? "Add"
                  : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverManagement;
