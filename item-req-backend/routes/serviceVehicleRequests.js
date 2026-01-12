import express from "express";
import { Op } from "sequelize";
import { body, validationResult } from "express-validator";
import {
  ServiceVehicleRequest,
  User,
  Department,
  sequelize,
} from "../models/index.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { getActiveWorkflow, canUserApproveStep, getNextStatus, getFinalStatus } from '../utils/workflowHelper.js';

const router = express.Router();

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
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "",
      department = "",
      search = "",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = {};

    // Role-based filtering
    if (req.user.role === "requestor") {
      // Requestors can only see their own requests
      whereClause.requested_by = req.user.id;
    } else if (req.user.role === "department_approver") {
      // Department approvers can see requests from their department
      whereClause.department_id = req.user.department_id;
    } else if (
      ["it_manager", "service_desk", "super_administrator"].includes(
        req.user.role
      )
    ) {
      // IT managers, service desk, and super admins can see all requests
      // No where clause restriction
    }

    // Status filter
    if (status) {
      whereClause.status = status;
    }

    // Department filter
    if (department) {
      whereClause.department_id = department;
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { requestor_name: { [Op.iLike]: `%${search}%` } },
        { reference_code: { [Op.iLike]: `%${search}%` } },
        { destination: { [Op.iLike]: `%${search}%` } },
        { passenger_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ServiceVehicleRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "RequestedByUser",
          attributes: ["id", "firstName", "lastName", "fullName", "email"],
        },
        {
          model: User,
          as: "AssignedDriverUser",
          attributes: ["id", "firstName", "lastName", "fullName", "email"],
        },
        {
          model: Department,
          as: "Department",
          attributes: ["id", "name"],
        },
      ],
      offset,
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      requests: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching service vehicle requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: error.message,
    });
  }
});

// Get single service vehicle request
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: "RequestedByUser",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "fullName",
            "email",
            "role",
          ],
        },
        {
          model: User,
          as: "AssignedDriverUser",
          attributes: ["id", "firstName", "lastName", "fullName", "email"],
        },
        {
          model: Department,
          as: "Department",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.id === request.requested_by ||
      req.user.department_id === request.department_id ||
      ["it_manager", "service_desk", "super_administrator"].includes(
        req.user.role
      );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this request",
      });
    }

    res.json({
      success: true,
      request,
    });
  } catch (error) {
    console.error("Error fetching service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch request",
      error: error.message,
    });
  }
});

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
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const {
        requestor_name,
        department_id,
        contact_number,
        date_prepared,
        purpose,
        request_type,
        travel_date_from,
        travel_date_to,
        pick_up_location,
        pick_up_time,
        drop_off_location,
        drop_off_time,
        passenger_name,
        destination,
        departure_time,
        destination_car,
        has_valid_license,
        license_number,
        expiration_date,
        comments,
        status,
      } = req.body;

      // Sanitize and validate date fields
      const sanitizedData = {
        requestor_name,
        department_id,
        contact_number: contact_number || null,
        date_prepared:
          formatDate(date_prepared) || new Date().toISOString().split("T")[0],
        purpose: purpose || null,
        request_type,
        travel_date_from: formatDate(travel_date_from),
        travel_date_to: formatDate(travel_date_to),
        pick_up_location: pick_up_location || null,
        pick_up_time: pick_up_time || null,
        drop_off_location: drop_off_location || null,
        drop_off_time: drop_off_time || null,
        passenger_name: passenger_name || null,
        destination: destination || null,
        departure_time: departure_time || null,
        destination_car: destination_car || null,
        has_valid_license:
          request_type === "car_only"
            ? has_valid_license === "true" || has_valid_license === true
            : true,
        license_number:
          request_type === "car_only" && has_valid_license
            ? license_number
            : null,
        expiration_date:
          request_type === "car_only" && has_valid_license
            ? formatDate(expiration_date)
            : null,
        requested_by: req.user.id,
        reference_code: generateReferenceCode(),
        status: status === "draft" ? "draft" : "submitted",
        comments: comments || null,
      };

      const newRequest = await ServiceVehicleRequest.create(sanitizedData);

      res.status(201).json({
        success: true,
        message: "Service vehicle request created successfully",
        request: newRequest,
      });
    } catch (error) {
      console.error("Error creating service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create request",
        error: error.message,
      });
    }
  }
);

// Update service vehicle request
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can edit this request
    const canEdit =
      (req.user.id === request.requested_by &&
        ["draft", "returned"].includes(request.status)) ||
      ["it_manager", "super_administrator"].includes(req.user.role);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this request",
      });
    }

    // Update allowed fields
    const updateFields = [
      "requestor_name",
      "contact_number",
      "date_prepared",
      "purpose",
      "request_type",
      "travel_date_from",
      "travel_date_to",
      "pick_up_location",
      "pick_up_time",
      "drop_off_location",
      "drop_off_time",
      "passenger_name",
      "destination",
      "departure_time",
      "destination_car",
      "has_valid_license",
      "license_number",
      "expiration_date",
      "comments",
      "status",
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Sanitize date fields
        if (
          [
            "date_prepared",
            "travel_date_from",
            "travel_date_to",
            "expiration_date",
          ].includes(field)
        ) {
          request[field] = formatDate(req.body[field]);
        } else if (
          ["pick_up_time", "drop_off_time", "departure_time"].includes(field)
        ) {
          request[field] = req.body[field] || null;
        } else if (
          [
            "contact_number",
            "purpose",
            "pick_up_location",
            "drop_off_location",
            "passenger_name",
            "destination",
            "destination_car",
            "license_number",
            "comments",
          ].includes(field)
        ) {
          request[field] = req.body[field] || null;
        } else {
          request[field] = req.body[field];
        }
      }
    });

    await request.save();

    res.json({
      success: true,
      message: "Service vehicle request updated successfully",
      request,
    });
  } catch (error) {
    console.error("Error updating service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update request",
      error: error.message,
    });
  }
});

// Submit service vehicle request
router.post("/:id/submit", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can submit this request
    if (req.user.id !== request.requested_by) {
      return res.status(403).json({
        success: false,
        message: "You can only submit your own requests",
      });
    }

    if (!["draft", "returned"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: "Only draft or returned requests can be submitted",
      });
    }

    request.status = "submitted";
    await request.save();

    res.json({
      success: true,
      message: "Service vehicle request submitted successfully",
      request,
    });
  } catch (error) {
    console.error("Error submitting service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit request",
      error: error.message,
    });
  }
});

// Approve service vehicle request
// Uses configured workflow if available, otherwise defaults to department_approver -> completed
router.post(
  "/:id/approve",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { comments, remarks } = req.body;

      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: Department,
            as: 'Department'
          }
        ]
      });
      
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      if (request.status !== "submitted" && request.status !== "returned") {
        return res.status(400).json({
          success: false,
          message: "Only submitted or returned requests can be approved",
        });
      }

      // Check if there's a configured workflow
      const workflow = await getActiveWorkflow('vehicle_request');

      if (workflow && workflow.steps && workflow.steps.length > 0) {
        // Use configured workflow
        const steps = workflow.steps.sort((a, b) => a.step_number - b.step_number);
        const currentStepNumber = request.status === 'submitted' ? 1 : 1; // Start from step 1
        
        // Find the current step
        const currentStep = steps.find(step => step.step_number === currentStepNumber);
        
        if (!currentStep) {
          return res.status(400).json({
            success: false,
            message: "Invalid workflow step",
          });
        }

        // Check if user can approve this step
        if (!canUserApproveStep(req.user, currentStep, request)) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to approve at this step",
          });
        }

        // Determine next status
        const isLastStep = currentStepNumber >= steps.length;
        const nextStatus = isLastStep ? getFinalStatus(workflow) : getNextStatus(workflow, currentStepNumber);

        request.status = nextStatus;
        request.approval_date = new Date();
        if (comments || remarks) {
          request.comments = comments || remarks;
        }
        await request.save();

        res.json({
          success: true,
          message: isLastStep 
            ? "Service vehicle request approved and completed successfully" 
            : "Service vehicle request approved successfully",
          request,
        });
      } else {
        // Default workflow: department_approver approval completes the request
        if (!["department_approver", "super_administrator"].includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to approve this request",
          });
        }

        request.status = "completed";
        request.approval_date = new Date();
        if (comments || remarks) {
          request.comments = comments || remarks;
        }
        await request.save();

        res.json({
          success: true,
          message: "Service vehicle request approved and completed successfully",
          request,
        });
      }
    } catch (error) {
      console.error("Error approving service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve request",
        error: error.message,
      });
    }
  }
);

// Decline service vehicle request
router.post(
  "/:id/decline",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      if (!comments || comments.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Decline reason is required",
        });
      }

      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      request.status = "declined";
      request.comments = comments;
      await request.save();

      res.json({
        success: true,
        message: "Service vehicle request declined",
        request,
      });
    } catch (error) {
      console.error("Error declining service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to decline request",
        error: error.message,
      });
    }
  }
);

// Assign vehicle to request
router.post(
  "/:id/assign",
  authenticateToken,
  requireRole(["it_manager", "service_desk", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assigned_driver, assigned_vehicle } = req.body;

      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      if (request.status !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Only approved requests can be assigned",
        });
      }

      request.assigned_driver = assigned_driver;
      request.assigned_vehicle = assigned_vehicle;
      request.status = "assigned";
      await request.save();

      res.json({
        success: true,
        message: "Vehicle assigned successfully",
        request,
      });
    } catch (error) {
      console.error("Error assigning vehicle:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign vehicle",
        error: error.message,
      });
    }
  }
);

// Return service vehicle request for revision
router.post(
  "/:id/return",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Return reason is required",
        });
      }

      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      if (request.status !== "submitted") {
        return res.status(400).json({
          success: false,
          message: "Only submitted requests can be returned",
        });
      }

      request.status = "returned";
      request.comments = reason;
      await request.save();

      res.json({
        success: true,
        message: "Service vehicle request returned for revision",
        request,
      });
    } catch (error) {
      console.error("Error returning service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to return request",
        error: error.message,
      });
    }
  }
);

// Delete service vehicle request
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can delete this request
    const canDelete =
      (req.user.id === request.requested_by &&
        ["draft", "declined"].includes(request.status)) ||
      req.user.role === "super_administrator";

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this request",
      });
    }

    await request.destroy();

    res.json({
      success: true,
      message: "Service vehicle request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete request",
      error: error.message,
    });
  }
});

export default router;
