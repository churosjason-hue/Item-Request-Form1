import express from "express";
import { Op } from "sequelize";
import { body, validationResult } from "express-validator";
import {
  ServiceVehicleRequest,
  User,
  Department,
  VehicleApproval,
  WorkflowStep,
  Vehicle,
  Driver,
  sequelize,
} from "../models/index.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import emailService from "../utils/emailService.js";
import { processWorkflowOnSubmit, processWorkflowOnApproval, findCurrentStepForApprover, getActiveWorkflow, findApproverForStep } from "../utils/workflowProcessor.js";
import { logAudit, calculateChanges } from '../utils/auditLogger.js';
import upload from "../utils/uploadConfig.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  submitRequest,
  approveRequest,
  declineRequest,
  returnRequest,
  assignVehicle,
  deleteRequest,
  getStats,
  trackRequest,
  assignVerifier,
  verifyRequest
} from "../controllers/serviceVehicleRequestController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Helper function to build order clause for sorting vehicle requests
function buildVehicleOrderClause(sortBy, sortOrder) {
  const order = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  switch (sortBy) {
    case 'status':
      return [['status', order], ['created_at', 'DESC']];
    case 'requestor':
      return [
        [{ model: User, as: 'RequestedByUser' }, 'first_name', order],
        [{ model: User, as: 'RequestedByUser' }, 'last_name', order],
        ['created_at', 'DESC']
      ];
    case 'date':
    default:
      return [['created_at', order]];
  }
}

// Upload attachment for vehicle request
router.post(
  "/:id/attachments",
  authenticateToken,
  upload.array('files', 10), // Allow up to 10 files
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded"
        });
      }

      // Load request with User relation to get requestor email
      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
          },
        ],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found"
        });
      }

      // Check if user has permission to upload attachments
      // Requestors can upload attachments on their own requests (when status is draft or returned)
      // Approvers (department_approver and super_administrator) can upload attachments on any request
      const isApprover = req.user.role === 'department_approver' || req.user.role === 'super_administrator';
      const isRequestor = req.user.id === request.requested_by;

      if (!isApprover && !isRequestor) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to upload attachments for this request"
        });
      }

      // Requestors can upload attachments when status is draft or returned
      // Approvers can upload attachments when status is submitted, returned, department_approved, or completed
      const allowedStatusesForRequestor = ['draft', 'returned'];
      const allowedStatusesForApprover = ['submitted', 'returned', 'department_approved', 'completed'];

      if (isRequestor && !isApprover) {
        // Requestor uploading on their own request
        if (!allowedStatusesForRequestor.includes(request.status)) {
          return res.status(400).json({
            success: false,
            message: "You can only upload attachments when the request is in draft or returned status"
          });
        }
      } else if (isApprover) {
        // Approver uploading
        if (!allowedStatusesForApprover.includes(request.status)) {
          return res.status(400).json({
            success: false,
            message: "Attachments can only be uploaded for submitted, returned, department_approved, or completed requests"
          });
        }
      }

      // Prepare attachment metadata
      const newAttachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/vehicle-requests/${file.filename}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.id
      }));

      // Get existing attachments or initialize empty array
      const existingAttachments = request.attachments || [];
      const updatedAttachments = [...existingAttachments, ...newAttachments];

      // Update request with new attachments
      await request.update({
        attachments: updatedAttachments
      });

      // Send email notification to requestor about new attachments
      try {
        // Use the request we already loaded with relations
        if (request?.RequestedByUser) {
          // Convert to plain object to ensure all fields are accessible
          const requestedByUser = request.RequestedByUser.toJSON
            ? request.RequestedByUser.toJSON()
            : request.RequestedByUser;

          const requestorData = {
            ...requestedByUser,
            firstName: requestedByUser.first_name,
            lastName: requestedByUser.last_name,
            fullName: `${requestedByUser.first_name} ${requestedByUser.last_name}`,
            email: requestedByUser.email // Explicitly include email
          };

          // Debug logging
          console.log('📧 Attachment upload email notification:');
          console.log('   Requestor email:', requestorData.email);
          console.log('   Requestor name:', requestorData.fullName);
          console.log('   Request ID:', id);
          console.log('   RequestedByUser raw:', JSON.stringify(requestedByUser, null, 2));

          // Reload request to get updated attachments
          const requestWithAttachments = await ServiceVehicleRequest.findByPk(id);
          const requestData = requestWithAttachments.toJSON ? requestWithAttachments.toJSON() : requestWithAttachments;
          requestData.attachments = updatedAttachments; // Include all attachments including new ones

          await emailService.notifyVehicleAttachmentUploaded(
            requestData,
            requestorData,
            req.user,
            newAttachments.length,
            newAttachments // Pass only the newly uploaded attachments
          );
        } else {
          console.log('⚠️ RequestedByUser not found for request:', id);
          console.log('   Request object keys:', Object.keys(request || {}));
        }
      } catch (emailError) {
        console.error("Failed to send email notification for attachment upload:", emailError);
        console.error("Error stack:", emailError.stack);
        // Don't fail the upload if email fails
      }

      res.json({
        success: true,
        message: "Files uploaded successfully",
        attachments: newAttachments
      });
    } catch (error) {
      console.error("Error uploading attachments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload attachments",
        error: error.message
      });
    }
  }
);

// Delete attachment
router.delete(
  "/:id/attachments/:filename",
  authenticateToken,
  async (req, res) => {
    try {
      const { id, filename } = req.params;

      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found"
        });
      }

      // Check if user has permission to delete attachments
      // Requestors can delete attachments on their own requests (when status is draft or returned)
      // Approvers (department_approver and super_administrator) can delete attachments on any request
      const isApprover = req.user.role === 'department_approver' || req.user.role === 'super_administrator';
      const isRequestor = req.user.id === request.requested_by;

      if (!isApprover && !isRequestor) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete attachments for this request"
        });
      }

      // Requestors can only delete attachments when status is draft or returned
      if (isRequestor && !isApprover && !['draft', 'returned'].includes(request.status)) {
        return res.status(403).json({
          success: false,
          message: "You can only delete attachments when the request is in draft or returned status"
        });
      }

      const attachments = request.attachments || [];
      const attachmentIndex = attachments.findIndex(att => att.filename === filename);

      if (attachmentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Attachment not found"
        });
      }

      // Remove attachment from array
      const updatedAttachments = attachments.filter(att => att.filename !== filename);
      await request.update({
        attachments: updatedAttachments
      });

      // Optionally delete file from filesystem
      const fs = await import('fs');
      const filePath = join(__dirname, '..', 'uploads', 'vehicle-requests', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: "Attachment deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete attachment",
        error: error.message
      });
    }
  }
);

// Helper function to validate and format dates
function formatDate(dateString) {
  if (!dateString || dateString.trim() === "") return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
}

// Generate reference code
function generateReferenceCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const timestamp = now.getTime().toString().slice(-6);

  return `SVR-${year}${month}${day}-${timestamp}`;
}

// Get all service vehicle requests (with filtering and pagination)
router.get("/", authenticateToken, getAllRequests);

// Check vehicle and driver availability
router.get("/availability", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, pickupTime, dropoffTime } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required"
      });
    }

    // Helper to normalize time to HH:mm:ss
    const normalizeTime = (t) => {
      if (!t) return null;
      // Simple conversion for 12h format: "06:16 PM" -> "18:16:00"
      const match = t.match(/^(\d+):(\d+)(?::(\d+))?\s*(PM|AM)$/i);
      if (match) {
        let [_, h, m, s, type] = match;
        let hours = parseInt(h, 10);
        if (type.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (type.toUpperCase() === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${m}:${s || '00'}`;
      }
      return t;
    };

    const queryStartStr = `${startDate}T${normalizeTime(pickupTime) || '00:00:00'}`;
    const queryEndStr = `${endDate}T${normalizeTime(dropoffTime) || '23:59:59'}`;
    const queryStart = new Date(queryStartStr);
    const queryEnd = new Date(queryEndStr);



    // Find POTENTIAL conflicting requests (Date Overlap)
    // We filter roughly by date first to minimize JS processing
    const roughConflicts = await ServiceVehicleRequest.findAll({
      where: {
        status: {
          [Op.notIn]: ['draft', 'declined', 'cancelled']
        },
        [Op.and]: [
          // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
          { travel_date_from: { [Op.lte]: endDate } },
          { travel_date_to: { [Op.gte]: startDate } }
        ]
      },
      attributes: [
        'id',
        'assigned_vehicle',
        'assigned_driver',
        'travel_date_from',
        'travel_date_to',
        'pick_up_time',
        'drop_off_time'
      ]
    });

    // Refine conflicts with Time Check
    const confirmedConflicts = roughConflicts.filter(req => {
      // If request has no time set, assume it takes the full day(s) it spans
      const reqStartStr = `${req.travel_date_from}T${normalizeTime(req.pick_up_time) || '00:00:00'}`;
      const reqEndStr = `${req.travel_date_to}T${normalizeTime(req.drop_off_time) || '23:59:59'}`;

      const reqStart = new Date(reqStartStr);
      const reqEnd = new Date(reqEndStr);

      const isOverlapping = queryStart < reqEnd && queryEnd > reqStart;

      // Check overlap: StartA < EndB && EndA > StartB
      return isOverlapping;
    });

    const conflictingRequests = confirmedConflicts; // Alias for existing code below

    // Extract booked IDs/Names
    const bookedVehicleIds = conflictingRequests
      .map(r => r.assigned_vehicle)
      .filter(id => id); // Filter out nulls

    const bookedDriverNames = conflictingRequests
      .map(r => r.assigned_driver)
      .filter(name => name); // Filter out nulls (drivers are stored as names)

    // Fetch all vehicles and drivers
    const allVehicles = await Vehicle.findAll();
    const allDrivers = await Driver.findAll();

    // Filter out booked resources
    // For vehicles, we match by ID
    const availableVehicles = allVehicles.filter(v => !bookedVehicleIds.includes(v.id));

    // For drivers, we match by Name (case insensitive for safety)
    const availableDrivers = allDrivers.filter(d => {
      const isBooked = bookedDriverNames.some(bookedName =>
        bookedName.toLowerCase() === d.name.toLowerCase()
      );
      return !isBooked;
    });

    res.json({
      success: true,
      availableVehicles,
      availableDrivers,
      conflictingCount: confirmedConflicts.length
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check availability",
      error: error.message
    });
  }
});

// Get single service vehicle request
router.get("/:id", authenticateToken, getRequestById);

// Create service vehicle request
router.post(
  "/",
  authenticateToken,
  [
    body("requestor_name").notEmpty().withMessage("Requestor name is required"),
    body("department_id").isInt().withMessage("Department ID is required"),
    body("request_type")
      .isIn([
        "drop_passenger_only",
        "point_to_point_service",
        "passenger_pickup_only",
        "item_pickup",
        "item_delivery",
        "car_only",
      ])
      .withMessage("Invalid request type"),
    body("travel_date_from")
      .if((value, { req }) => req.body.status === "submitted")
      .notEmpty()
      .withMessage("Travel date from is required")
      .custom((value) => {
        const formatted = formatDate(value);
        if (!formatted) throw new Error("Valid travel date from is required");
        return true;
      }),
    // Conditional validation for license - only required for car_only
    body("has_valid_license")
      .customSanitizer((value, { req }) => {
        // Only process if request_type is car_only
        if (req.body.request_type !== "car_only") {
          return null; // Set to null for non-car_only requests
        }
        if (value === "" || value === null || value === undefined) return true;
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
      })
      .if(() => req.body.request_type === "car_only")
      .isBoolean()
      .withMessage("License validity must be specified for car only requests"),
    body("license_number")
      .if(
        () =>
          req.body.request_type === "car_only" &&
          req.body.has_valid_license === true
      )
      .notEmpty()
      .withMessage("License number is required"),
    body("expiration_date")
      .if(
        () =>
          req.body.request_type === "car_only" &&
          req.body.has_valid_license === true
      )
      .notEmpty()
      .isISO8601()
      .withMessage("License expiration date is required"),
  ],
  createRequest
);

// Update service vehicle request
router.put("/:id", authenticateToken, updateRequest);

// Submit service vehicle request
router.post("/:id/submit", authenticateToken, submitRequest);

// Approve service vehicle request
// Vehicle requests only go through ODHC (department approver) - this is the final step
router.post(
  "/:id/approve",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  approveRequest
);

// Decline service vehicle request
// Only ODHC (department approver) can decline vehicle requests
router.post(
  "/:id/decline",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  declineRequest
);

// Return service vehicle request for revision
// Only ODHC (department approver) can return vehicle requests
router.post(
  "/:id/return",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  returnRequest
);

// Assign vehicle to request (deprecated - vehicle requests are completed when approved by ODHC)
// Keeping for backward compatibility but not used in new workflow
router.post(
  "/:id/assign",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  assignVehicle
);

// Delete service vehicle request
router.delete("/:id", authenticateToken, deleteRequest);

// Get statistics for service vehicle requests
router.get("/stats/overview", authenticateToken, getStats);

// Public endpoint: Track vehicle request by reference code (no authentication required)
router.get('/public/track/:referenceCode', trackRequest);

// Assign temporary verifier (ODHC Only)
router.post("/:id/assign-verifier", authenticateToken, assignVerifier);

// Verify Request (Verifier Action)
router.post("/:id/verify", authenticateToken, verifyRequest);

export default router;
