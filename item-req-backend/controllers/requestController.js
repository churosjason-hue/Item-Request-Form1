import { Op } from 'sequelize';
import { validationResult } from 'express-validator';
import { Request, RequestItem, Approval, User, Department, sequelize } from '../models/index.js';
import { processWorkflowOnSubmit, findCurrentStepForApprover, processWorkflowOnApproval, checkStepCompletion } from '../utils/workflowProcessor.js';
import { logAudit, calculateChanges } from '../utils/auditLogger.js';
import emailService from '../utils/emailService.js';

// Generate request number
export function generateRequestNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);

    return `REQ-${year}${month}${day}-${timestamp}`;
}

// Helper function to build order clause for sorting
function buildOrderClause(sortBy, sortOrder) {
    const order = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    switch (sortBy) {
        case 'status':
            return [['status', order], ['created_at', 'DESC']];
        case 'requestor':
            return [
                [{ model: User, as: 'Requestor' }, 'first_name', order],
                [{ model: User, as: 'Requestor' }, 'last_name', order],
                ['created_at', 'DESC']
            ];
        case 'date':
        default:
            return [['created_at', order]];
    }
}

// Get all requests (with filtering and pagination)
export const getAllRequests = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status = '',
            department = '',
            priority = '',
            search = '',
            dateFrom = '',
            dateTo = '',
            requestor = '',
            sortBy = 'date', // 'date', 'status', 'requestor'
            sortOrder = 'desc' // 'asc' or 'desc'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause based on user role
        let whereClause = {};
        let excludeDrafts = false;

        // Role-based filtering
        if (req.user.role === 'requestor') {
            // Requestors can only see their own requests
            whereClause.requestor_id = req.user.id;
        } else if (req.user.role === 'department_approver') {
            // Department approvers can see requests from their department (excluding drafts)
            whereClause.department_id = req.user.department_id;
            excludeDrafts = true;
        } else if (['it_manager', 'service_desk', 'super_administrator'].includes(req.user.role)) {
            // IT managers, service desk, and super admins can see all non-draft requests
            excludeDrafts = true;
        }

        // Apply filters
        if (status) {
            // Only allow filtering for draft if user is requestor
            if (status === 'draft' && req.user.role !== 'requestor') {
                // Ignore draft filter for non-requestors
                excludeDrafts = true;
            } else {
                whereClause.status = status;
            }
        } else if (excludeDrafts) {
            // If no status filter, exclude drafts for non-requestors
            whereClause.status = { [Op.ne]: 'draft' };
        }

        if (department && ['it_manager', 'service_desk', 'super_administrator'].includes(req.user.role)) {
            whereClause.department_id = department;
        }

        if (priority) {
            whereClause.priority = priority;
        }

        if (requestor && ['it_manager', 'service_desk', 'super_administrator'].includes(req.user.role)) {
            whereClause.requestor_id = requestor;
        }

        if (search) {
            whereClause[Op.or] = [
                { request_number: { [Op.iLike]: `%${search}%` } },
                { user_name: { [Op.iLike]: `%${search}%` } },
                { reason: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (dateFrom || dateTo) {
            whereClause.submitted_at = {};
            if (dateFrom) whereClause.submitted_at[Op.gte] = new Date(dateFrom);
            if (dateTo) whereClause.submitted_at[Op.lte] = new Date(dateTo + 'T23:59:59');
        }

        const { count, rows: requests } = await Request.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'Requestor',
                    attributes: ['id', 'username', 'first_name', 'last_name', 'email']
                },
                {
                    model: Department,
                    as: 'Department',
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: RequestItem,
                    as: 'Items',
                    attributes: ['id', 'category', 'item_description', 'quantity', 'estimated_cost']
                },
                {
                    model: Approval,
                    as: 'Approvals',
                    include: [{
                        model: User,
                        as: 'Approver',
                        attributes: ['id', 'username', 'first_name', 'last_name', 'title']
                    }]
                }
            ],
            order: buildOrderClause(sortBy, sortOrder),
            limit: parseInt(limit),
            offset: offset
        });

        // Map requests with async data
        const mappedRequests = await Promise.all(requests.map(async (request) => {
            const requestData = {
                id: request.id,
                requestNumber: request.request_number,
                requestor: {
                    id: request.Requestor.id,
                    username: request.Requestor.username,
                    fullName: `${request.Requestor.first_name} ${request.Requestor.last_name}`,
                    email: request.Requestor.email
                },
                userName: request.user_name,
                userPosition: request.user_position,
                department: {
                    id: request.Department.id,
                    name: request.Department.name,
                    description: request.Department.description
                },
                status: request.status,
                priority: request.priority,
                dateRequired: request.date_required,
                reason: request.reason,
                totalEstimatedCost: parseFloat(request.total_estimated_cost || 0),
                itemsCount: request.Items?.length || 0,
                submittedAt: request.submitted_at,
                completedAt: request.completed_at,
                createdAt: request.created_at,
                updatedAt: request.updated_at,
                approvals: request.Approvals?.map(approval => ({
                    id: approval.id,
                    type: approval.approval_type,
                    status: approval.status,
                    approver: approval.Approver ? {
                        id: approval.Approver.id,
                        fullName: `${approval.Approver.first_name} ${approval.Approver.last_name}`
                    } : null,
                    comments: approval.comments,
                    approvedAt: approval.approved_at,
                    declinedAt: approval.declined_at
                })) || []
            };

            // Check if pending my approval
            requestData.isPendingMyApproval = false;

            if (!['completed', 'declined', 'draft', 'cancelled', 'returned'].includes(request.status)) {
                // Phase 3 Optimization
                if (request.pending_approver_ids && request.pending_approver_ids.length > 0) {
                    requestData.isPendingMyApproval = request.pending_approver_ids.includes(req.user.id);
                } else {
                    // Fallback
                    try {
                        // Determine if user can approve based on status permissions (simple check first)
                        let canApprove = false;
                        if (request.status === 'submitted' && req.user.canApproveForDepartment(request.department_id)) canApprove = true;
                        else if (request.status === 'department_approved' && req.user.canApproveAsITManager()) canApprove = true;
                        else if (['it_manager_approved', 'service_desk_processing'].includes(request.status) && req.user.canProcessRequests()) canApprove = true;

                        requestData.isPendingMyApproval = canApprove;
                    } catch (e) {
                        // ignore
                    }
                }
            }
            return requestData;
        }));

        res.json({
            requests: mappedRequests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({
            error: 'Failed to fetch requests',
            message: error.message
        });
    }
};

// Get request by ID
export const getRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await Request.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'Requestor',
                    attributes: ['id', 'username', 'first_name', 'last_name', 'email', 'title', 'phone']
                },
                {
                    model: Department,
                    as: 'Department',
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: RequestItem,
                    as: 'Items'
                },
                {
                    model: Approval,
                    as: 'Approvals',
                    include: [{
                        model: User,
                        as: 'Approver',
                        attributes: ['id', 'username', 'first_name', 'last_name', 'role', 'title']
                    }]
                }
            ]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        // Check if it's a draft request
        if (request.status === 'draft' && request.requestor_id !== req.user.id) {
            // Only the requestor can view their own drafts
            return res.status(403).json({
                error: 'Access denied',
                message: 'Draft requests can only be viewed by the requestor'
            });
        }

        // Check access permissions for non-draft requests
        const canAccess =
            req.user.role === 'super_administrator' ||
            req.user.role === 'it_manager' ||
            req.user.role === 'service_desk' ||
            request.requestor_id === req.user.id ||
            (req.user.role === 'department_approver' && request.department_id === req.user.department_id);

        if (!canAccess) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to view this request'
            });
        }

        res.json({
            request: {
                id: request.id,
                requestNumber: request.request_number,
                requestor: {
                    id: request.Requestor.id,
                    username: request.Requestor.username,
                    fullName: `${request.Requestor.first_name} ${request.Requestor.last_name}`,
                    email: request.Requestor.email,
                    title: request.Requestor.title,
                    phone: request.Requestor.phone
                },
                userName: request.user_name,
                userPosition: request.user_position,
                department: {
                    id: request.Department.id,
                    name: request.Department.name,
                    description: request.Department.description
                },
                status: request.status,
                priority: request.priority,
                dateRequired: request.date_required,
                reason: request.reason,
                totalEstimatedCost: parseFloat(request.total_estimated_cost || 0),
                attachments: request.attachments,
                comments: request.comments,
                requestorSignature: request.requestor_signature,
                submittedAt: request.submitted_at,
                completedAt: request.completed_at,
                createdAt: request.created_at,
                updatedAt: request.updated_at,
                items: request.Items?.map(item => ({
                    id: item.id,
                    category: item.category,
                    itemDescription: item.item_description,
                    quantity: item.quantity,
                    inventoryNumber: item.inventory_number,
                    proposedSpecs: item.proposed_specs,
                    purpose: item.purpose,
                    estimatedCost: parseFloat(item.estimated_cost || 0),
                    vendorInfo: item.vendor_info,
                    isReplacement: item.is_replacement,
                    replacedItemInfo: item.replaced_item_info,
                    urgencyReason: item.urgency_reason
                })) || [],
                approvals: request.Approvals?.map(approval => ({
                    id: approval.id,
                    type: approval.approval_type,
                    status: approval.status,
                    approver: approval.Approver ? {
                        id: approval.Approver.id,
                        username: approval.Approver.username,
                        fullName: `${approval.Approver.first_name} ${approval.Approver.last_name}`,
                        role: approval.Approver.role,
                        title: approval.Approver.title || ''
                    } : null,
                    comments: approval.comments,
                    approvedAt: approval.approved_at,
                    declinedAt: approval.declined_at,
                    returnedAt: approval.returned_at,
                    returnReason: approval.return_reason,
                    estimatedCompletionDate: approval.estimated_completion_date,
                    actualCompletionDate: approval.actual_completion_date,
                    processingNotes: approval.processing_notes,
                    signature: approval.signature,
                    createdAt: approval.created_at
                })) || [],
                permissions: (() => {
                    const canEdit = request.canBeEditedBy(req.user);
                    const canApprove = request.canBeApprovedBy(req.user);
                    const canProcess = request.canBeProcessedBy(req.user);

                    // Debug logging
                    console.log(`Request ${request.id} - Status: ${request.status}, User Role: ${req.user.role}`);
                    console.log(`Permissions - canEdit: ${canEdit}, canApprove: ${canApprove}, canProcess: ${canProcess}`);

                    return {
                        canEdit,
                        canApprove,
                        canProcess
                    };
                })()
            }
        });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({
            error: 'Failed to fetch request',
            message: error.message
        });
    }
};

// Create new request
export const createRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Create request validation errors:', JSON.stringify(errors.array(), null, 2));
            console.error('Request body:', JSON.stringify(req.body, null, 2));
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        // Only requestors can create requests
        if (req.user.role !== 'requestor') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only users with the requestor role can create equipment requests'
            });
        }

        const {
            userName,
            userPosition,
            departmentId,
            dateRequired,
            reason,
            priority = 'medium',
            items,
            comments,
            requestorSignature
        } = req.body;

        // Verify department exists
        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(400).json({
                error: 'Invalid department',
                message: 'The specified department does not exist'
            });
        }

        // Requestors can only create requests for their own department
        if (req.user.department_id !== departmentId) {
            return res.status(403).json({
                error: 'Department access denied',
                message: 'You can only create requests for your own department'
            });
        }

        // Calculate total estimated cost
        const totalCost = items.reduce((sum, item) => {
            const itemCost = parseFloat(item.estimatedCost || 0) * parseInt(item.quantity || 1);
            return sum + itemCost;
        }, 0);

        // Create request
        const request = await Request.create({
            request_number: generateRequestNumber(),
            requestor_id: req.user.id,
            user_name: userName || `${req.user.first_name} ${req.user.last_name}`,
            user_position: userPosition || req.user.title,
            department_id: departmentId,
            date_required: dateRequired,
            reason: reason,
            priority: priority,
            total_estimated_cost: totalCost,
            comments: comments,
            requestor_signature: requestorSignature || null,
            status: 'draft'
        });

        // Create request items
        const requestItems = await Promise.all(
            items.map(item => RequestItem.create({
                request_id: request.id,
                category: item.category,
                item_description: item.itemDescription,
                quantity: item.quantity,
                inventory_number: item.inventoryNumber || null,
                proposed_specs: item.proposedSpecs || null,
                purpose: item.purpose || null,
                estimated_cost: item.estimatedCost ? parseFloat(item.estimatedCost) : null,
                vendor_info: item.vendorInfo || null,
                is_replacement: item.isReplacement || false,
                replaced_item_info: item.replacedItemInfo || null,
                urgency_reason: item.urgencyReason || null
            }))
        );

        res.status(201).json({
            message: 'Request created successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: request.status,
                totalEstimatedCost: parseFloat(request.total_estimated_cost),
                itemsCount: requestItems.length
            }
        });

        // Audit Log
        await logAudit({
            req,
            action: 'CREATE',
            entityType: 'Request',
            entityId: request.id,
            details: {
                requestNumber: request.request_number,
                itemsCount: items.length,
                totalCost: totalCost
            }
        });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({
            error: 'Failed to create request',
            message: error.message
        });
    }
};

// Update request (draft only)
export const updateRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Update request validation errors:', JSON.stringify(errors.array(), null, 2));
            console.error('Request body:', JSON.stringify(req.body, null, 2));
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const request = await Request.findByPk(id, {
            include: [{ model: RequestItem, as: 'Items' }]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        console.log('Checking edit permission - Request status:', request.status, 'User ID:', req.user.id, 'Requestor ID:', request.requestor_id);
        const canEdit = request.canBeEditedBy(req.user);
        console.log('Can edit?', canEdit);

        if (!canEdit) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to edit this request'
            });
        }

        const {
            userName,
            userPosition,
            departmentId,
            dateRequired,
            reason,
            priority,
            items,
            comments,
            requestorSignature
        } = req.body;

        // Update request fields
        const updateData = {};
        if (userName !== undefined) updateData.user_name = userName;
        if (userPosition !== undefined) updateData.user_position = userPosition;
        if (departmentId !== undefined) updateData.department_id = departmentId;
        if (dateRequired !== undefined) updateData.date_required = dateRequired;
        if (reason !== undefined) updateData.reason = reason;
        if (priority !== undefined) updateData.priority = priority;
        if (comments !== undefined) updateData.comments = comments;
        if (requestorSignature !== undefined) updateData.requestor_signature = requestorSignature || null;

        // Update items if provided
        if (items) {
            // Delete existing items
            await RequestItem.destroy({ where: { request_id: id } });

            // Create new items
            await Promise.all(
                items.map(item => RequestItem.create({
                    request_id: id,
                    category: item.category,
                    item_description: item.itemDescription,
                    quantity: item.quantity,
                    inventory_number: item.inventoryNumber || null,
                    proposed_specs: item.proposedSpecs || null,
                    purpose: item.purpose || null,
                    estimated_cost: item.estimatedCost ? parseFloat(item.estimatedCost) : null,
                    vendor_info: item.vendorInfo || null,
                    is_replacement: item.isReplacement || false,
                    replaced_item_info: item.replacedItemInfo || null,
                    urgency_reason: item.urgencyReason || null
                }))
            );

            // Recalculate total cost
            const totalCost = items.reduce((sum, item) => {
                const itemCost = parseFloat(item.estimatedCost || 0) * parseInt(item.quantity || 1);
                return sum + itemCost;
            }, 0);
            updateData.total_estimated_cost = totalCost;
        }

        // Calculate changes for Audit Log
        const changes = calculateChanges(request, updateData);

        await request.update(updateData);

        // Audit Log
        // Audit Log: Request Updated
        if (Object.keys(changes).length > 0) {
            // items update detection logic is complex as it involves child records
            if (items) {
                changes.items = "Items list renewed/updated";
            }

            await logAudit({
                req,
                action: 'UPDATE',
                entityType: 'Request',
                entityId: request.id,
                details: { changes }
            });
        }

        res.json({
            message: 'Request updated successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: request.status
            }
        });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({
            error: 'Failed to update request',
            message: error.message
        });
    }
};
// Submit request for approval
export const submitRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await Request.findByPk(id, {
            include: [{ model: RequestItem, as: 'Items' }]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        if (request.requestor_id !== req.user.id && req.user.role !== 'super_administrator') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only submit your own requests'
            });
        }

        if (request.status !== 'draft' && request.status !== 'returned') {
            return res.status(400).json({
                error: 'Invalid status',
                message: 'Only draft or returned requests can be submitted'
            });
        }

        if (!request.Items || request.Items.length === 0) {
            return res.status(400).json({
                error: 'No items',
                message: 'Request must have at least one item before submission'
            });
        }

        // Use workflow system to find the first approver
        const workflowResult = await processWorkflowOnSubmit('item_request', {
            department_id: request.department_id
        });

        let nextApprovers = [];

        if (workflowResult && (workflowResult.approvers || workflowResult.approver)) {
            // Handle multiple approvers
            if (workflowResult.approvers && Array.isArray(workflowResult.approvers)) {
                nextApprovers = workflowResult.approvers;
            } else {
                nextApprovers = [workflowResult.approver];
            }

            // Save explicit current step ID and pending approvers
            if (workflowResult.step) {
                request.current_step_id = workflowResult.step.id;
                request.pending_approver_ids = nextApprovers.map(a => a.id);
            }

            console.log(`✅ Found ${nextApprovers.length} approver(s) from workflow (Step: ${workflowResult.step?.step_name})`);
        } else {
            // Fallback to old logic if no workflow found
            console.warn('⚠️ No workflow found, using fallback approver logic');
            const fallbackApprover = await User.findOne({
                where: {
                    department_id: request.department_id,
                    role: 'department_approver',
                    is_active: true
                }
            });
            if (fallbackApprover) {
                nextApprovers = [fallbackApprover];
            }
        }

        if (nextApprovers.length === 0) {
            return res.status(400).json({
                error: 'No approver found',
                message: 'No active approver found for this request. Please contact your administrator.'
            });
        }

        // Update request status and submission time
        await request.update({
            status: 'submitted',
            submitted_at: new Date(),
            current_step_id: request.current_step_id,
            pending_approver_ids: request.pending_approver_ids
        });

        // Create approval records records
        const stepApprovalType = 'department_approval';

        if (workflowResult.step && workflowResult.step.approval_logic === 'all') {
            // Create an approval record for EACH approver
            console.log(`Generating individual approval records for ${nextApprovers.length} approvers (Logic: ALL)`);
            for (const approver of nextApprovers) {
                const [app, created] = await Approval.findOrCreate({
                    where: {
                        request_id: request.id,
                        approval_type: stepApprovalType,
                        approver_id: approver.id
                    },
                    defaults: {
                        status: 'pending'
                    }
                });

                if (!created && app.status !== 'pending') {
                    // Reset if resubmitting
                    await app.update({ status: 'pending', approved_at: null, declined_at: null });
                }
            }
        } else {
            // "Any" logic: Create one generic record (assigned to first approver or just existing)
            const [approval, created] = await Approval.findOrCreate({
                where: {
                    request_id: request.id,
                    approval_type: stepApprovalType
                },
                defaults: {
                    approver_id: nextApprovers[0].id,
                    status: 'pending'
                }
            });

            // If approval already exists (resubmission), reset it to pending
            if (!created) {
                await approval.update({
                    approver_id: nextApprovers[0].id,
                    status: 'pending',
                    approved_at: null,
                    declined_at: null,
                    returned_at: null,
                    return_reason: null,
                    comments: null
                });
            }
        }

        // Reload request with relations for email
        const requestWithRelations = await Request.findByPk(id, {
            include: [
                { model: User, as: 'Requestor' },
                { model: Department, as: 'Department' }
            ]
        });

        // Send email notifications
        try {
            const primaryApprover = nextApprovers[0];
            await emailService.notifyRequestSubmitted(requestWithRelations, requestWithRelations.Requestor, primaryApprover);

            // Notify ALL approvers
            for (const approver of nextApprovers) {
                if (approver.email) {
                    await emailService.notifyApprovalRequired(requestWithRelations, requestWithRelations.Requestor, approver);
                }
            }
        } catch (emailError) {
            console.error('Failed to send email notifications:', emailError);
            // Don't fail the request if email fails
        }

        // Audit Log: Request Submitted
        await logAudit({
            req,
            action: 'SUBMIT',
            entityType: 'Request',
            entityId: request.id,
            details: {
                status: 'submitted',
                itemCount: request.Items ? request.Items.length : 0,
                approversCount: nextApprovers.length
            }
        });

        res.json({
            message: 'Request submitted successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: request.status,
                submittedAt: request.submitted_at
            }
        });
    } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({
            error: 'Failed to submit request',
            message: error.message
        });
    }
};

// Approve request
export const approveRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { comments, estimatedCompletionDate, processingNotes, signature } = req.body;

        const request = await Request.findByPk(id, {
            include: [
                { model: User, as: 'Requestor' },
                { model: Department, as: 'Department' },
                { model: Approval, as: 'Approvals' }
            ]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to approve this request'
            });
        }

        // Dynamic Workflow Logic: Find current step
        const currentStep = await findCurrentStepForApprover('item_request', req.user, request.status, {
            department_id: request.department_id,
            current_step_id: request.current_step_id
        });

        // Fallback: If no workflow step, check legacy logic permissions
        if (!currentStep) {
            if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to approve this request (No workflow step matched)'
                });
            }
        }

        let approvalType;
        let newStatus = 'completed';
        let nextStep = null;
        let nextApprovers = [];

        // Determine Logic Strategy
        if (currentStep) {
            approvalType = currentStep.step_name.toLowerCase().replace(/ /g, '_');

            // Find NEXT step
            const nextStepResult = await processWorkflowOnApproval('item_request', {
                department_id: request.department_id
            }, currentStep.step_order);

            if (nextStepResult && nextStepResult.step) {
                nextStep = nextStepResult.step;
                newStatus = currentStep.status_on_approval || 'unknown_status';

                if (nextStepResult.approvers && Array.isArray(nextStepResult.approvers)) {
                    nextApprovers = nextStepResult.approvers;
                } else if (nextStepResult.approver) {
                    nextApprovers = [nextStepResult.approver];
                }

                // Update request pending state
                request.current_step_id = nextStep.id;
                request.pending_approver_ids = nextApprovers.map(a => a.id);

            } else {
                // Final step
                newStatus = currentStep.status_on_completion || currentStep.status_on_approval || 'completed';
                request.current_step_id = null;
                request.pending_approver_ids = [];
            }
        } else {
            // Legacy Logic (Fallback)
            if (request.status === 'submitted' && req.user.canApproveForDepartment(request.department_id)) {
                approvalType = 'department_approval';
                newStatus = 'department_approved';
            } else if (request.status === 'department_approved' && req.user.canApproveAsITManager()) {
                approvalType = 'it_manager_approval';
                newStatus = 'it_manager_approved';
            } else if (request.status === 'it_manager_approved' && req.user.canProcessRequests()) {
                approvalType = 'service_desk_processing';
                newStatus = 'service_desk_processing';
            } else if (request.status === 'service_desk_processing' && req.user.canProcessRequests()) {
                approvalType = 'service_desk_processing';
                newStatus = 'completed';
            } else {
                return res.status(400).json({
                    error: 'Invalid status',
                    message: 'Request cannot be approved at this stage'
                });
            }
            request.pending_approver_ids = []; // Legacy path doesn't optimize this
        }

        // Find or create approval record
        // Prioritize specific user record (for 'all' logic)
        let approval = await Approval.findOne({
            where: {
                request_id: request.id,
                approval_type: approvalType,
                approver_id: req.user.id
            }
        });

        if (!approval) {
            // Fallback for 'any' logic scenarios
            approval = await Approval.findOne({
                where: {
                    request_id: request.id,
                    approval_type: approvalType
                }
            });
        }

        if (!approval) {
            approval = await Approval.create({
                request_id: request.id,
                approval_type: approvalType,
                approver_id: req.user.id,
                status: 'pending'
            });
        }

        // Update approval
        approval.approve(comments);
        approval.approver_id = req.user.id;
        if (estimatedCompletionDate) approval.estimated_completion_date = estimatedCompletionDate;
        if (processingNotes) approval.processing_notes = processingNotes;
        if (signature) approval.signature = signature;
        await approval.save();

        // Check if step is fully complete
        let isStepComplete = true;
        if (currentStep) {
            isStepComplete = await checkStepCompletion(currentStep, request.id);
        }

        if (isStepComplete) {
            // Update request status
            await request.update({
                status: newStatus,
                current_step_id: request.current_step_id,
                pending_approver_ids: request.pending_approver_ids,
                ...(newStatus === 'completed' && { completed_at: new Date() })
            });

            // Create next approval if needed
            if (nextStep && nextApprovers.length > 0) {
                // NEW: Create all approval records if next step requires 'all'
                if (nextStep.approval_logic === 'all') {
                    const nextType = nextStep.step_name.toLowerCase().replace(/ /g, '_');
                    for (const approver of nextApprovers) {
                        await Approval.findOrCreate({
                            where: { request_id: request.id, approval_type: nextType, approver_id: approver.id },
                            defaults: { status: 'pending' }
                        });
                    }
                } else {
                    // Legacy/Any logic: Create one generic
                    const nextType = nextStep.step_name.toLowerCase().replace(/ /g, '_');
                    await Approval.findOrCreate({
                        where: {
                            request_id: request.id,
                            approval_type: nextType
                        },
                        defaults: {
                            approver_id: nextApprovers[0].id,
                            status: 'pending'
                        }
                    });
                }
            }

            // Reload request with approver info for email
            await request.reload({
                include: [
                    { model: User, as: 'Requestor' },
                    { model: Department, as: 'Department' }
                ]
            });

            // Send email notifications
            try {
                // Notify requestor of approval
                await emailService.notifyRequestApproved(request, request.Requestor, req.user, approvalType);

                // Notify ALL next approvers
                for (const approver of nextApprovers) {
                    if (approver.email) {
                        await emailService.notifyApprovalRequired(request, request.Requestor, approver);
                    }
                }
            } catch (emailError) {
                console.error('Failed to send email notifications:', emailError);
                // Don't fail the request if email fails
            }
        } else {
            console.log(`ℹ️ Step '${currentStep.step_name}' partially approved. Waiting for others.`);

            // Remove current approver from pending list so it no longer shows as "Action Required" for them
            if (request.pending_approver_ids && Array.isArray(request.pending_approver_ids)) {
                const updatedPending = request.pending_approver_ids.filter(id => id !== req.user.id);
                await request.update({
                    pending_approver_ids: updatedPending
                });
            }
        }

        // Audit Log
        await logAudit({
            req,
            action: 'APPROVE',
            entityType: 'Request',
            entityId: request.id,
            details: {
                newStatus,
                comments,
                approvalType
            }
        });

        res.json({
            message: 'Request approved successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: newStatus
            }
        });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({
            error: 'Failed to approve request',
            message: error.message
        });
    }
};

// Decline request
export const declineRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { comments, signature } = req.body;

        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        if (!request.canBeApprovedBy(req.user)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to decline this request'
            });
        }

        let approvalType;
        let newStatus;

        // Dynamic Workflow Logic: Find current step
        const currentStep = await findCurrentStepForApprover('item_request', req.user, request.status, {
            department_id: request.department_id,
            current_step_id: request.current_step_id
        });

        // Fallback: If no workflow step, check legacy logic permissions
        if (!currentStep) {
            if (!request.canBeApprovedBy(req.user)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to decline this request'
                });
            }
        }

        if (currentStep) {
            approvalType = currentStep.step_name.toLowerCase().replace(/ /g, '_');
            if (currentStep.step_name.includes('Department')) newStatus = 'department_declined';
            else if (currentStep.step_name.includes('IT Manager')) newStatus = 'it_manager_declined';
            else newStatus = 'declined'; // Generic
        } else {
            // Legacy Logic
            if (request.status === 'submitted' && req.user.canApproveForDepartment(request.department_id)) {
                approvalType = 'department_approval';
                newStatus = 'department_declined';
            } else if (request.status === 'department_approved' && req.user.canApproveAsITManager()) {
                approvalType = 'it_manager_approval';
                newStatus = 'it_manager_declined';
            } else {
                return res.status(400).json({
                    error: 'Invalid status',
                    message: 'Request cannot be declined at this stage'
                });
            }
        }

        // Find or create approval record
        let approval = await Approval.findOne({
            where: {
                request_id: request.id,
                approval_type: approvalType
            }
        });

        if (!approval) {
            approval = await Approval.create({
                request_id: request.id,
                approval_type: approvalType,
                approver_id: req.user.id,
                status: 'pending'
            });
        }

        // Update approval
        approval.decline(comments);
        approval.approver_id = req.user.id;
        if (signature) approval.signature = signature;
        await approval.save();

        // Update request status
        await request.update({
            status: newStatus,
            current_step_id: null,
            pending_approver_ids: []
        });

        // Reload request with relations for email
        await request.reload({
            include: [
                { model: User, as: 'Requestor' },
                { model: Department, as: 'Department' }
            ]
        });

        // Send email notification
        try {
            await emailService.notifyRequestDeclined(request, request.Requestor, req.user, comments);
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the request if email fails
        }

        // Audit Log
        await logAudit({
            req,
            action: 'DECLINE',
            entityType: 'Request',
            entityId: request.id,
            details: {
                newStatus,
                comments,
                approvalType
            }
        });

        res.json({
            message: 'Request declined successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: newStatus
            }
        });
    } catch (error) {
        console.error('Error declining request:', error);
        res.status(500).json({
            error: 'Failed to decline request',
            message: error.message
        });
    }
};

// Return request for revision
export const returnRequest = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { returnReason, returnTo = 'requestor', signature } = req.body;

        console.log('Return request - ID:', id, 'Reason:', returnReason, 'ReturnTo:', returnTo);

        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        if (!request.canBeApprovedBy(req.user)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to return this request'
            });
        }

        let approvalType;
        let newStatus = 'returned';

        // Dynamic Workflow Logic: Find current step
        const currentStep = await findCurrentStepForApprover('item_request', req.user, request.status, {
            department_id: request.department_id,
            current_step_id: request.current_step_id
        });

        // Fallback: If no workflow step, AND no legacy permission
        if (!currentStep) {
            if (!request.canBeApprovedBy(req.user)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to return this request'
                });
            }
        }

        if (currentStep) {
            approvalType = currentStep.step_name.toLowerCase().replace(/ /g, '_');

            if (returnTo === 'department_approver' && currentStep.step_order > 1) {
                newStatus = 'submitted';
            } else {
                newStatus = 'returned'; // Back to requestor
            }

        } else {
            // Legacy Logic
            if (request.status === 'submitted' && req.user.canApproveForDepartment(request.department_id)) {
                approvalType = 'department_approval';
            } else if (request.status === 'department_approved' && req.user.canApproveAsITManager()) {
                approvalType = 'it_manager_approval';
                if (returnTo === 'department_approver') {
                    newStatus = 'submitted'; // Return to department approval stage
                }
            } else {
                return res.status(400).json({
                    error: 'Invalid status',
                    message: 'Request cannot be returned at this stage'
                });
            }
        }

        // Find or create approval record
        let approval = await Approval.findOne({
            where: {
                request_id: request.id,
                approval_type: approvalType
            }
        });

        if (!approval) {
            approval = await Approval.create({
                request_id: request.id,
                approval_type: approvalType,
                approver_id: req.user.id,
                status: 'pending'
            });
        }

        // Update approval
        approval.returnForRevision(returnReason);
        approval.approver_id = req.user.id;
        if (signature) approval.signature = signature;
        await approval.save();

        // Update request status
        const updateData = { status: newStatus };

        // If returning to requestor, clear submitted_at
        if (returnTo === 'requestor') {
            updateData.submitted_at = null;
        }

        // If returning, clear workflow progress
        updateData.current_step_id = null;
        updateData.pending_approver_ids = [];

        await request.update(updateData);

        // Reload request with relations for email
        await request.reload({
            include: [
                { model: User, as: 'Requestor' },
                { model: Department, as: 'Department' }
            ]
        });

        // Send email notification
        try {
            await emailService.notifyRequestReturned(request, request.Requestor, req.user, returnReason);
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the request if email fails
        }

        // Audit Log
        await logAudit({
            req,
            action: 'RETURN',
            entityType: 'Request',
            entityId: request.id,
            details: {
                newStatus,
                returnReason,
                returnedTo: returnTo
            }
        });

        res.json({
            message: `Request returned to ${returnTo === 'department_approver' ? 'Department Approver' : 'Requestor'} successfully`,
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: newStatus,
                returnedTo: returnTo
            }
        });
    } catch (error) {
        console.error('Error returning request:', error);
        res.status(500).json({
            error: 'Failed to return request',
            message: error.message
        });
    }
};

// Cancel request
export const cancelRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        // Only requestor or admin can cancel
        if (request.requestor_id !== req.user.id && req.user.role !== 'super_administrator') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only cancel your own requests'
            });
        }

        // Cannot cancel completed requests
        if (['completed', 'cancelled'].includes(request.status)) {
            return res.status(400).json({
                error: 'Invalid status',
                message: 'Cannot cancel completed or already cancelled requests'
            });
        }

        await request.update({ status: 'cancelled' });

        res.json({
            message: 'Request cancelled successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number,
                status: 'cancelled'
            }
        });
    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).json({
            error: 'Failed to cancel request',
            message: error.message
        });
    }
};

// Delete draft request
export const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        // Check permissions
        const isSuperAdmin = req.user.role === 'super_administrator';
        const isODHCApprover = req.user.role === 'department_approver' && req.user.Department?.name?.toUpperCase().includes('ODHC');
        const isOwner = req.user.id === request.requestor_id;

        if (isSuperAdmin || isODHCApprover) {
            // Admin and ODHC can delete any request
        } else if (isOwner) {
            // Requestor can only delete their own draft requests
            if (request.status !== 'draft') {
                return res.status(400).json({
                    error: 'Invalid status',
                    message: 'Only draft requests can be deleted'
                });
            }
        } else {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to delete this request'
            });
        }

        // Delete the request (cascade will delete related items and approvals)
        await request.destroy();

        // Audit Log
        await logAudit({
            req,
            action: 'DELETE',
            entityType: 'Request',
            entityId: id,
            details: {
                requestNumber: request.request_number,
                reason: 'Draft deleted by user'
            }
        });

        res.json({
            message: 'Draft request deleted successfully',
            request: {
                id: request.id,
                requestNumber: request.request_number
            }
        });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({
            error: 'Failed to delete request',
            message: error.message
        });
    }
};

// Get request statistics
export const getStats = async (req, res) => {
    try {
        let whereClause = {};

        // Role-based filtering
        if (req.user.role === 'requestor') {
            whereClause.requestor_id = req.user.id;
        } else if (req.user.role === 'department_approver') {
            whereClause.department_id = req.user.department_id;
        }

        const stats = await Request.findAll({
            where: whereClause,
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const statusCounts = {
            draft: 0,
            submitted: 0,
            department_approved: 0,
            department_declined: 0,
            it_manager_approved: 0,
            it_manager_declined: 0,
            service_desk_processing: 0,
            completed: 0,
            cancelled: 0,
            returned: 0
        };

        stats.forEach(stat => {
            statusCounts[stat.status] = parseInt(stat.count);
        });

        // Calculate total excluding drafts for non-requestor roles
        let total;
        if (req.user.role === 'requestor') {
            total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
        } else {
            // Exclude drafts from total for other roles
            const { draft, ...countsWithoutDraft } = statusCounts;
            total = Object.values(countsWithoutDraft).reduce((sum, count) => sum + count, 0);
        }

        res.json({
            stats: statusCounts,
            total: total
        });
    } catch (error) {
        console.error('Error fetching request statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
};

// Public endpoint: Track request
export const trackRequest = async (req, res) => {
    try {
        const { ticketCode } = req.params;

        // Find the request by ticket code
        const request = await Request.findOne({
            where: { request_number: ticketCode },
            include: [
                {
                    model: User,
                    as: 'Requestor',
                    attributes: ['id', 'first_name', 'last_name', 'username']
                },
                {
                    model: Department,
                    as: 'Department',
                    attributes: ['id', 'name']
                },
                {
                    model: RequestItem,
                    as: 'Items'
                },
                {
                    model: Approval,
                    as: 'Approvals',
                    include: [
                        {
                            model: User,
                            as: 'Approver',
                            attributes: ['id', 'first_name', 'last_name', 'username', 'role', 'title']
                        }
                    ]
                }
            ],
            order: [
                [{ model: Approval, as: 'Approvals' }, 'created_at', 'ASC']
            ]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'No request found with this ticket code. Please check the code and try again.'
            });
        }

        // Build timeline of events
        const timeline = [];

        // Get all approvals and sort by stage order
        const approvals = request.Approvals || [];
        console.log('🔍 Tracking request:', request.request_number);
        console.log('📊 Request status:', request.status);
        console.log('📋 Approvals found:', approvals.map(a => ({ approval_type: a.approval_type, status: a.status, approver: a.Approver?.username })));

        const approvalStages = [
            'department_approval',
            'it_manager_approval',
            'service_desk_processing'
        ];

        // 1. Request submitted - Always completed
        // Extract created_at properly from Sequelize object
        const requestDataForTimeline = request.toJSON ? request.toJSON() : request;
        const createdAtForTimeline = requestDataForTimeline.created_at || request.created_at || request.createdAt || requestDataForTimeline.createdAt;

        timeline.push({
            stage: 'submitted',
            status: 'Request Submitted',
            timestamp: createdAtForTimeline,
            completedBy: {
                name: `${request.Requestor.first_name} ${request.Requestor.last_name}`,
                username: request.Requestor.username
            },
            description: 'Request has been submitted',
            isPending: false,
            isCompleted: true
        });

        // 2. Add all approval stages (both completed and pending)
        let lastApprovedStage = null;
        let hasBeenDeclined = false;

        for (let index = 0; index < approvalStages.length; index++) {
            const stage = approvalStages[index];

            // If a previous stage was declined, don't add subsequent stages
            if (hasBeenDeclined) {
                console.log(`⏭️ Skipping stage ${stage} - previous stage was declined`);
                break;
            }

            const approval = approvals.find(a => a.approval_type === stage);
            let stageName = '';
            let description = '';

            console.log(`🔍 Processing stage ${stage}:`, approval ? `status=${approval.status}, approver=${approval.Approver?.username}` : 'No approval record');

            switch (stage) {
                case 'department_approval':
                    stageName = 'Department Approval';
                    if (!approval || approval.status === 'pending') {
                        description = 'Waiting for department approver to review';
                    } else if (approval.status === 'approved') {
                        description = 'Approved by department approver';
                    } else if (approval.status === 'declined') {
                        description = 'Declined by department approver';
                    }
                    break;
                case 'it_manager_approval':
                    stageName = 'IT Manager Approval';
                    if (!approval || approval.status === 'pending') {
                        description = 'Waiting for IT Manager to review';
                    } else if (approval.status === 'approved') {
                        description = 'Approved by IT Manager';
                    } else if (approval.status === 'declined') {
                        description = 'Declined by IT Manager';
                    }
                    break;
                case 'service_desk_processing':
                    stageName = 'Service Desk Processing';
                    if (!approval || approval.status === 'pending') {
                        description = 'Waiting for Service Desk to process';
                    } else if (approval.status === 'approved') {
                        // Only say "Completed" if request is actually completed
                        // Otherwise, it's still being processed
                        if (request.status === 'completed') {
                            description = 'Completed by Service Desk';
                        } else {
                            description = 'Processing by Service Desk';
                        }
                    } else if (approval.status === 'declined') {
                        description = 'Declined by Service Desk';
                    }
                    break;
            }

            // Check approval status
            // For Service Desk Processing, only mark as completed if request status is actually "completed"
            // (Service Desk Processing can be approved twice - first time sets status to service_desk_processing,
            // second time sets it to completed)
            let isApproved = approval && approval.status === 'approved';
            let isDeclined = approval && approval.status === 'declined';

            // Special handling for Service Desk Processing step
            if (stage === 'service_desk_processing' && isApproved && request.status !== 'completed') {
                // Approval exists but request is not completed yet - this is the first approval
                // Mark as pending/in-progress, not completed
                isApproved = false;
            }

            const isPending = !isApproved && !isDeclined;

            if (isApproved) {
                lastApprovedStage = index;
            }

            // Use approved_at or declined_at for individual approval dates (not updated_at)
            let approvalTimestamp = null;
            if (isApproved && approval.approved_at) {
                approvalTimestamp = approval.approved_at;
            } else if (isDeclined && approval.declined_at) {
                approvalTimestamp = approval.declined_at;
            } else if (isApproved || isDeclined) {
                // Fallback to updated_at if specific timestamp not available
                approvalTimestamp = approval.updated_at;
            }

            timeline.push({
                stage: stage,
                status: stageName,
                timestamp: approvalTimestamp,
                completedBy: (isApproved || isDeclined) && approval.Approver
                    ? {
                        name: `${approval.Approver.first_name} ${approval.Approver.last_name}`,
                        username: approval.Approver.username,
                        role: approval.Approver.role
                    }
                    : null,
                description,
                comments: approval?.comments || null,
                isPending: isPending,
                isCompleted: isApproved,
                isDeclined: isDeclined
            });

            console.log(`✅ Stage ${stage}: isPending=${isPending}, isCompleted=${isApproved}, isDeclined=${isDeclined}`);

            // If declined, mark flag and break to stop adding further stages
            if (isDeclined) {
                hasBeenDeclined = true;
                console.log(`🛑 Stage ${stage} was declined - stopping timeline here`);
                break;
            }
        }

        // Ensure submittedDate is always available (use created_at or timeline first entry)
        // Use the same extraction logic as timeline
        const submittedDate = createdAtForTimeline || request.submitted_at ||
            (timeline.length > 0 ? timeline[0].timestamp : null);

        // Return public-safe data
        res.json({
            ticketCode: request.request_number,
            status: request.status,
            priority: request.priority,
            submittedDate: submittedDate,
            submittedBy: `${request.Requestor.first_name} ${request.Requestor.last_name}`,
            department: request.Department?.name,
            purpose: request.reason,
            timeline,
            items: request.Items.map(item => ({
                category: item.category,
                itemDescription: item.item_description,
                quantity: item.quantity,
                specifications: item.proposed_specs
            }))
        });
    } catch (error) {
        console.error('Error tracking request:', error);
        res.status(500).json({
            error: 'Failed to track request',
            message: error.message
        });
    }
};
