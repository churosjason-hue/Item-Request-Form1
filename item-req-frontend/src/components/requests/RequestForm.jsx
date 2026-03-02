import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  PenTool,
  Download,
  Printer,
  Paperclip,
  X,
  Package,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ToastContext } from "../../contexts/ToastContext";
import {
  requestsAPI,
  departmentsAPI,
  categoriesAPI,
  settingsAPI,
  PRIORITY_OPTIONS,
  getBaseUrl,
} from "../../services/api";
import STC_LOGO from "../../assets/STC_LOGO.png";
import SignatureModal from "../common/SignatureModal";
import ActionModal from "../common/ActionModal";
import ConfirmDialog from "../common/ConfirmDialog";
import ReturnRequestModal from "./ReturnRequestModal";
import ReplenishmentModal from "../inventory/ReplenishmentModal";

const RequestForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  } = useContext(ToastContext);

  const currentPath = window.location.pathname;
  const isEditing = currentPath.includes("/edit");
  const isViewing = !!id && !isEditing;
  const isCreating = !id;

  // Helper to calculate 10 working days from now
  const calculateTenWorkingDays = () => {
    let count = 0;
    let currentDate = new Date();

    while (count < 10) {
      currentDate.setDate(currentDate.getDate() + 1);
      const day = currentDate.getDay();
      if (day !== 0 && day !== 6) {
        // 0=Sun, 6=Sat
        count++;
      }
    }
    return currentDate.toISOString().split("T")[0];
  };

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [requestData, setRequestData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [generalPurposes, setGeneralPurposes] = useState([]);
  const [formData, setFormData] = useState({
    userName:
      user?.fullName ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      "",
    userPosition: user?.title || "",
    departmentId: user?.department?.id || user?.Department?.id || "",
    priority: "medium",
    comments: "",
    requestorSignature: "",
    items: [
      {
        category: "laptop",
        itemDescription: "",
        quantity: 1,
        inventoryNumber: "",
        proposedSpecs: "",
        purpose: "",
        estimatedCost: "",
        vendorInfo: "",
        isReplacement: false,
        replacedItemInfo: "",
        urgencyReason: "",
        dateRequired: calculateTenWorkingDays(),
        approvalStatus: "pending",
        endorserStatus: "pending",
        endorserRemarks: "",
      },
    ],
  });
  const [errors, setErrors] = useState({});
  const [approvalSignature, setApprovalSignature] = useState("");
  const [showRequestorSignatureModal, setShowRequestorSignatureModal] =
    useState(false);
  const [showApprovalSignatureModal, setShowApprovalSignatureModal] =
    useState(false);
  const [tempRequestorSignature, setTempRequestorSignature] = useState("");
  const [tempApprovalSignature, setTempApprovalSignature] = useState("");
  const [currentApprovalId, setCurrentApprovalId] = useState(null); // Track which approval the modal is for

  // Attachment states
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // New Modal States
  const [confirmDialogState, setConfirmDialogState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    variant: "warning",
    confirmText: "Confirm",
  });
  const [actionModalState, setActionModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    variant: "primary",
    inputType: "text",
    inputLabel: "",
  });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOptions, setReturnOptions] = useState([]);

  // Replenishment Modal State
  const [showReplenishmentModal, setShowReplenishmentModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [pendingApprovalData, setPendingApprovalData] = useState(null); // To store approval data while waiting for replenishment inputs

  const canEditReturned =
    requestData?.status === "returned" &&
    requestData?.requestor?.id === user?.id &&
    isViewing;

  // Helper function to check if signature can be edited
  // Can only edit if request is NOT: approved, declined, returned, or completed
  const canEditSignature = (isRequestor = false, approval = null) => {
    const requestorLockedStatuses = [
      "submitted",
      "department_approved",
      "it_manager_approved",
      "service_desk_processing",
      "completed",
      "department_declined",
      "it_manager_declined",
    ];

    // Statuses that prevent editing for approvers (final states)
    const approverLockedStatuses = [
      "completed",
      "department_declined",
      "it_manager_declined",
      "returned",
    ];

    if (isRequestor) {
      // Requestor can edit if: creating new request, draft status, or returned (and they're the requestor)
      // Cannot edit if: submitted, approved, declined, or completed
      const isLocked =
        requestData?.status &&
        requestorLockedStatuses.includes(requestData.status);
      if (isLocked && requestData?.status !== "returned") {
        return false;
      }
      return (
        isCreating ||
        requestData?.status === "draft" ||
        (requestData?.status === "returned" &&
          requestData?.requestor?.id === user?.id)
      );
    } else if (approval) {
      // Approver can edit if:
      // 1. Approval status is pending
      // 2. They're the current approver
      // 3. Request is NOT in a final state (not completed/declined/returned)
      // Note: Approvers CAN edit even if request is 'submitted' as long as their approval is pending
      const isPendingApproval = approval.status === "pending";
      const isCurrentApprover = approval.approver?.id === user?.id;
      const isLocked =
        requestData?.status &&
        approverLockedStatuses.includes(requestData.status);

      // Cannot edit if request is in a final locked state
      if (isLocked) {
        return false;
      }

      return isPendingApproval && isCurrentApprover;
    }
    return false;
  };

  // Helper to check if the request can be edited generally
  const canEdit = () => {
    if (user?.role === "super_administrator") return true;

    // IT Manager can edit during their approval phase
    if (
      user?.role === "it_manager" &&
      ["department_approved", "checked_endorsed"].includes(requestData?.status)
    ) {
      return true;
    }

    // Requestor can edit draft or returned
    if (requestData?.status === "draft" || requestData?.status === "returned") {
      return requestData?.requestor?.id === user?.id;
    }

    return false;
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toastError(`File ${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    if (id) {
      try {
        setUploadingFiles(true);
        const formData = new FormData();
        validFiles.forEach((file) => {
          formData.append("files", file);
        });

        const response = await requestsAPI.uploadAttachments(id, formData);
        setAttachments(response.data.attachments);
        toastSuccess("Files uploaded successfully");
      } catch (error) {
        console.error("Error uploading files:", error);
        toastError(error.response?.data?.message || "Failed to upload files");
      } finally {
        setUploadingFiles(false);
        e.target.value = null;
      }
    } else {
      setPendingFiles((prev) => [...prev, ...validFiles]);
      e.target.value = null;
    }
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (index) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    try {
      const response = await requestsAPI.deleteAttachment(id, index);
      setAttachments(response.data.attachments);
      toastSuccess("Attachment deleted successfully");
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toastError("Failed to delete attachment");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleApprovePR = async () => {
    try {
      if (attachments.length === 0) {
        toastWarning("Please upload PR/Attachment before approving.");
        return;
      }

      setLoading(true);
      await requestsAPI.approvePR(id);
      toastSuccess("PR Approved successfully");

      const response = await requestsAPI.getById(id);
      setRequestData(response.data.request);
    } catch (error) {
      console.error("Error approving PR:", error);
      toastError(error.response?.data?.message || "Failed to approve PR");
    } finally {
      setLoading(false);
    }
  };

  const getInputProps = (baseProps = {}) => {
    if (isViewing) {
      return {
        ...baseProps,
        disabled: baseProps.hasOwnProperty("disabled")
          ? baseProps.disabled
          : true,
        className: `${baseProps.className || ""} bg-gray-50`.trim(),
      };
    }
    return baseProps;
  };

  // Helper function to get requestor's full name
  const getRequestorName = () => {
    // Use requestData requestor if available (when viewing/editing)
    if (requestData?.requestor?.fullName) {
      return requestData.requestor.fullName;
    }
    if (requestData?.requestor?.firstName && requestData?.requestor?.lastName) {
      return `${requestData.requestor.firstName} ${requestData.requestor.lastName}`.trim();
    }
    // Fallback to current user (when creating new request)
    if (user?.fullName) return user.fullName;
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user?.firstName) return user.firstName;
    if (user?.lastName) return user.lastName;
    if (user?.username) return user.username;
    return "";
  };

  useEffect(() => {
    if (isCreating && user?.role !== "requestor") {
      toastWarning(
        "Only users with the requestor role can create equipment requests",
      );
      navigate("/dashboard");
      return;
    }
    loadData();
    if (isEditing || isViewing) {
      loadRequest();
    }
  }, [id]);

  const loadData = async () => {
    // Load Departments
    try {
      const response = await departmentsAPI.getAll({ active: "true" });
      setDepartments(response.data.departments);
    } catch (error) {
      console.error("Error loading departments:", error);
      // Don't show toast error here to avoid spamming if it's just a permission issue
    }

    // Load Categories (Critical for Stock Display)
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }

    // Load Purposes
    try {
      const response = await settingsAPI.getGeneralPurposes();
      setGeneralPurposes(response.data);
    } catch (error) {
      console.error("Error loading purposes:", error);
    }
  };

  const loadRequest = async () => {
    try {
      setLoading(true);
      const response = await requestsAPI.getById(id);
      const request = response.data.request;
      setRequestData(request);
      if (request.attachments) {
        setAttachments(request.attachments);
      }

      // Debug: Log permissions to check why button might not appear
      console.log("Request status:", request.status);
      console.log("Permissions:", request.permissions);
      console.log("User role:", user?.role);
      console.log("Requestor:", request.requestor);
      console.log("User ID:", user?.id);
      console.log("Requestor ID:", request.requestor?.id);
      console.log("Is viewing:", isViewing);

      if (isEditing && !["draft", "returned"].includes(request.status)) {
        navigate("/dashboard");
        return;
      }

      setFormData({
        requestNumber: request.requestNumber,
        status: request.status,
        userName: request.userName || "",
        userPosition: request.userPosition || "",
        departmentId: request.department?.id,
        priority: request.priority,
        comments: request.comments || "",
        requestorSignature: request.requestorSignature || "",
        submittedAt: request.submittedAt,
        createdAt: request.createdAt,
        items: request.items.map((item) => ({
          id: item.id,
          category: item.category,
          // itemDescription: item.itemDescription, // Removed
          quantity: item.quantity,
          inventoryNumber: item.inventoryNumber || "",
          proposedSpecs: item.proposedSpecs || "",
          purpose: item.purpose || "",
          estimatedCost: item.estimatedCost || "",
          vendorInfo: item.vendorInfo || "",
          isReplacement: item.isReplacement,
          replacedItemInfo: item.replacedItemInfo || "",
          urgencyReason: item.urgencyReason || "",
          priority: item.priority || "medium",
          dateRequired: item.dateRequired || "",
          comments: item.comments || "",
          itRemarks: item.itRemarks || "",
          approvalStatus: item.approvalStatus || "pending",
          endorserStatus: item.endorserStatus || "pending",
          endorserRemarks: item.endorserRemarks || "",
          originalQuantity:
            item.original_quantity !== null &&
              item.original_quantity !== undefined
              ? item.original_quantity
              : item.quantity,
        })),
      });
    } catch (error) {
      console.error("Error loading request:", error);
      if (!isViewing) {
        navigate("/dashboard");
      } else {
        toastError(error.response?.data?.message || "Failed to load request");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  // Helper to format inventory string
  const getInventoryString = (categoryName, categoriesList) => {
    const selectedCategory = categoriesList.find(
      (c) => c.name === categoryName,
    );
    if (!selectedCategory) return "N/A";
    if (!selectedCategory.track_stock) return "N/A";

    const qty = selectedCategory.quantity;
    if (selectedCategory.stock_updated_at) {
      const date = new Date(selectedCategory.stock_updated_at);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `(${mm}-${dd}) ${qty}`;
    }
    return `Stock: ${qty}`;
  };

  // Update items when categories load (initial population for new requests)
  useEffect(() => {
    if (categories.length > 0 && isCreating) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          // If inventoryNumber is empty or just generic default, update it
          if (
            !item.inventoryNumber ||
            item.inventoryNumber === "" ||
            item.inventoryNumber === "Stock: 0"
          ) {
            // Check if item has a category
            if (item.category) {
              return {
                ...item,
                inventoryNumber: getInventoryString(item.category, categories),
              };
            }
          }
          return item;
        }),
      }));
    }
  }, [categories]);

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;

        const updatedItem = { ...item, [field]: value };

        // Auto-update INV (Stock) and Copy Category to Description when category changes
        if (field === "category") {
          updatedItem.inventoryNumber = getInventoryString(value, categories);
        }

        return updatedItem;
      }),
    }));
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          category: categories.length > 0 ? categories[0].name : "",
          itemDescription: "",
          quantity: 1,
          inventoryNumber:
            categories.length > 0
              ? getInventoryString(categories[0].name, categories)
              : "",
          proposedSpecs: "",
          purpose: "",
          estimatedCost: "",
          vendorInfo: "",
          isReplacement: false,
          replacedItemInfo: "",
          urgencyReason: "",
          priority: "medium",
          dateRequired: calculateTenWorkingDays(),
          comments: "",
          itRemarks: "",
          approvalStatus: "pending",
          endorserStatus: "pending",
          endorserRemarks: "",
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.userName.trim()) {
      newErrors.userName = "User name is required";
    }
    if (!formData.departmentId) {
      newErrors.departmentId = "Department is required";
    }
    formData.items.forEach((item, index) => {
      if (!item.category) {
        newErrors[`item_${index}_category`] = "Category is required";
      }
      if (!item.purpose || !item.purpose.trim()) {
        newErrors[`item_${index}_purpose`] = "Reason/Purpose is required";
      }
      if (item.quantity < 1) {
        newErrors[`item_${index}_quantity`] = "Quantity must be at least 1";
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
        toastSuccess("Request updated successfully");
      } else {
        const response = await requestsAPI.create(formData);
        toastSuccess("Request created successfully");
        navigate(`/requests/${response.data.request.id}`);
        return;
      }
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving request:", error);
      toastError(error.response?.data?.message || "Failed to save request");
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
      toastSuccess("Request submitted successfully");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error submitting request:", error);
      toastError(error.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    // Validate items for IT Manager
    if (
      user.role === "it_manager" &&
      ["department_approved", "checked_endorsed"].includes(requestData?.status)
    ) {
      const pendingItems = formData.items.filter(
        (item) => item.approvalStatus === "pending",
      );
      if (pendingItems.length > 0) {
        toastWarning(
          `Please approve or reject all ${formData.items.length} items.`,
        );
        return;
      }
    }

    // Validate items for Endorser:
    // Every item must be marked as "in_stock" or "needs_pr" before approving
    if (
      user.role === "endorser" &&
      ["department_approved", "checked_endorsed"].includes(requestData?.status)
    ) {
      const unmarkedItems = formData.items.filter(
        (item) =>
          item.endorserStatus !== "in_stock" &&
          item.endorserStatus !== "needs_pr",
      );
      if (unmarkedItems.length > 0) {
        toastWarning(
          `Please mark all ${formData.items.length} item${formData.items.length > 1 ? "s" : ""} as either "Item Has Stock" or "Needs PR" before approving.`,
        );
        return;
      }
    }


    // Get signature from the specific approval if we have currentApprovalId, otherwise use approvalSignature
    let signatureToUse = approvalSignature;
    if (currentApprovalId && requestData?.approvals) {
      const approval = requestData.approvals.find(
        (a) => a.id === currentApprovalId,
      );
      if (approval?.signature) {
        signatureToUse = approval.signature;
      }
    }

    // Check if signature is provided
    if (!signatureToUse || signatureToUse.trim() === "") {
      // We can handle missing signature warning here if needed, or rely on backend validation
      // For now, let's proceed to modal
    }

    setActionModalState({
      isOpen: true,
      title: "Approve Request",
      message: "Please provide approval remarks (optional):",
      inputLabel: "Remarks",
      inputType: "textarea",
      confirmText: "Approve",
      variant: "success",
      allowEmpty: true,
      onConfirm: async (approvalReason) => {
        setActionModalState((prev) => ({ ...prev, isOpen: false }));

        // Check for Low Stock if this is the final approval (Completing)
        const isCompleting =
          (user.role === "service_desk" ||
            user.role === "super_administrator") &&
          ["ready_to_deploy", "pr_approved"].includes(requestData.status);

        if (isCompleting) {
          const lowStockList = [];

          // Check each item against current category stock
          formData.items.forEach((item) => {
            if (item.approvalStatus === "rejected") return; // Skip rejected items

            const category = categories.find((c) => c.name === item.category);
            if (category && category.track_stock) {
              // Check if stock is sufficient
              if (category.quantity < item.quantity) {
                lowStockList.push({
                  id: item.id,
                  category: item.category,
                  requestedQty: item.quantity,
                  currentStock: category.quantity,
                });
              }
            }
          });

          if (lowStockList.length > 0) {
            // Trigger Replenishment Modal
            setLowStockItems(lowStockList);
            setPendingApprovalData({
              comments: approvalReason,
              signature: signatureToUse || null,
              items: formData.items,
            });
            setShowReplenishmentModal(true);
            return; // Stop here, wait for modal
          }
        }

        // Normal Approval Flow (No low stock or not completing)
        await submitApproval(approvalReason, signatureToUse, formData.items);
      },
    });
  };

  const submitApproval = async (
    comments,
    signature,
    items,
    replenishmentData = null,
  ) => {
    try {
      setLoading(true);

      const payload = {
        comments: comments,
        signature: signature || null,
        items: items,
      };

      if (replenishmentData) {
        payload.replenishments = replenishmentData;
      }

      // Pass items with statuses/remarks to approve endpoint
      await requestsAPI.approve(id, payload);
      toastSuccess("Request approved successfully!");
      setApprovalSignature(""); // Clear signature after approval
      setCurrentApprovalId(null); // Clear current approval ID
      // Reload request data to show updated status and permissions
      await loadRequest();
      // Reload categories to show updated stock
      loadData();
    } catch (error) {
      console.error("Error approving request:", error);
      toastError(error.response?.data?.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  };

  const handleReplenishmentConfirm = async (replenishmentData) => {
    console.log("📦 Replenishment Confirming:", replenishmentData);
    setShowReplenishmentModal(false);

    if (pendingApprovalData) {
      console.log("🚀 Submitting Approval with Replenishment:", {
        ...pendingApprovalData,
        replenishments: replenishmentData,
      });
      await submitApproval(
        pendingApprovalData.comments,
        pendingApprovalData.signature,
        pendingApprovalData.items,
        replenishmentData,
      );
      setPendingApprovalData(null);
    }
  };

  const handleDecline = async () => {
    // Get signature from the specific approval if we have currentApprovalId, otherwise use approvalSignature
    let signatureToUse = approvalSignature;
    if (currentApprovalId && requestData?.approvals) {
      const approval = requestData.approvals.find(
        (a) => a.id === currentApprovalId,
      );
      if (approval?.signature) {
        signatureToUse = approval.signature;
      }
    }

    setActionModalState({
      isOpen: true,
      title: "Decline Request",
      message: "Please provide reason for declining:",
      inputLabel: "Reason",
      inputType: "textarea",
      confirmText: "Decline Request",
      variant: "danger",
      onConfirm: async (declineReason) => {
        if (!declineReason) {
          toastWarning("Decline reason is required");
          return;
        }

        setActionModalState((prev) => ({ ...prev, isOpen: false }));

        try {
          setLoading(true);
          await requestsAPI.decline(id, {
            comments: declineReason,
            signature: signatureToUse || null,
          });
          toastSuccess("Request declined");
          setApprovalSignature(""); // Clear signature after declining
          setCurrentApprovalId(null); // Clear current approval ID
          navigate("/dashboard");
        } catch (error) {
          console.error("Error declining request:", error);
          toastError(
            error.response?.data?.message || "Failed to decline request",
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleDelete = async () => {
    setConfirmDialogState({
      isOpen: true,
      title: "Delete Draft?",
      message:
        "Are you sure you want to delete this draft request? This action cannot be undone.",
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
        try {
          setLoading(true);
          await requestsAPI.delete(id);
          toastSuccess("Draft request deleted successfully");
          navigate("/dashboard");
        } catch (error) {
          console.error("Error deleting request:", error);
          toastError(
            error.response?.data?.message || "Failed to delete request",
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleReturn = async () => {
    // Get signature from the specific approval if we have currentApprovalId, otherwise use approvalSignature
    let signatureToUse = approvalSignature;
    if (currentApprovalId && requestData?.approvals) {
      const approval = requestData.approvals.find(
        (a) => a.id === currentApprovalId,
      );
      if (approval?.signature) {
        signatureToUse = approval.signature;
      }
    }

    // Determine return options
    const options = [{ label: "Return to Requestor", value: "requestor" }];
    if (
      user.role === "it_manager" ||
      user.role === "super_administrator" ||
      user.role === "service_desk"
    ) {
      // Based on previous logic, they could return to Dept Approver
      options.push({
        label: "Return to Department Approver",
        value: "department_approver",
      });
    }
    setReturnOptions(options);
    setShowReturnModal(true);
  };

  const onReturnConfirm = async (returnReason, returnTo) => {
    setShowReturnModal(false);

    // Get signature again (scope issue? no, component scope)
    let signatureToUse = approvalSignature;
    if (currentApprovalId && requestData?.approvals) {
      const approval = requestData.approvals.find(
        (a) => a.id === currentApprovalId,
      );
      if (approval?.signature) {
        signatureToUse = approval.signature;
      }
    }

    try {
      setLoading(true);
      await requestsAPI.return(id, {
        returnReason,
        returnTo,
        signature: signatureToUse || null,
      });
      toastSuccess(
        `Request returned to ${returnTo === "department_approver" ? "Department Approver" : "Requestor"}`,
      );
      setApprovalSignature(""); // Clear signature after returning
      setCurrentApprovalId(null); // Clear current approval ID
      navigate("/dashboard");
    } catch (error) {
      console.error("Error returning request:", error);
      toastError(error.response?.data?.message || "Failed to return request");
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 transition-colors duration-200">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-4 px-4 no-print">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>
      </div>

      {/* PDF-like Form Container */}
      <div
        className="max-w-4xl mx-auto bg-white shadow-2xl transition-colors duration-200 print:!shadow-none print:!w-full print:!max-w-none print:!m-0 print:!border-0"
        style={{ boxShadow: "0 0 30px rgba(0,0,0,0.15)", colorScheme: "light" }}
      >
        <div className="p-8 md:p-12 print:!p-0" style={{ minHeight: "auto" }}>
          {/* Header Section */}
          <div className="border-b-2 border-gray-800 pb-4 mb-2 print:mb-2 print:pb-2">
            <div className="flex items-center justify-between mb-4 print:mb-2">
              <div className="flex items-center space-x-3">
                <img
                  src={STC_LOGO}
                  alt="STC Logo"
                  className="h-16 w-auto print:h-12"
                />
                <div>
                  <div className="text-xl font-bold text-gray-900 print:text-lg">
                    STYROTECH CORPORATION
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Form No.</div>
                <div className="text-sm font-semibold text-gray-700">
                  ITD-FM-001 rev.03
                </div>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide print:text-xl">
                IT Equipment Request Form
              </h1>
            </div>
          </div>

          {/* Decline/Return Notification */}
          {requestData &&
            (formData.status === "department_declined" ||
              formData.status === "it_manager_declined" ||
              formData.status === "returned") && (
              <div
                className={`mb-6 p-4 border-2 ${formData.status === "returned"
                  ? "bg-yellow-50 border-yellow-400"
                  : "bg-red-50 border-red-400"
                  }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {formData.status === "returned" ? (
                      <RotateCcw className="h-6 w-6 text-yellow-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <h3
                      className={`text-lg font-semibold ${formData.status === "returned"
                        ? "text-yellow-800"
                        : "text-red-800"
                        }`}
                    >
                      {formData.status === "returned"
                        ? "Request Returned for Revision"
                        : "Request Declined"}
                    </h3>
                    {requestData.approvals?.map((approval, index) => {
                      if (
                        approval.status === "declined" ||
                        approval.status === "returned"
                      ) {
                        return (
                          <div key={index} className="mt-2">
                            <p className="text-sm font-medium text-gray-700">
                              {approval.approver?.fullName} (
                              {approval.approver?.role?.replace("_", " ")})
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              <strong>Reason:</strong>{" "}
                              {approval.returnReason ||
                                approval.comments ||
                                "No reason provided"}
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
          <form className="space-y-2">
            {/* Section 1: Requestor Information */}
            <div className="border border-gray-400 p-4 mb-2 print:mb-3 print:p-2 print:break-inside-avoid">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1">
                <h2 className="text-[11px] font-bold text-gray-900 uppercase">
                  Requestor Information
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:!grid-cols-12 print:!gap-2">
                <div className="print:!col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 text-gray-900 mb-0 print:text-[10px] print:mb-0">
                    Name of Requestor <span className="text-red-600">*</span>
                  </label>
                  <div className="border-b-2 border-gray-400 print:!border-b-0">
                    <input
                      type="text"
                      value={getRequestorName()}
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 disabled:opacity-100 disabled:text-gray-900 print:text-xs"
                    />
                  </div>
                </div>
                <div className="print:!col-span-5">
                  <label className="block text-xs font-semibold text-gray-700 text-gray-900 mb-0 print:text-[10px] print:mb-0">
                    Position
                  </label>
                  <div className="border-b-2 border-gray-400 print:!border-b-0">
                    <input
                      type="text"
                      value={user?.title || user?.position || ""}
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 disabled:opacity-100 disabled:text-gray-900 print:text-xs"
                    />
                  </div>
                </div>
                <div className="print:!col-span-4">
                  <label className="block text-xs font-semibold text-gray-700 text-gray-900 mb-0 print:text-[10px] print:mb-0">
                    Department <span className="text-red-600">*</span>
                  </label>
                  <div className="border-b-2 border-gray-400 print:!border-b-0">
                    <input
                      type="text"
                      value={
                        user?.department?.name || user?.Department?.name || ""
                      }
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 disabled:opacity-100 disabled:text-gray-900 print:text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: User Information */}
            <div className="border border-gray-400 p-4 mb-2 print:mb-3 print:p-2 print:break-inside-avoid">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1">
                <h2 className="text-[11px] font-bold text-gray-900 uppercase">
                  User Information{" "}
                  <span
                    className="font-normal inline-block"
                    style={{ transform: "skewX(-10deg)" }}
                  >
                    (ITEM REQUESTED FOR)
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:!grid-cols-12 print:!gap-2">
                <div className="print:!col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-0 print:text-[10px] print:mb-0">
                    User's Name <span className="text-red-600">*</span>
                  </label>
                  <div
                    className={`border-b-2 print:!border-b-0 ${errors.userName ? "border-red-500" : "border-gray-400"}`}
                  >
                    <input
                      type="text"
                      value={formData.userName}
                      {...getInputProps({
                        onChange: (e) =>
                          handleInputChange("userName", e.target.value),
                        className:
                          "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 placeholder-gray-500 print:text-xs print:placeholder-transparent",
                        placeholder:
                          "Name of person who will use the equipment",
                      })}
                    />
                  </div>
                  {errors.userName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.userName}
                    </p>
                  )}
                </div>
                <div className="print:!col-span-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-0 print:text-[10px] print:mb-0">
                    Position
                  </label>
                  <div className="border-b-2 border-gray-400 print:!border-b-0">
                    <input
                      type="text"
                      value={formData.userPosition}
                      {...getInputProps({
                        onChange: (e) =>
                          handleInputChange("userPosition", e.target.value),
                        className:
                          "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 placeholder-gray-500 print:text-xs print:placeholder-transparent",
                        placeholder: "Position of the user",
                      })}
                    />
                  </div>
                </div>
                <div className="print:!col-span-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-0 print:text-[10px] print:mb-0">
                    Date Requested
                  </label>
                  <div className="border-b-2 border-gray-400 print:!border-b-0">
                    <input
                      type="date"
                      value={(() => {
                        const dateToUse =
                          formData.submittedAt ||
                          formData.createdAt ||
                          new Date();
                        return new Date(dateToUse).toISOString().split("T")[0];
                      })()}
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 placeholder-gray-500 print:text-xs print:placeholder-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Equipment Required */}
            <div className="border border-gray-400 p-4 mb-2 print:mb-3 print:p-2 print:border-none">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1">
                <h2 className="text-[11px] font-bold text-gray-900 uppercase">
                  ITEM/S REQUESTED
                </h2>
              </div>

              {/* Equipment Table */}
              {/* Equipment Cards */}
              <div className="space-y-4 mb-2">
                {formData.items.map((item, index) =>
                  item.approvalStatus === "rejected" &&
                    ![
                      "requestor",
                      "it_manager",
                      "department_approver",
                      "endorser",
                      "service_desk",
                    ].includes(user?.role) ? null : (
                    <div
                      key={index}
                      className={`border border-gray-400 px-2 pt-2 pb-1 print:p-2 print:mb-4 print:break-inside-avoid bg-white relative ${formData.items.length === 3 && index === 2 ? "print:break-before-page" : ""}`}
                    >
                      {/* Remove Button (Top Right) */}
                      {!isViewing && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                          className="absolute top-2 right-2 text-red-600 hover:text-red-800 disabled:text-gray-400 no-print"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}

                      {/* Header: Item Number & Status Badges */}
                      <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-[11px] font-bold text-gray-900 uppercase">
                            Item #{index + 1}
                          </h3>

                          {/* Item Approval Status Badge */}
                          {item.approvalStatus !== "pending" && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.approvalStatus === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                                }`}
                            >
                              {item.approvalStatus}
                            </span>
                          )}

                          {/* Endorser Status Badge (Informational) */}
                          {item.endorserStatus &&
                            item.endorserStatus !== "pending" && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.endorserStatus === "in_stock"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                                  }`}
                              >
                                {item.endorserStatus === "needs_pr"
                                  ? "NEEDS PR"
                                  : "IN STOCK"}
                              </span>
                            )}
                        </div>

                        {/* IT Manager Item Actions - Approve/Reject Items */}
                        {user?.role === "it_manager" &&
                          ["department_approved", "checked_endorsed"].includes(
                            requestData?.status,
                          ) && (
                            <div className="flex space-x-2 no-print">
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(
                                    index,
                                    "approvalStatus",
                                    "approved",
                                  )
                                }
                                className={`p-1 rounded-full transition-colors ${item.approvalStatus === "approved"
                                  ? "bg-green-600 text-white shadow-md"
                                  : "bg-white text-gray-400 hover:text-green-600 hover:bg-green-50"
                                  }`}
                                title="Approve Item"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(
                                    index,
                                    "approvalStatus",
                                    "rejected",
                                  )
                                }
                                className={`p-1 rounded-full transition-colors ${item.approvalStatus === "rejected"
                                  ? "bg-red-600 text-white shadow-md"
                                  : "bg-white text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  }`}
                                title="Reject Item"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          )}

                        {/* Endorser Actions - Mark for PR (Informational only) */}
                        {user?.role === "endorser" &&
                          ["department_approved", "checked_endorsed"].includes(
                            requestData?.status,
                          ) && (
                            <div className="flex space-x-2 no-print">
                              {(() => {
                                const itemCategory = categories.find(
                                  (c) => c.name === item.category,
                                );
                                const isOutOfStock =
                                  itemCategory &&
                                  itemCategory.track_stock &&
                                  itemCategory.quantity <= 0;
                                // Item has stock = category tracks stock AND quantity > 0
                                const hasStock =
                                  itemCategory &&
                                  itemCategory.track_stock &&
                                  itemCategory.quantity > 0;

                                return (
                                  <>
                                    {/* In Stock button — disabled when out of stock */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleItemChange(
                                          index,
                                          "endorserStatus",
                                          "in_stock",
                                        )
                                      }
                                      disabled={isOutOfStock}
                                      className={`p-1 rounded-full transition-colors ${item.endorserStatus === "in_stock"
                                        ? "bg-blue-600 text-white shadow-md"
                                        : isOutOfStock
                                          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                          : "bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                        }`}
                                      title={
                                        isOutOfStock
                                          ? "Out of Stock"
                                          : "Mark as In Stock"
                                      }
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>

                                    {/* Needs PR button — disabled when item has stock */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleItemChange(
                                          index,
                                          "endorserStatus",
                                          "needs_pr",
                                        )
                                      }
                                      disabled={hasStock}
                                      className={`p-1 rounded-full transition-colors ${item.endorserStatus === "needs_pr"
                                        ? "bg-orange-600 text-white shadow-md"
                                        : hasStock
                                          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                          : "bg-white text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                                        }`}
                                      title={
                                        hasStock
                                          ? "Item has stock — PR not needed"
                                          : "Mark as Needs PR"
                                      }
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-6 print:gap-4">
                        {/* Category */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Particular <span className="text-red-600">*</span>
                          </label>
                          <div className="w-48 border-b-2 border-gray-400 pb-1">
                            <select
                              value={item.category}
                              {...getInputProps({
                                onChange: (e) =>
                                  handleItemChange(
                                    index,
                                    "category",
                                    e.target.value,
                                  ),
                                className:
                                  "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs text-center",
                              })}
                            >
                              <option value="">Select Particular</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {errors[`item_${index}_category`] && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors[`item_${index}_category`]}
                            </p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="mr-8">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Qty <span className="text-red-600">*</span>
                          </label>
                          <div className="w-12 border-b-2 border-gray-400 pb-1">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              {...getInputProps({
                                onChange: (e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    e.target.value,
                                  ),
                                className: `w-full bg-transparent border-0 focus:outline-none text-sm text-center ${item.originalQuantity &&
                                  item.originalQuantity !==
                                  parseInt(item.quantity || 0)
                                  ? "text-red-600 font-bold"
                                  : "text-gray-900"
                                  }`,
                                placeholder: "1",
                                readOnly:
                                  !isCreating &&
                                  !isEditing &&
                                  !(
                                    user?.role === "it_manager" &&
                                    [
                                      "department_approved",
                                      "checked_endorsed",
                                    ].includes(requestData?.status)
                                  ),
                                disabled:
                                  !isCreating &&
                                  !isEditing &&
                                  !(
                                    user?.role === "it_manager" &&
                                    [
                                      "department_approved",
                                      "checked_endorsed",
                                    ].includes(requestData?.status)
                                  ),
                                title: item.originalQuantity
                                  ? `Original Qty: ${item.originalQuantity}`
                                  : "",
                              })}
                            />
                          </div>
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors[`item_${index}_quantity`]}
                            </p>
                          )}
                        </div>

                        {/* Stock / INV */}
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Inv (Stock)
                          </label>
                          <div className="w-20 border-b-2 border-gray-400 pb-1 h-[26px] flex items-center justify-center">
                            {(() => {
                              // Try to get live stock info first
                              let displayVal = item.inventoryNumber;
                              if (categories.length > 0 && item.category) {
                                const liveString = getInventoryString(
                                  item.category,
                                  categories,
                                );
                                if (liveString !== "N/A") {
                                  displayVal = liveString;
                                }
                              }

                              if (!displayVal) return null;

                              // Check format (MM-DD) QTY
                              const match = displayVal.match(
                                /^\((\d{2}-\d{2})\)\s*(\d+)$/,
                              );
                              if (match) {
                                return (
                                  <span className="text-sm text-gray-900">
                                    <i>{`(${match[1]})`}</i> : {match[2]}
                                  </span>
                                );
                              }
                              return (
                                <span className="text-sm text-gray-900">
                                  {displayVal}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Priority (Moved to Item) */}
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Priority
                          </label>
                          <div className="w-fit min-w-[60px] border-b-2 border-gray-400 pb-1">
                            <select
                              value={item.priority || "medium"}
                              {...getInputProps({
                                onChange: (e) =>
                                  handleItemChange(
                                    index,
                                    "priority",
                                    e.target.value,
                                  ),
                                className:
                                  "bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs",
                              })}
                            >
                              {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Date Required (Moved to Item) */}
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Date Required
                          </label>
                          <div className="w-fit min-w-[60px] border-b-2 border-gray-400 pb-1">
                            <input
                              type="date"
                              value={item.dateRequired || ""}
                              {...getInputProps({
                                onChange: (e) =>
                                  handleItemChange(
                                    index,
                                    "dateRequired",
                                    e.target.value,
                                  ),
                                className:
                                  "bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs",
                              })}
                            />
                          </div>
                        </div>

                        {/* Proposed Specs */}
                        {/* Proposed Specs */}
                        {/* Proposed Specs */}
                        <div className="w-full">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Proposed Specs
                          </label>
                          <div className="border-b-2 border-gray-400">
                            <textarea
                              value={item.proposedSpecs}
                              {...getInputProps({
                                onChange: (e) =>
                                  handleItemChange(
                                    index,
                                    "proposedSpecs",
                                    e.target.value,
                                  ),
                                rows: 1,
                                placeholder: "Technical specifications...",
                                className:
                                  "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs print:resize-none py-0",
                              })}
                            />
                          </div>
                        </div>

                        {/* Purpose */}
                        <div className="w-full">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Purpose / Reason{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <div className="border-b-2 border-gray-400 pb-1">
                            {(() => {
                              const itemCategory = categories.find(
                                (c) => c.name === item.category,
                              );
                              const availablePurposes = itemCategory
                                ? [
                                  ...new Set([
                                    ...(itemCategory.purposes || []),
                                    ...generalPurposes,
                                  ]),
                                ]
                                : generalPurposes;

                              // Determine if we should show input:
                              // 1. No available purposes to select from
                              // 2. Explicitly in custom mode (user selected "Others")
                              // 3. Current value exists but is not in the list (legacy or custom value)
                              const showInput =
                                availablePurposes.length === 0 ||
                                item.isCustomPurpose ||
                                (item.purpose &&
                                  !availablePurposes.includes(item.purpose));

                              if (!showInput) {
                                return (
                                  <select
                                    value={item.purpose}
                                    onChange={(e) => {
                                      if (e.target.value === "OTHER_PURPOSE") {
                                        handleItemChange(
                                          index,
                                          "isCustomPurpose",
                                          true,
                                        );
                                        handleItemChange(index, "purpose", "");
                                      } else {
                                        handleItemChange(
                                          index,
                                          "purpose",
                                          e.target.value,
                                        );
                                      }
                                    }}
                                    disabled={isViewing}
                                    className={`w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs py-0 ${isViewing ? "bg-gray-50" : ""}`}
                                  >
                                    <option value="">Select Purpose...</option>
                                    {availablePurposes.map((p, i) => (
                                      <option key={i} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                    <option value="OTHER_PURPOSE">
                                      Others (Specify)
                                    </option>
                                  </select>
                                );
                              }

                              return (
                                <div className="flex items-center justify-between">
                                  <textarea
                                    value={item.purpose}
                                    {...getInputProps({
                                      onChange: (e) =>
                                        handleItemChange(
                                          index,
                                          "purpose",
                                          e.target.value,
                                        ),
                                      rows: 1,
                                      placeholder:
                                        availablePurposes.length > 0
                                          ? "Specify other purpose..."
                                          : "Intended use / Reason for request...",
                                      className:
                                        "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs print:resize-none py-0",
                                    })}
                                  />
                                  {availablePurposes.length > 0 &&
                                    !isViewing && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleItemChange(
                                            index,
                                            "isCustomPurpose",
                                            false,
                                          );
                                          handleItemChange(
                                            index,
                                            "purpose",
                                            "",
                                          );
                                        }}
                                        className="ml-2 text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap no-print"
                                      >
                                        Back to options
                                      </button>
                                    )}
                                </div>
                              );
                            })()}
                          </div>
                          {errors[`item_${index}_purpose`] && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors[`item_${index}_purpose`]}
                            </p>
                          )}
                        </div>

                        {/* Priority (Moved to Item) */}

                        {/* Additional Comments (Moved to Item) */}
                        {/* Additional Comments (Moved to Item) */}
                        {/* Additional Comments & Remarks */}
                        <div className="w-full grid grid-cols-2 gap-4">
                          {/* Additional Comments */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Additional comments
                            </label>
                            <div className="border-b-2 border-gray-400">
                              <textarea
                                value={item.comments || ""}
                                {...getInputProps({
                                  onChange: (e) =>
                                    handleItemChange(
                                      index,
                                      "comments",
                                      e.target.value,
                                    ),
                                  rows: 1,
                                  placeholder:
                                    "Any specific notes for this item...",
                                  className:
                                    "w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs print:resize-none py-0",
                                })}
                              />
                            </div>
                          </div>

                          {/* IT Manager Remarks */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Remarks (IT Manager)
                            </label>
                            <div className="border-b-2 border-gray-400">
                              <textarea
                                value={item.itRemarks || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "itRemarks",
                                    e.target.value,
                                  )
                                }
                                rows={1}
                                placeholder={
                                  user?.role === "it_manager" ||
                                    user?.role === "super_administrator"
                                    ? "IT Manager remarks..."
                                    : ""
                                }
                                disabled={
                                  !(
                                    user?.role === "it_manager" ||
                                    user?.role === "super_administrator"
                                  ) ||
                                  (!isCreating && !canEdit())
                                }
                                className={`w-full bg-transparent border-0 focus:outline-none text-sm text-gray-900 print:text-xs print:resize-none py-0 ${user?.role !== "it_manager" && user?.role !== "super_administrator" ? "bg-gray-50" : ""}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {!isViewing && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-2 text-sm no-print"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another Item
                </button>
              )}
            </div>

            {/* Section 5: Signatures */}
            <div className="border border-gray-400 p-2 mb-2 print:mb-3 print:p-2 print:break-inside-avoid">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400 print:-m-2 print:mb-2 print:px-2 print:py-1">
                <h2 className="text-[11px] font-bold text-gray-900 uppercase">
                  Signatures
                </h2>
              </div>

              <div className="space-y-4 print:space-y-2">
                {/* Signatures - Requestor and Approvers in one row */}
                <div className="grid grid-cols-1 md:grid-cols-3 print:!grid-cols-5 gap-6 print:!gap-2">
                  {/* Requestor Signature */}
                  <div className="p-3">
                    {/* Show signature button if user is the requestor and can edit */}
                    {(!isViewing ||
                      (isViewing && canEditReturned) ||
                      (isViewing &&
                        requestData?.status === "draft" &&
                        requestData?.requestor?.id === user?.id)) &&
                      (user?.role === "requestor" ||
                        requestData?.requestor?.id === user?.id) &&
                      !(
                        formData.requestorSignature ||
                        requestData?.requestorSignature
                      ) && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setTempRequestorSignature(
                                formData.requestorSignature ||
                                requestData?.requestorSignature ||
                                "",
                              );
                              setShowRequestorSignatureModal(true);
                            }}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                          >
                            <PenTool className="h-4 w-4 mr-2" />
                            Add Signature
                          </button>
                        </div>
                      )}

                    {/* Display signature above name */}
                    <div className="pb-0">
                      {/* Department Name at the very top */}
                      {/* Department Name Header - Fixed height for alignment */}
                      <div className="mb-2 h-4">
                        {(requestData?.department?.name ||
                          (isCreating && user?.department?.name)) && (
                            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider truncate">
                              {requestData?.department?.name ||
                                (isCreating ? user?.department?.name : "")}
                            </p>
                          )}
                      </div>

                      {/* Signature above the name - positioned lower left, overlapping slightly */}
                      {formData.requestorSignature ||
                        requestData?.requestorSignature ? (
                        <div
                          className="mb-0"
                          style={{ marginBottom: "-8px", textAlign: "left" }}
                        >
                          <img
                            src={
                              formData.requestorSignature ||
                              requestData?.requestorSignature
                            }
                            alt={`${getRequestorName()} Signature`}
                            className="h-auto"
                            style={{
                              height: "40px",
                              maxWidth: "300px",
                              objectFit: "contain",
                              display: "inline-block",
                            }}
                          />
                        </div>
                      ) : (
                        isViewing &&
                        !canEditReturned &&
                        requestData?.status !== "draft" && (
                          <div className="mb-1">
                            <p className="text-xs text-gray-400 italic">
                              (No signature provided)
                            </p>
                          </div>
                        )
                      )}

                      {/* Name below signature */}
                      {canEditSignature(true) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTempRequestorSignature(
                              formData.requestorSignature ||
                              requestData?.requestorSignature ||
                              "",
                            );
                            setShowRequestorSignatureModal(true);
                          }}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors group relative"
                          title="Click to edit signature"
                        >
                          {getRequestorName()}
                          <span className="ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            (edit)
                          </span>
                        </button>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900">
                          {getRequestorName()}
                        </p>
                      )}
                      {(requestData?.requestor?.title ||
                        (isCreating && user?.title)) && (
                          <p className="text-xs text-gray-600 mt-1">
                            {requestData?.requestor?.title ||
                              (isCreating ? user?.title : "")}
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Approvers Signatures */}
                  {requestData?.approvals &&
                    [...requestData.approvals]
                      .sort((a, b) => {
                        const order = {
                          department_approval: 1,
                          endorser_approval: 2,
                          endorser: 2,
                          it_manager_approval: 3,
                          service_desk_processing: 4,
                        };
                        return (
                          (order[a.approval_type] || 99) -
                          (order[b.approval_type] || 99)
                        );
                      })
                      .map((approval, index, sortedArr) => {
                        // Only show signature button if:
                        // 1. Approval status is pending
                        // 2. User is the approver
                        // 3. User has permission to approve
                        // 4. Approval doesn't already have a signature
                        // 5. Request is not completed
                        const isPendingApproval = approval.status === "pending";
                        const isReturnedApproval = approval.status === "returned";
                        const isCurrentApprover =
                          approval.approver?.id === user?.id;
                        const requestNotCompleted =
                          requestData?.status !== "completed";
                        // Check if this approval has a signature (from backend or locally updated)
                        const hasSignature =
                          approval.signature &&
                          approval.signature.trim() !== "";
                        // canReApprove: the approver who previously returned can now re-act
                        // (request was resubmitted, status is back in an approvable state)
                        const canReApprove =
                          isReturnedApproval &&
                          isCurrentApprover &&
                          requestNotCompleted &&
                          (requestData?.permissions?.canApprove ||
                            requestData?.permissions?.canProcess);
                        const canSign =
                          (isPendingApproval || canReApprove) &&
                          isCurrentApprover &&
                          requestNotCompleted &&
                          (requestData?.permissions?.canApprove ||
                            requestData?.permissions?.canProcess) &&
                          !hasSignature;

                        // ── Visibility gates ──────────────────────────────────
                        // 1. Hide "returned" approvals UNLESS the current user is
                        //    the assigned approver who can re-act (request was resubmitted).
                        if (isReturnedApproval && !canReApprove && !hasSignature) return null;

                        // 2. Only allow pending-status slots to show if:
                        //    a) the current user IS that pending approver (canSign), OR
                        //    b) the approver has already added a signature (hasSignature)
                        //       — e.g. signed but not yet formally approved
                        //    All other pending slots are hidden entirely.
                        if (isPendingApproval && !canSign && !hasSignature) return null;
                        // ──────────────────────────────────────────────────────

                        const isServiceDesk =
                          approval.approval_type === "service_desk_processing";
                        const borderClass =
                          index === 0
                            ? "border-r-2 border-gray-300"
                            : isServiceDesk
                              ? "border-l-2 border-gray-300 pl-4"
                              : "";

                        return (
                          <div
                            key={approval.id}
                            className={`p-3 ${borderClass}`}
                          >
                            {/* Show signature button if current approver can sign */}
                            {canSign && (
                              <div className="mb-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Set the current approval ID and load existing signature if any
                                    setCurrentApprovalId(approval.id);
                                    setTempApprovalSignature(
                                      approval.signature ||
                                      approvalSignature ||
                                      "",
                                    );
                                    setShowApprovalSignatureModal(true);
                                  }}
                                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                                >
                                  <PenTool className="h-4 w-4 mr-2" />
                                  Add Signature
                                </button>
                              </div>
                            )}

                            {/* Display approver info */}
                            <div className="pb-3 min-h-[100px]">
                              {/* Department Name Header - Fixed height for alignment (for all approvers), text only for index 1 (Right Side Header) */}
                              <div className="mb-2 h-4">
                                {index === 1 &&
                                  approval.approver?.Department?.name && (
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider truncate">
                                      {approval.approver.Department.name}
                                    </p>
                                  )}
                              </div>

                              {/* Signature above the name - positioned lower left, overlapping slightly */}
                              {/* Check approval.signature (from backend or locally updated via requestData state) */}
                              {hasSignature ? (
                                <div
                                  className="mb-0"
                                  style={{
                                    marginBottom: "-8px",
                                    textAlign: "left",
                                  }}
                                >
                                  <img
                                    src={approval.signature}
                                    alt={`${approval.approver?.fullName || "Approver"} Signature`}
                                    className="h-auto"
                                    style={{
                                      height: "40px",
                                      maxWidth: "300px",
                                      objectFit: "contain",
                                      display: "inline-block",
                                    }}
                                  />
                                </div>
                              ) : (
                                !canSign && (
                                  <div className="mb-1">
                                    <p className="text-xs text-gray-400 italic">
                                      (No signature provided)
                                    </p>
                                  </div>
                                )
                              )}

                              {/* Name below signature - clickable to edit signature if allowed */}
                              <div className="text-left">
                                {canEditSignature(false, approval) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCurrentApprovalId(approval.id);
                                      setTempApprovalSignature(
                                        approval.signature ||
                                        approvalSignature ||
                                        "",
                                      );
                                      setShowApprovalSignatureModal(true);
                                    }}
                                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors group relative"
                                    title="Click to edit signature"
                                  >
                                    {approval.approver?.fullName ||
                                      "Pending Approver"}
                                    <span className="ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      (edit)
                                    </span>
                                  </button>
                                ) : (
                                  <p className="text-sm font-semibold text-gray-900">
                                    {approval.approver?.fullName ||
                                      "Pending Approver"}
                                  </p>
                                )}
                                {approval.approver?.title && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {approval.approver.title}
                                  </p>
                                )}

                                {/* Return Reason */}
                                {approval.return_reason && (
                                  <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 no-print">
                                    <span className="font-semibold">Return Reason: </span>
                                    {approval.return_reason}
                                  </div>
                                )}

                                {/* Decline/Approve Comments */}
                                {approval.comments && (
                                  <div className={`mt-2 px-2 py-1 rounded text-xs no-print ${approval.status === "declined"
                                    ? "bg-red-50 border border-red-200 text-red-800"
                                    : "bg-blue-50 border border-blue-200 text-blue-800"
                                    }`}>
                                    <span className="font-semibold">
                                      {approval.status === "declined" ? "Decline Reason: " : "Comments: "}
                                    </span>
                                    {approval.comments}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                  {/* Show signature input for current approver who can approve but isn't in approvals list yet */}
                  {isViewing &&
                    requestData?.status !== "completed" &&
                    (requestData?.permissions?.canApprove ||
                      requestData?.permissions?.canProcess) &&
                    (!requestData?.approvals ||
                      !requestData.approvals.some(
                        (a) => a.approver?.id === user?.id,
                      )) && (
                      <div className="p-3">
                        {!approvalSignature && (
                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentApprovalId(null); // No approval ID for pending approver
                                setTempApprovalSignature(
                                  approvalSignature || "",
                                );
                                setShowApprovalSignatureModal(true);
                              }}
                              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                            >
                              <PenTool className="h-4 w-4 mr-2" />
                              Add Signature
                            </button>
                          </div>
                        )}

                        <div className="pb-3 min-h-[100px]">
                          {/* Department Name Header - Fixed height for alignment (for pending approver) */}
                          <div className="mb-2 h-4">
                            {(user?.department?.name ||
                              user?.Department?.name) && (
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider truncate">
                                  {user?.department?.name ||
                                    user?.Department?.name}
                                </p>
                              )}
                          </div>
                          {/* Signature above the name - positioned lower left, overlapping slightly */}
                          {approvalSignature ? (
                            <div
                              className="mb-0"
                              style={{
                                marginBottom: "-8px",
                                textAlign: "left",
                              }}
                            >
                              <img
                                src={approvalSignature}
                                alt={`${user?.fullName || "Approver"} Signature`}
                                className="h-auto"
                                style={{
                                  height: "40px",
                                  maxWidth: "300px",
                                  objectFit: "contain",
                                  display: "inline-block",
                                }}
                              />
                            </div>
                          ) : (
                            <div className="mb-1">
                              <p className="text-xs text-gray-400 italic">
                                (No signature provided)
                              </p>
                            </div>
                          )}

                          {/* Name below signature */}
                          <div className="text-left">
                            {canEditSignature(false, {
                              status: "pending",
                              approver: { id: user?.id },
                            }) &&
                              requestData?.status !== "completed" &&
                              ![
                                "department_declined",
                                "it_manager_declined",
                              ].includes(requestData?.status) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentApprovalId(null);
                                  setTempApprovalSignature(
                                    approvalSignature || "",
                                  );
                                  setShowApprovalSignatureModal(true);
                                }}
                                className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                              >
                                {user?.fullName ||
                                  `${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {user?.fullName ||
                                  `${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
                              </p>
                            )}
                            {user?.title && (
                              <p className="text-xs text-gray-600 mt-1">
                                {user.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Attachments Section - Only visible to IT Manager, Endorser, and Service Desk */}
            {/* Condition: Not Service Desk IN In-Stock Workflow (it_manager_approved AND all available) */}
            {[
              "it_manager",
              "endorser",
              "service_desk",
              "super_administrator",
            ].includes(user?.role) &&
              !(
                user?.role === "service_desk" &&
                requestData?.status === "it_manager_approved" &&
                formData.items.every((i) => i.approvalStatus === "approved")
              ) &&
              !(
                user?.role === "service_desk" &&
                requestData?.status === "ready_to_deploy"
              ) && (
                <div className="border border-gray-400 p-4 mb-6 no-print">
                  <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                    <h2 className="text-sm font-bold text-gray-900 uppercase">
                      Attachments
                    </h2>
                  </div>

                  {/* Upload UI */}
                  {(!id ||
                    (id &&
                      ["draft", "returned"].includes(requestData?.status) &&
                      user?.id === requestData?.requestor?.id) ||
                    (id &&
                      ["service_desk", "super_administrator"].includes(
                        user?.role,
                      ))) && (
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Upload Files
                        </label>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center px-4 py-2 bg-gray-100 border border-gray-300 rounded cursor-pointer hover:bg-gray-200 text-sm text-gray-900">
                            <Paperclip className="h-4 w-4 mr-2" />
                            {uploadingFiles ? "Uploading..." : "Choose Files"}
                            <input
                              type="file"
                              multiple
                              onChange={handleFileUpload}
                              disabled={uploadingFiles || loading}
                              className="hidden"
                            />
                          </label>
                          <span className="text-xs text-gray-500">
                            Max 10MB per file
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Pending Files List */}
                  {pendingFiles.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">
                        Pending Uploads
                      </h3>
                      <div className="space-y-2">
                        {pendingFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded"
                          >
                            <span className="text-sm truncate">
                              {file.name} ({formatFileSize(file.size)})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePendingFile(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uploaded Files List */}
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((att, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <Paperclip className="h-4 w-4 text-gray-500" />
                            <a
                              href={`${getBaseUrl()}${att.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate"
                            >
                              {att.originalName}
                            </a>
                            <span className="text-xs text-gray-500">
                              ({formatFileSize(att.size)})
                            </span>
                          </div>
                          {((!id && user?.id === requestData?.requestor?.id) ||
                            (id &&
                              ["draft", "returned"].includes(
                                requestData?.status,
                              ) &&
                              user?.id === requestData?.requestor?.id) ||
                            (id &&
                              ["service_desk", "super_administrator"].includes(
                                user?.role,
                              ))) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(index)}
                                className="text-red-600 hover:text-red-800 ml-2"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No attachments.
                    </p>
                  )}
                </div>
              )}

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

            {/* Action Buttons & Footer Info */}
            <div
              className={`flex ${isViewing || isEditing ? "justify-between" : "justify-end"} items-center pt-6 border-t-2 border-gray-400 mt-8 no-print`}
            >
              {(isViewing || isEditing) && (
                <div className="text-gray-600 font-medium text-sm">
                  Reference ID:{" "}
                  <span className="font-bold text-gray-900">
                    {formData.requestNumber || id}
                  </span>
                </div>
              )}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-semibold flex items-center"
                >
                  {["requestor", "department_approver"].includes(user?.role) ? (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export to PDF
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="px-6 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-sm font-semibold"
                >
                  {isViewing ? "Back" : "Cancel"}
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

                {!isViewing && user.role === "requestor" && (
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
                      {formData.status === "returned" ? "Resubmit" : "Submit"}
                    </button>
                  </>
                )}

                {(isViewing || isEditing) &&
                  (requestData?.status === "draft" ||
                    formData?.status === "draft") &&
                  requestData?.requestor?.id === user?.id && (
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

                {isViewing &&
                  (requestData?.permissions?.canApprove ||
                    requestData?.permissions?.canProcess) &&
                  // Guard: Ensure IT Manager/Dept Approver only see button in their specific stages
                  !(
                    user?.role === "it_manager" &&
                    ![
                      "department_approved",
                      "endorser_approved",
                      "checked_endorsed",
                    ].includes(requestData?.status)
                  ) &&
                  !(
                    user?.role === "department_approver" &&
                    requestData?.status !== "submitted"
                  ) && (
                    <>
                      {/* Only show Return/Decline for department_approver and it_manager, not for service_desk completing */}
                      {(requestData?.permissions?.canApprove ||
                        requestData?.status !== "service_desk_processing") &&
                        !["service_desk", "endorser"].includes(user?.role) && (
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

                      {/* Approve PR Button - For Service Desk when APPROVED items need PR */}
                      {user?.role === "service_desk" &&
                        requestData?.status === "service_desk_processing" &&
                        formData.items
                          .filter((i) => i.approvalStatus === "approved")
                          .some((i) => i.endorserStatus === "needs_pr") && (
                          <button
                            type="button"
                            onClick={() => {
                              if (attachments.length === 0) {
                                toastWarning(
                                  "Cannot approve PR without attachments.",
                                );
                                return;
                              }
                              setActionModalState({
                                isOpen: true,
                                title: "Approve PR",
                                message:
                                  "Are you sure you want to approve the PR for this request?",
                                confirmText: "Approve PR",
                                variant: "info",
                                onConfirm: async () => {
                                  setActionModalState((prev) => ({
                                    ...prev,
                                    isOpen: false,
                                  }));
                                  await handleApprovePR();
                                },
                              });
                            }}
                            className={`flex items-center px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold ${attachments.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={loading || attachments.length === 0}
                            title={
                              attachments.length === 0
                                ? "Upload attachment (PR) first"
                                : "Approve PR"
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve PR
                          </button>
                        )}

                      {/* Ready to Deploy Button - ONLY if ALL APPROVED items are marked "in_stock" by endorser */}
                      {user?.role === "service_desk" &&
                        [
                          "it_manager_approved",
                          "service_desk_processing",
                        ].includes(requestData?.status) &&
                        formData.items.length > 0 &&
                        formData.items.filter(
                          (i) => i.approvalStatus === "approved",
                        ).length > 0 &&
                        formData.items
                          .filter((i) => i.approvalStatus === "approved")
                          .every((i) => i.endorserStatus === "in_stock") && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionModalState({
                                isOpen: true,
                                title: "Ready to Deploy",
                                message:
                                  "Mark this request as Ready to Deploy? (All items are in stock)",
                                confirmText: "Ready to Deploy",
                                variant: "success",
                                onConfirm: async () => {
                                  setActionModalState((prev) => ({
                                    ...prev,
                                    isOpen: false,
                                  }));
                                  // Call readyToDeploy API
                                  try {
                                    setLoading(true);
                                    await requestsAPI.readyToDeploy(id);
                                    toastSuccess(
                                      "Request marked as Ready to Deploy",
                                    );
                                    navigate("/dashboard");
                                  } catch (error) {
                                    console.error("Error:", error);
                                    toastError("Failed to update status");
                                  } finally {
                                    setLoading(false);
                                  }
                                },
                              });
                            }}
                            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                            disabled={loading}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Ready to Deploy
                          </button>
                        )}

                      {/* Approve/Complete button */}
                      {/* Show "Approve" for dept approver (submitted), IT manager (department_approved), Service Desk (it_manager_approved) */}
                      {/* Show "Complete" for Service Desk when pr_approved OR ready_to_deploy */}
                      {(() => {
                        if (![
                          "submitted",
                          "department_approved",
                          "checked_endorsed",
                          "endorser_approved",
                          "it_manager_approved",
                          "pr_approved",
                          "ready_to_deploy",
                        ].includes(requestData?.status)) return null;

                        const endorserHasUnmarked =
                          user?.role === "endorser" &&
                          ["department_approved", "checked_endorsed"].includes(requestData?.status) &&
                          formData.items.some(
                            (item) =>
                              item.endorserStatus !== "in_stock" &&
                              item.endorserStatus !== "needs_pr",
                          );

                        return (
                          <button
                            type="button"
                            onClick={handleApprove}
                            disabled={loading || endorserHasUnmarked}
                            className={`flex items-center px-6 py-2 text-white rounded text-sm font-semibold ${endorserHasUnmarked
                              ? "bg-green-600 opacity-50 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700 disabled:opacity-50"
                              }`}
                            title={
                              endorserHasUnmarked
                                ? 'Mark all items as "Item Has Stock" or "Needs PR" first'
                                : undefined
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {["pr_approved", "ready_to_deploy"].includes(
                              requestData?.status,
                            )
                              ? "Complete"
                              : "Approve"}
                          </button>
                        );
                      })()}
                    </>
                  )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Requestor Signature Modal */}
      <SignatureModal
        isOpen={showRequestorSignatureModal}
        onClose={() => {
          setShowRequestorSignatureModal(false);
          setTempRequestorSignature("");
        }}
        value={tempRequestorSignature}
        onChange={(signature) => setTempRequestorSignature(signature)}
        approverName={getRequestorName()}
        approverTitle={user?.title || requestData?.requestor?.title || ""}
        label="Requestor E-Signature"
        onSave={() => {
          handleInputChange("requestorSignature", tempRequestorSignature);
        }}
      />

      {/* Approval Signature Modal */}
      <SignatureModal
        isOpen={showApprovalSignatureModal}
        onClose={() => {
          setShowApprovalSignatureModal(false);
          setTempApprovalSignature("");
          setCurrentApprovalId(null);
        }}
        value={tempApprovalSignature}
        onChange={(signature) => setTempApprovalSignature(signature)}
        approverName={user?.fullName || ""}
        approverTitle={user?.title || ""}
        label="Approver E-Signature"
        onSave={() => {
          // If we have a current approval ID, update that specific approval in requestData
          if (currentApprovalId && requestData?.approvals) {
            const updatedApprovals = requestData.approvals.map((approval) =>
              approval.id === currentApprovalId
                ? { ...approval, signature: tempApprovalSignature }
                : approval,
            );
            setRequestData({ ...requestData, approvals: updatedApprovals });
          }
          // Also set the approvalSignature for use when approving
          setApprovalSignature(tempApprovalSignature);
        }}
      />

      {/* Action Modals */}
      <ActionModal
        isOpen={actionModalState.isOpen}
        onClose={() =>
          setActionModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={actionModalState.onConfirm}
        title={actionModalState.title}
        message={actionModalState.message}
        inputLabel={actionModalState.inputLabel}
        inputType={actionModalState.inputType}
        variant={actionModalState.variant}
        confirmText={actionModalState.confirmText}
        allowEmpty={actionModalState.allowEmpty}
        options={actionModalState.options}
      />

      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() =>
          setConfirmDialogState((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmDialogState.onConfirm}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        variant={confirmDialogState.variant}
        confirmText={confirmDialogState.confirmText}
      />

      <ReturnRequestModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={onReturnConfirm}
        returnOptions={returnOptions}
        loading={loading}
      />
      <ReplenishmentModal
        isOpen={showReplenishmentModal}
        onClose={() => setShowReplenishmentModal(false)}
        onConfirm={handleReplenishmentConfirm}
        items={lowStockItems}
      />
    </div>
  );
};

export default RequestForm;
