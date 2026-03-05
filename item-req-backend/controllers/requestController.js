import { Op } from 'sequelize';
import { validationResult } from 'express-validator';
import { Request, RequestItem, Approval, User, Department, Category, AuditLog, ApprovalMatrix, sequelize } from '../models/index.js';

import { processWorkflowOnSubmit, findCurrentStepForApprover, processWorkflowOnApproval, checkStepCompletion } from '../utils/workflowProcessor.js';
import { logAudit, calculateChanges } from '../utils/auditLogger.js';
import emailService from '../utils/emailService.js';

// Generate sequential reference ID (ITR-MMDD-00001)
export async function generateReferenceId() {
    const now = new Date();
    // const year = String(now.getFullYear()).slice(-2); // YY - removed as per request
    const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(now.getDate()).padStart(2, '0'); // DD
    // Prefix format for current request: ITR-MMDD-
    const currentPrefix = `ITR-${month}${day}-`;

    // Find last request globally (to keep sequence continuous)
    const lastRequest = await Request.findOne({
        where: {
            request_number: {
                [Op.like]: `ITR-%`
            }
        },
        order: [['created_at', 'DESC']],
        attributes: ['request_number']
    });

    let sequence = 1;
    if (lastRequest && lastRequest.request_number) {
        // Expected format: ITR-MMDD-XXXXX
        const parts = lastRequest.request_number.split('-');
        if (parts.length === 3) {
            sequence = parseInt(parts[2], 10) + 1;
        }
    }

    return `${currentPrefix}${String(sequence).padStart(5, '0')}`;
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
            // DYNAMIC: Find all departments this user is assigned to via ApprovalMatrix
            // IMPORTANT: filter by form_type 'item_request' so that vehicle_request global
            // rules (e.g. ODHC approver) don't bleed into item request visibility.
            excludeDrafts = true;

            const matrixRules = await ApprovalMatrix.findAll({
                where: { user_id: req.user.id, is_active: true, form_type: 'item_request' },
                attributes: ['department_id']
            });

            const hasGlobalRule = matrixRules.some(r => r.department_id === null);

            if (hasGlobalRule) {
                // Global item_request rule — can see requests from all departments
                console.log(`🌐 User ${req.user.id} has a GLOBAL item_request matrix rule — showing all departments`);
            } else {
                // Collect all assigned department IDs from matrix
                const assignedDeptIds = new Set(
                    matrixRules.map(r => r.department_id).filter(id => id != null)
                );
                // Also include their own registered department
                if (req.user.department_id) assignedDeptIds.add(req.user.department_id);

                if (assignedDeptIds.size > 0) {
                    whereClause.department_id = { [Op.in]: Array.from(assignedDeptIds) };
                    console.log(`🏢 User ${req.user.id} can see departments: ${Array.from(assignedDeptIds).join(', ')}`);
                } else {
                    // Fallback: own department only
                    whereClause.department_id = req.user.department_id;
                }
            }
        } else if (req.user.role === 'it_manager' || req.user.role === 'endorser') {
            // DYNAMIC: Show requests where this user is or was an approver
            excludeDrafts = true;
            const myApprovals = await Approval.findAll({
                where: { approver_id: req.user.id },
                attributes: ['request_id']
            });
            const myRequestIds = [...new Set(myApprovals.map(a => a.request_id))];
            // Also include requests currently pending on this user (pending_approver_ids)
            // We union both: past approvals + currently pending
            whereClause[Op.or] = [
                ...(myRequestIds.length > 0 ? [{ id: { [Op.in]: myRequestIds } }] : []),
                sequelize.where(
                    sequelize.literal(`${req.user.id} = ANY(pending_approver_ids)`),
                    true
                )
            ];
            if (whereClause[Op.or].length === 0) {
                // No approvals yet — show nothing
                whereClause.id = -1;
            }
        } else if (req.user.role === 'service_desk') {
            // DYNAMIC: Same as IT Manager — show only assigned requests
            excludeDrafts = true;
            const myApprovals = await Approval.findAll({
                where: { approver_id: req.user.id },
                attributes: ['request_id']
            });
            const myRequestIds = [...new Set(myApprovals.map(a => a.request_id))];
            whereClause[Op.or] = [
                ...(myRequestIds.length > 0 ? [{ id: { [Op.in]: myRequestIds } }] : []),
                sequelize.where(
                    sequelize.literal(`${req.user.id} = ANY(pending_approver_ids)`),
                    true
                )
            ];
            if (whereClause[Op.or].length === 0) {
                whereClause.id = -1;
            }
        } else if (req.user.role === 'super_administrator') {
            // Super administrators see everything (non-draft)
            excludeDrafts = true;
        } else {
            // ── Universal fallback for any other role (e.g. a department_approver who is
            //    also assigned as 'endorser' via the Approval Matrix) ──────────────────
            // Show: requests where they are or were an actual approver (Approval log)
            //       OR where they are currently in pending_approver_ids
            excludeDrafts = true;
            const myApprovals = await Approval.findAll({
                where: { approver_id: req.user.id },
                attributes: ['request_id']
            });
            const myRequestIds = [...new Set(myApprovals.map(a => a.request_id))];
            whereClause[Op.or] = [
                ...(myRequestIds.length > 0 ? [{ id: { [Op.in]: myRequestIds } }] : []),
                sequelize.where(
                    sequelize.literal(`${req.user.id} = ANY(pending_approver_ids)`),
                    true
                )
            ];
            if (whereClause[Op.or].length === 0) {
                whereClause.id = -1; // No activity — show nothing
            }
        }

        // ── Universal Verifier Visibility ─────────────────────────────────────────
        // Any user can be assigned as an ad-hoc verifier (verifier_id on Request).
        // The role-based filter above won't include these requests unless we explicitly
        // add them. We do this by fetching the verifier's assigned request IDs and
        // merging them into the existing whereClause via an OR.
        if (req.user.role !== 'super_administrator') {
            const verifierRequestIds = (await Request.findAll({
                where: { verifier_id: req.user.id },
                attributes: ['id'],
                raw: true
            })).map(r => r.id);

            if (verifierRequestIds.length > 0) {
                const verifierOr = { id: { [Op.in]: verifierRequestIds } };
                if (whereClause[Op.or]) {
                    // Already has OR clause (endorser, it_manager, service_desk, fallback)
                    whereClause[Op.or] = [...whereClause[Op.or], verifierOr];
                    // If we added a catch-all id=-1 guard, remove it now since we have real IDs
                    if (whereClause.id === -1) delete whereClause.id;
                } else if (whereClause.requestor_id !== undefined) {
                    // Requestor path: convert simple equality to OR
                    const requestorClause = { requestor_id: whereClause.requestor_id };
                    delete whereClause.requestor_id;
                    whereClause[Op.or] = [requestorClause, verifierOr];
                } else if (whereClause.department_id !== undefined) {
                    // Department approver path: convert to OR
                    const deptClause = { department_id: whereClause.department_id };
                    delete whereClause.department_id;
                    whereClause[Op.or] = [deptClause, verifierOr];
                }
                // super_admin has no restrictions — no change needed
                console.log(`🔍 User ${req.user.id} is a verifier for request(s): [${verifierRequestIds.join(', ')}] — added to visible scope`);
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Apply filters
        if (status) {
            if (status === 'draft') {
                // Any user can filter for their own drafts
                // For non-requestors, we need to union their own drafts with their existing scope OR clause
                if (whereClause[Op.or]) {
                    // They already have an OR clause — add own drafts to it
                    whereClause[Op.or].push({ requestor_id: req.user.id, status: 'draft' });
                    // Remove the status filter that would clash; the OR handles it
                } else {
                    // Simple case: just add a status filter
                    whereClause.status = 'draft';
                    // And restrict to own requests so others don't see someone else's drafts
                    if (req.user.role !== 'super_administrator') {
                        whereClause.requestor_id = req.user.id;
                    }
                }
                // Don't set excludeDrafts since we explicitly want drafts
                excludeDrafts = false;
            } else if (status.startsWith('verification_')) {
                // Special filter: filter by verification_status, not status
                const verificationStatusMap = {
                    'verification_pending': 'pending',
                    'verification_verified': 'verified',
                    'verification_declined': 'declined'
                };
                const verificationStatus = verificationStatusMap[status];
                if (verificationStatus) {
                    whereClause.verification_status = verificationStatus;
                }
            } else {
                whereClause.status = status;
            }
        } else if (excludeDrafts) {
            // No status filter — exclude drafts for non-requestors EXCEPT their own
            if (req.user.role !== 'super_administrator') {
                whereClause.status = { [Op.ne]: 'draft' };
                // But allow their own drafts via OR
                if (!whereClause[Op.or]) {
                    whereClause[Op.or] = [{ requestor_id: req.user.id, status: 'draft' }, { status: { [Op.ne]: 'draft' } }];
                    delete whereClause.status;
                }
            } else {
                whereClause.status = { [Op.ne]: 'draft' };
            }
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
            distinct: true,
            col: 'id',
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
                updatedAt: request.updatedAt || request.updated_at,
                sdStartedAt: request.sd_started_at,
                verification_status: request.verification_status,
                verifier_id: request.verifier_id,
                approvals: request.Approvals?.map(approval => ({
                    id: approval.id,
                    type: approval.approval_type,
                    approval_type: approval.approval_type,
                    status: approval.status,
                    approver: approval.Approver ? {
                        id: approval.Approver.id,
                        fullName: `${approval.Approver.first_name} ${approval.Approver.last_name}`
                    } : null,
                    comments: approval.comments,
                    createdAt: approval.created_at,
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
                        attributes: ['id', 'username', 'first_name', 'last_name', 'role', 'title'],
                        include: [{
                            model: Department,
                            as: 'Department',
                            attributes: ['id', 'name']
                        }]
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
        let canAccess =
            req.user.role === 'super_administrator' ||
            req.user.role === 'it_manager' ||
            req.user.role === 'endorser' ||
            req.user.role === 'service_desk' ||
            request.requestor_id === req.user.id ||
            request.verifier_id === req.user.id; // assigned verifier can always view

        // For department_approver: dynamically check ApprovalMatrix scoped to item_request
        // IMPORTANT: must filter by form_type so vehicle_request global rules don't bleed in
        if (!canAccess && req.user.role === 'department_approver') {
            if (request.department_id === req.user.department_id) {
                canAccess = true;
            } else {
                // Check if they're assigned to this department via item_request ApprovalMatrix
                const matrixRule = await ApprovalMatrix.findOne({
                    where: {
                        user_id: req.user.id,
                        is_active: true,
                        form_type: 'item_request',
                        [Op.or]: [
                            { department_id: request.department_id },
                            { department_id: null } // global item_request rule only
                        ]
                    }
                });
                canAccess = !!matrixRule;
            }
        }

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
                sdStartedAt: request.sd_started_at,
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
                    urgencyReason: item.urgency_reason,
                    isReturned: item.is_returned,
                    returnedAt: item.returned_at,
                    dateRequired: item.date_required,
                    itRemarks: item.it_remarks,
                    approvalStatus: item.approval_status,
                    endorserStatus: item.endorser_status,
                    endorserRemarks: item.endorser_remarks,
                    original_quantity: item.original_quantity // Include original_quantity
                })) || [],
                verificationStatus: request.verification_status,
                verifierId: request.verifier_id,
                verifierReason: request.verifier_reason,
                verifiedAt: request.verified_at,
                verifierComments: request.verifier_comments,
                approvals: request.Approvals?.map(approval => ({
                    id: approval.id,
                    type: approval.approval_type,
                    status: approval.status,
                    approver: approval.Approver ? {
                        id: approval.Approver.id,
                        username: approval.Approver.username,
                        fullName: `${approval.Approver.first_name} ${approval.Approver.last_name}`,
                        role: approval.Approver.role,
                        title: approval.Approver.title || '',
                        Department: approval.Approver.Department ? {
                            name: approval.Approver.Department.name
                        } : null
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

                    // Enhanced canApprove check:
                    // 1. Check dynamic workflow (pending_approver_ids)
                    // 2. Fallback to static model logic (canBeApprovedBy)
                    let canApprove = false;
                    if (request.pending_approver_ids && request.pending_approver_ids.includes(req.user.id)) {
                        canApprove = true;
                    } else {
                        canApprove = request.canBeApprovedBy(req.user);
                    }

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

        // Super admins can create requests for any department; others must use their own department
        if (req.user.role !== 'super_administrator' && req.user.department_id !== departmentId) {
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
            request_number: await generateReferenceId(),
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
                urgency_reason: item.urgencyReason || null,
                priority: (item.priority && item.priority !== '') ? item.priority : (priority || 'medium'),
                date_required: (item.dateRequired && item.dateRequired !== '') ? item.dateRequired : (dateRequired || null),
                date_required: (item.dateRequired && item.dateRequired !== '') ? item.dateRequired : (dateRequired || null),
                comments: item.comments || null,
                it_remarks: item.itRemarks || null
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

        // If IT Manager is editing, they shouldn't change the requestor signature or other fields ideally, 
        // but current logic is permissive. We assume frontend controls what's sent.

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
                    urgency_reason: item.urgencyReason || null,
                    date_required: item.dateRequired || null,
                    it_remarks: item.itRemarks || null,
                    approval_status: item.approvalStatus || 'pending'
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
        const { comments, estimatedCompletionDate, processingNotes, signature, items } = req.body;

        const request = await Request.findByPk(id, {
            include: [
                { model: User, as: 'Requestor' },
                { model: Department, as: 'Department' },
                { model: Approval, as: 'Approvals' },
                { model: RequestItem, as: 'Items' } // Include items to update them
            ]
        });

        if (!request) {
            return res.status(404).json({
                error: 'Request not found',
                message: 'The requested equipment request does not exist'
            });
        }

        // Update items if provided (e.g. Dept Approver verification or IT Manager remarks)
        const changes = []; // Track detailed changes for audit log

        if (items && Array.isArray(items)) {
            // We only update specific fields relevant to approval actions to be safe:
            // - approval_status (Dept Approver)
            // - it_remarks (IT Manager)
            // - comments (Additional notes)
            // - We typically don't allow changing core item details (category, qty) during approval unless specifically needed.

            // To refer to items accurately, we iterate existing items and update match by ID? 
            // Or simpler: full replace like updateRequest? 
            // Full replace is safer for UI consistency but risky if IDs change.
            // Let's stick to update loop for existing items since we likely just want to update status/remarks.

            // Let's stick to update loop for existing items since we likely just want to update status/remarks.

            for (const itemData of items) {
                // Find matching item by ID if possible, or fallback
                // Assuming items in payload have IDs if they exist
                if (itemData.id) {
                    const itemToUpdate = request.Items.find(i => i.id === itemData.id);
                    if (itemToUpdate) {
                        const updates = {
                            approval_status: itemData.approvalStatus || itemToUpdate.approval_status,
                            it_remarks: itemData.itRemarks || itemToUpdate.it_remarks,
                            endorser_status: itemData.endorserStatus || itemToUpdate.endorser_status,
                            endorser_remarks: itemData.endorserRemarks || itemToUpdate.endorser_remarks
                        };

                        // Check for Quantity Change (IT Manager)
                        if (itemData.quantity && parseInt(itemData.quantity) !== itemToUpdate.quantity) {
                            const newQty = parseInt(itemData.quantity);
                            console.log(`ℹ️ Qty change detected for Item ${itemToUpdate.id}: ${itemToUpdate.quantity} -> ${newQty}`);

                            // If original_quantity is not set (null or undefined), this is the first edit.
                            // Save the current DB value as original.
                            if (itemToUpdate.original_quantity == null) {
                                console.log(`ℹ️ Saving original quantity: ${itemToUpdate.quantity}`);
                                updates.original_quantity = itemToUpdate.quantity;
                                updates.original_quantity = itemToUpdate.quantity;
                            } else {
                                console.log(`ℹ️ Original quantity already set: ${itemToUpdate.original_quantity}`);
                            }
                            updates.quantity = newQty;
                            changes.push(`Item '${itemToUpdate.category}' quantity changed from ${itemToUpdate.quantity} to ${newQty}`);
                        }

                        if (itemData.itRemarks && itemData.itRemarks !== itemToUpdate.it_remarks) {
                            changes.push(`Item '${itemToUpdate.category}' remarks updated`);
                        }

                        await itemToUpdate.update(updates);
                    }
                }
            }
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
                    message: 'You do not have permission to approve this request'
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
            // No workflow step found via dynamic lookup.
            // This happens for terminal-ish statuses like 'ready_to_deploy', 'pr_approved',
            // 'service_desk_processing' which are short-circuited in findCurrentStepForApprover.
            // If the user has process permission (service desk), allow completion via legacy path.
            if (request.canBeProcessedBy(req.user)) {
                console.log(`ℹ️ No workflow step found, but user ${req.user.id} has process permission. Using legacy completion path.`);
                approvalType = 'service_desk_processing';
                newStatus = 'completed';
                request.current_step_id = null;
                request.pending_approver_ids = [];
            } else {
                console.warn(`⚠️ No workflow step found for user ${req.user.id} on request ${request.id} (status: ${request.status})`);
                return res.status(400).json({
                    error: 'No workflow configured',
                    message: 'No workflow step found for your role on this request. Please ask your administrator to configure a workflow in Workflow Setup.'
                });
            }
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
            // Pre-flight check for STOCK REPLENISHMENT if completing
            if (newStatus === 'completed') {
                console.log('🔍 Checking stock availability before completion...');
                const { replenishments } = req.body;
                console.log('📦 Received Replenishments Payload:', JSON.stringify(replenishments, null, 2));

                // We need to fetch items to check stock
                const requestItems = await RequestItem.findAll({ where: { request_id: request.id } });

                for (const item of requestItems) {
                    if (item.approval_status === 'rejected') continue;

                    const category = await Category.findOne({ where: { name: item.category } });
                    if (category && category.track_stock) {
                        // Check if we need replenishment
                        if (category.quantity < item.quantity) {
                            console.log(`⚠️ Low stock for ${category.name}: Stock ${category.quantity} < Requested ${item.quantity}`);

                            // Debug ID matching
                            const itemId = item.id;
                            console.log(`🔎 Looking for replenishment for Item ID: ${itemId} (Type: ${typeof itemId})`);

                            // Ensure replenishments object exists
                            const safeReplenishments = replenishments || {};
                            console.log(`📦 Available Replenishment Keys:`, Object.keys(safeReplenishments));

                            // Try lookup with number and string key
                            const replenishment = safeReplenishments[itemId] || safeReplenishments[String(itemId)];
                            console.log(`✅ Found replenishment for ${itemId}:`, replenishment);

                            if (!replenishment) {
                                console.error(`❌ Missing replenishment for Item ID ${itemId}. content:`, safeReplenishments);
                                throw new Error(`Insufficient stock for ${category.name} (Stock: ${category.quantity}, Requested: ${item.quantity}). Please provide replenishment details.`);
                            }

                            const { prNumber, addedQty } = replenishment;

                            // Validate Replenishment
                            if (!prNumber || !/^\d{8}$/.test(prNumber)) {
                                throw new Error(`Invalid PR Number for ${category.name}. Must be 8 digits.`);
                            }
                            if (!addedQty || parseInt(addedQty) <= 0) {
                                throw new Error(`Invalid Quantity for ${category.name}. Must be greater than 0.`);
                            }

                            // Apply Replenishment
                            const supplyQty = parseInt(addedQty);
                            const newStock = category.quantity + supplyQty;

                            // Audit/Log the replenishment (Optional: create a separate log or note)
                            console.log(`📦 Replenishing ${category.name}: ${category.quantity} + ${supplyQty} = ${newStock} (PR: ${prNumber})`);

                            await category.update({
                                quantity: newStock,
                                stock_updated_at: new Date()
                            });

                            // Helper to log this specific action if needed
                        }
                    }
                }
            }

            // Compute sd_started_at before the update changes updatedAt.
            // Case 1: entering service_desk_processing now → stamp the current time.
            // Case 2: already in service_desk_processing but sd_started_at is NULL
            //         (request predates this feature) → use the current updatedAt,
            //         which is when the request last transitioned to this status.
            const shouldSetSdStartedAt = !request.sd_started_at && (
                newStatus === 'service_desk_processing' ||
                request.status === 'service_desk_processing'
            );
            const sdStartedAtValue = shouldSetSdStartedAt
                ? (request.status === 'service_desk_processing'
                    ? (request.updatedAt || request.updated_at || new Date())  // backfill from current updatedAt
                    : new Date())                                               // fresh transition
                : undefined;

            // Update request status
            await request.update({
                status: newStatus,
                current_step_id: request.current_step_id,
                pending_approver_ids: request.pending_approver_ids,
                ...(newStatus === 'completed' && { completed_at: new Date() }),
                ...(sdStartedAtValue !== undefined && { sd_started_at: sdStartedAtValue })
            });

            // Decrement Stock if Completed
            if (newStatus === 'completed') {
                console.log('📉 Decrementing stock for completed request:', request.id);
                // Reload items just to be safe (though we have them if we didn't mutate)
                const completedRequest = await Request.findByPk(request.id, {
                    include: [{ model: RequestItem, as: 'Items' }]
                });

                if (completedRequest && completedRequest.Items) {
                    for (const item of completedRequest.Items) {
                        // Skip if item was rejected or cancelled
                        if (item.approval_status === 'rejected') {
                            console.log(`ℹ️ Skipping stock deduction for REJECTED item: ${item.category}`);
                            continue;
                        }

                        try {
                            const category = await Category.findOne({ where: { name: item.category } });
                            if (category && category.track_stock) {
                                let newQty = category.quantity - item.quantity;
                                // Safety check for negative stock (though we tried to prevent it above)
                                if (newQty < 0) {
                                    console.warn(`⚠️ Stock went negative for ${category.name} after deduction!`);
                                    newQty = 0;
                                }
                                await category.update({ quantity: newQty });
                                console.log(`✅ Decremented ${item.quantity} from ${category.name}. New Qty: ${newQty}`);
                            }
                        } catch (stockError) {
                            console.error(`❌ Failed to decrement stock for item ${item.category}:`, stockError);
                        }
                    }
                }
            }

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

                // Update request with new pending approvers
                await request.update({
                    pending_approver_ids: nextApprovers.map(u => u.id),
                    current_step_id: nextStep.id
                });
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
                // Fetch IT Managers to CC
                const itManagers = await User.findAll({
                    where: { role: 'it_manager' },
                    attributes: ['email']
                });
                const ccEmails = itManagers.map(manager => manager.email).filter(Boolean);

                // Notify requestor of approval and CC IT Managers
                await emailService.notifyRequestApproved(request, request.Requestor, req.user, approvalType, ccEmails);

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
                approvalType,
                signatureUsed: !!signature, // Log if signature was provided
                itemChanges: changes // Use the scoped variable
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

        // Check permission: allow if user can approve/process by legacy logic,
        // OR if they are in the pending_approver_ids (workflow-based assignment).
        const isPendingApprover = Array.isArray(request.pending_approver_ids) &&
            request.pending_approver_ids.includes(req.user.id);

        if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user) && !isPendingApprover) {
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
            if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user) && !isPendingApprover) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to decline this request'
                });
            }
        }

        if (currentStep) {
            approvalType = currentStep.step_name.toLowerCase().replace(/ /g, '_');
            if (currentStep.step_name.toLowerCase().includes('department')) newStatus = 'department_declined';
            else if (currentStep.step_name.toLowerCase().includes('it manager') || currentStep.step_name.toLowerCase().includes('it_manager')) newStatus = 'it_manager_declined';
            else if (currentStep.step_name.toLowerCase().includes('endors')) newStatus = 'endorser_declined';
            // Generic fallback: derive from current request status
            else if (request.status === 'submitted') newStatus = 'department_declined';
            else if (request.status === 'department_approved' || request.status === 'checked_endorsed') newStatus = 'it_manager_declined';
            else newStatus = 'department_declined'; // Safe default — always a valid enum value
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

        // Check permission: allow if user can approve/process by legacy logic,
        // OR if they are in the pending_approver_ids (workflow-based assignment).
        // This is needed for 'returned' status where canBeApprovedBy only checks 'submitted'.
        const isPendingApprover = Array.isArray(request.pending_approver_ids) &&
            request.pending_approver_ids.includes(req.user.id);

        if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user) && !isPendingApprover) {
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
            if (!request.canBeApprovedBy(req.user) && !request.canBeProcessedBy(req.user) && !isPendingApprover) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to return this request'
                });
            }
        }

        if (currentStep) {
            approvalType = currentStep.step_name.toLowerCase().replace(/ /g, '_');

            if (returnTo === 'department_approver' && currentStep.step_order > 1) {
                newStatus = 'returned';
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

        if (returnTo === 'department_approver') {
            // Re-route back to Step 1: find it and re-assign the dept approver
            try {
                const { processWorkflowOnSubmit } = await import('../utils/workflowProcessor.js');
                const step1Result = await processWorkflowOnSubmit('item_request', {
                    department_id: request.department_id,
                    requestor_id: request.requestor_id
                });
                if (step1Result && step1Result.step) {
                    updateData.current_step_id = step1Result.step.id;
                    const approverIds = (step1Result.approvers || (step1Result.approver ? [step1Result.approver] : []))
                        .map(a => a.id);
                    updateData.pending_approver_ids = approverIds;
                    console.log(`🔁 Returned to dept approver: step_id=${step1Result.step.id}, approvers=[${approverIds.join(', ')}]`);
                } else {
                    // Fallback: clear so legacy logic handles it
                    updateData.current_step_id = null;
                    updateData.pending_approver_ids = [];
                }
            } catch (wfErr) {
                console.error('Could not re-route to Step 1 on return:', wfErr);
                updateData.current_step_id = null;
                updateData.pending_approver_ids = [];
            }
        } else {
            // Returning to requestor — clear workflow progress and submitted_at
            updateData.submitted_at = null;
            updateData.current_step_id = null;
            updateData.pending_approver_ids = [];
        }

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
            // Filter by item_request ApprovalMatrix only (not vehicle_request rules)
            const matrixRules = await ApprovalMatrix.findAll({
                where: { user_id: req.user.id, is_active: true, form_type: 'item_request' },
                attributes: ['department_id']
            });
            const hasGlobalRule = matrixRules.some(r => r.department_id === null);
            if (!hasGlobalRule) {
                const deptIds = new Set(matrixRules.map(r => r.department_id).filter(Boolean));
                if (req.user.department_id) deptIds.add(req.user.department_id);
                whereClause.department_id = deptIds.size > 0
                    ? { [Op.in]: Array.from(deptIds) }
                    : req.user.department_id;
            }
            // If hasGlobalRule — no dept filter (they see all item_request stats)
        } else if (['it_manager', 'service_desk', 'endorser'].includes(req.user.role)) {
            // IT Manager, Service Desk, and Endorser: only see stats for requests they are involved with
            // (same logic as getAllRequests) — requests where they approved/actioned OR are pending approvers
            const myApprovals = await Approval.findAll({
                where: { approver_id: req.user.id },
                attributes: ['request_id']
            });
            const myRequestIds = [...new Set(myApprovals.map(a => a.request_id))];
            whereClause[Op.or] = [
                ...(myRequestIds.length > 0 ? [{ id: { [Op.in]: myRequestIds } }] : []),
                sequelize.where(
                    sequelize.literal(`${req.user.id} = ANY(pending_approver_ids)`),
                    true
                )
            ];
            if (whereClause[Op.or].length === 0) {
                whereClause.id = -1; // nothing visible
            }
        }

        // ── Universal Verifier Visibility (mirror of getAllRequests) ──────────────
        // Include any requests where this user is assigned as verifier so stat
        // counts match what the table shows.
        if (req.user.role !== 'super_administrator') {
            const verifierReqIds = (await Request.findAll({
                where: { verifier_id: req.user.id },
                attributes: ['id'],
                raw: true
            })).map(r => r.id);

            if (verifierReqIds.length > 0) {
                const verifierOr = { id: { [Op.in]: verifierReqIds } };
                if (whereClause[Op.or]) {
                    whereClause[Op.or] = [...whereClause[Op.or], verifierOr];
                    if (whereClause.id === -1) delete whereClause.id;
                } else if (whereClause.requestor_id !== undefined) {
                    const tmp = whereClause.requestor_id;
                    delete whereClause.requestor_id;
                    whereClause[Op.or] = [{ requestor_id: tmp }, verifierOr];
                } else if (whereClause.department_id !== undefined) {
                    const tmp = whereClause.department_id;
                    delete whereClause.department_id;
                    whereClause[Op.or] = [{ department_id: tmp }, verifierOr];
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        const stats = await Request.findAll({
            where: whereClause,
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const verificationStatsData = await Request.findAll({
            where: {
                [Op.and]: [
                    whereClause,
                    { verification_status: { [Op.in]: ['pending', 'verified', 'declined'] } }
                ]
            },
            attributes: [
                "verification_status",
                [sequelize.fn("COUNT", sequelize.col("id")), "count"]
            ],
            group: ["verification_status"],
            raw: true
        });

        const statusCounts = {
            draft: 0,
            submitted: 0,
            department_approved: 0,
            department_declined: 0,
            checked_endorsed: 0,
            endorser_declined: 0,
            it_manager_approved: 0,
            it_manager_declined: 0,
            service_desk_processing: 0,
            pr_approved: 0,
            ready_to_deploy: 0,
            completed: 0,
            cancelled: 0,
            returned: 0
        };

        const verificationCounts = {
            pending: 0,
            verified: 0,
            declined: 0
        };

        stats.forEach(stat => {
            statusCounts[stat.status] = parseInt(stat.count);
        });

        verificationStatsData.forEach(stat => {
            verificationCounts[stat.verification_status] = parseInt(stat.count);
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

        // Get dynamic "Pending My Approval" count
        // Scoped to the same whereClause so it matches what the table shows.
        const pendingMyApproval = await Request.count({
            where: {
                ...whereClause,
                pending_approver_ids: {
                    [Op.contains]: [req.user.id]
                },
                status: {
                    [Op.ne]: 'draft'
                }
            }
        });

        res.json({
            stats: {
                ...statusCounts,
                pendingMyApproval // Dynamic count
            },
            verificationStats: verificationCounts,
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
            'endorser',
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

            // Find matching approval record using both legacy and dynamic naming conventions
            const approval = approvals.find(a => {
                if (stage === 'endorser' && (a.approval_type === 'endorser' || a.approval_type === 'endorser_approval')) return true;
                if (stage === 'department_approval' && (a.approval_type === 'department_approval' || a.approval_type === 'department')) return true;
                if (stage === 'it_manager_approval' && (a.approval_type === 'it_manager_approval' || a.approval_type === 'it_manager')) return true;
                if (stage === 'service_desk_processing' && (a.approval_type === 'service_desk_processing' || a.approval_type === 'service_desk')) return true;
                return a.approval_type === stage;
            });
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
                case 'endorser':
                case 'endorser_approval':
                    stageName = 'Endorser Approval';
                    if (!approval || approval.status === 'pending') {
                        description = 'Waiting for endorser to review';
                    } else if (approval.status === 'approved') {
                        description = 'Checked and endorsed';
                    } else if (approval.status === 'declined') {
                        description = 'Declined by endorser';
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

                    if (request.status === 'pr_approved') {
                        stageName = 'Service Desk Processing (PR Approved)';
                        description = 'PR has been approved. Request is being processed.';
                    } else if (!approval || approval.status === 'pending') {
                        description = 'Waiting for Service Desk to process';
                    } else if (approval.status === 'approved') {
                        // Always say processing, as completion is now a separate "Deployed" step
                        description = 'Processing by Service Desk';
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

            // IF no approval record exists but the request status implies it has passed, mark it as approved
            // E.g., if status is 'it_manager_approved', then 'department_approval' and 'endorser' must be done.
            if (!isApproved && !isDeclined && request.status !== 'draft' && request.status !== 'submitted') {
                const statusOrder = {
                    'department_approved': 1,
                    'checked_endorsed': 2,
                    'endorser_approved': 2,
                    'it_manager_approved': 3,
                    'service_desk_processing': 4,
                    'pr_approved': 5,
                    'ready_to_deploy': 6,
                    'completed': 7
                };

                const currentStageRank = {
                    'department_approval': 1,
                    'endorser': 2,
                    'it_manager_approval': 3,
                    'service_desk_processing': 4
                }[stage] || 0;

                const reqStatusRank = statusOrder[request.status] || 0;

                if (reqStatusRank > 0 && reqStatusRank >= currentStageRank) {
                    isApproved = true;
                    if (!approval) {
                        description = 'Approved (Auto-completed/Legacy)';
                    }
                }
            }

            // Special handling for Service Desk Processing step
            // Mark as completed if request has moved to ready_to_deploy, pr_approved, or completed
            if (stage === 'service_desk_processing') {
                if (['ready_to_deploy', 'pr_approved', 'completed'].includes(request.status)) {
                    // Service Desk has processed the request and moved it forward
                    isApproved = true;
                } else if (isApproved && request.status !== 'completed') {
                    // Approval exists but request hasn't moved forward yet
                    isApproved = false;
                }
            }

            const isPending = !isApproved && !isDeclined;

            if (isApproved) {
                lastApprovedStage = index;
            }

            // Use approved_at or declined_at for individual approval dates (not updated_at)
            let approvalTimestamp = null;
            if (approval) {
                if (isApproved && approval.approved_at) {
                    approvalTimestamp = approval.approved_at;
                } else if (isDeclined && approval.declined_at) {
                    approvalTimestamp = approval.declined_at;
                } else if (isApproved || isDeclined) {
                    // Fallback to updated_at if specific timestamp not available
                    approvalTimestamp = approval.updated_at;
                }
            }
            // If we inferred approval but had no record, use request updated_at
            if (isApproved && !approvalTimestamp) {
                approvalTimestamp = request.updated_at || request.updatedAt;
            }

            // Special handling for Service Desk Processing timestamp
            // Use START time (created_at) instead of completion time so it appears before Deployed
            if (stage === 'service_desk_processing' && isApproved && approval) {
                approvalTimestamp = approval.created_at || approval.createdAt;
                // Also update description to be clearer
                if (description === 'Processing by Service Desk' || description === 'Approved (Auto-completed/Legacy)') {
                    description = 'Processing started by Service Desk';
                }
            }

            timeline.push({
                stage: stage,
                status: stageName,
                timestamp: approvalTimestamp,
                completedBy: (isApproved || isDeclined) && approval?.Approver
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

            if (isDeclined) {
                hasBeenDeclined = true;
                console.log(`🛑 Stage ${stage} was declined - stopping timeline here`);
                break;
            }
        }

        // 3. Post-Processing Stages (PR Approval & Deployment/Completion)
        // These don't always have explicit 'approval' records in the approvals array if they are just status transitions
        // so we add them based on the request status.

        // Fetch Audit Logs for this request to get precise timestamps
        // We do this here to avoid N+1 queries if we were doing it inside loops, though we only need it for the timeline
        const requestAuditLogs = await AuditLog.findAll({
            where: {
                entity_type: 'Request', // Ensure this matches what is stored (might be 'Request' or 'item_request' - check saving logic or use both)
                entity_id: String(request.id)
            },
            attributes: ['action', 'created_at', 'details']
        });

        // Helper to find log timestamp with flexible filtering
        const getLogTimestamp = (filterFn) => {
            const log = requestAuditLogs
                .filter(filterFn)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]; // Get latest
            return log ? log.created_at : null;
        };

        // START: PR Approved Event - ONLY show if request actually went through pr_approved status
        // Check audit logs to see if pr_approved was ever set
        const prTimestamp = getLogTimestamp(l =>
            (l.action === 'APPROVE_PR') || // Legacy/Invalid attempt
            (l.action === 'APPROVE' && l.details && (l.details.newStatus === 'pr_approved' || l.details.approvalType === 'pr_approval'))
        );

        if (!hasBeenDeclined && prTimestamp) {
            // Only add PR Approved to timeline if we have actual evidence it happened
            timeline.push({
                stage: 'pr_approved',
                status: 'PR Approved',
                timestamp: prTimestamp,
                completedBy: null,
                description: 'Purchase Request approved',
                isPending: false,
                isCompleted: true,
                isDeclined: false
            });
        }
        // END: PR Approved Event

        // START: Ready to Deploy Event (In Stock Workflow) - ONLY show if request actually went through ready_to_deploy status
        // Check audit logs to see if ready_to_deploy was ever set
        const readyToDeployTimestamp = getLogTimestamp(l =>
            l.action === 'APPROVE' && l.details && (l.details.newStatus === 'ready_to_deploy' || l.details.approvalType === 'ready_to_deploy')
        );

        if (!hasBeenDeclined && readyToDeployTimestamp) {
            // Only add Ready to Deploy to timeline if we have actual evidence it happened
            timeline.push({
                stage: 'ready_to_deploy',
                status: 'Ready to Deploy',
                timestamp: readyToDeployTimestamp,
                completedBy: null,
                description: 'All items are in stock and ready for deployment',
                isPending: false,
                isCompleted: true,
                isDeclined: false
            });
        }
        // END: Ready to Deploy Event

        // START: Deployed / Completed Event
        if (!hasBeenDeclined && request.status === 'completed') {
            // Find 'APPROVE' action where newStatus was 'completed'
            const completionTimestamp = getLogTimestamp(l =>
                l.action === 'APPROVE' && l.details && l.details.newStatus === 'completed'
            ) || request.updated_at || request.updatedAt || request.createdAt;

            timeline.push({
                stage: 'deployed',
                status: 'Deployed',
                timestamp: completionTimestamp,
                completedBy: null,
                description: 'Items deployed and request completed',
                isPending: false,
                isCompleted: true,
                isDeclined: false
            });
        }
        // END: Deployed Event

        // ── Pending Verification step (always appended after workflow steps if verifier assigned) ──
        const reqData = request.toJSON ? request.toJSON() : request;
        const verificationStatus = reqData.verification_status || request.verification_status;
        const verifierId = reqData.verifier_id || request.verifier_id;
        const verifiedAt = reqData.verified_at || request.verified_at;
        const verifierComments = reqData.verifier_comments || request.verifier_comments;

        if (verifierId) {
            const isVerifPending = verificationStatus === 'pending';
            const isVerifDone = verificationStatus === 'verified';
            const isVerifDeclined = verificationStatus === 'declined';

            timeline.push({
                stage: 'pending_verification',
                status: isVerifDone
                    ? 'Verified'
                    : isVerifDeclined
                        ? 'Verification Declined'
                        : 'Pending Verification',
                timestamp: isVerifPending ? null : (verifiedAt || reqData.updated_at),
                completedBy: null,
                description: isVerifDone
                    ? 'Request has been verified by the assigned verifier'
                    : isVerifDeclined
                        ? 'Verification was declined by the assigned verifier'
                        : 'Request is awaiting verification by the assigned verifier',
                comments: verifierComments || null,
                isPending: isVerifPending,
                isCompleted: isVerifDone,
                isDeclined: isVerifDeclined,
                isCancelled: false
            });
        }

        // START: Cancelled Event
        if (request.status === 'cancelled') {
            const cancelTimestamp = getLogTimestamp(l => l.action === 'CANCEL') || request.updated_at || request.updatedAt;
            timeline.push({
                stage: 'cancelled',
                status: 'Cancelled',
                timestamp: cancelTimestamp,
                completedBy: null,
                description: 'This request has been cancelled',
                comments: request.cancellation_reason || request.comments || null,
                isPending: false,
                isCompleted: false,
                isDeclined: false,
                isCancelled: true
            });
        }
        // END: Cancelled Event

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

// Restock item (Return to Inventory)
export const restockItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;

        // Verify permissions (only Service Desk or Admin)
        if (!req.user.canProcessRequests()) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only Service Desk or Admins can restock items'
            });
        }

        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const item = await RequestItem.findOne({
            where: {
                id: itemId,
                request_id: id
            }
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found in this request' });
        }

        if (item.is_returned) {
            return res.status(400).json({ error: 'Item is already returned to inventory' });
        }

        // Find Category and Increment Stock
        const category = await Category.findOne({ where: { name: item.category } });

        let stockMessage = '';
        if (category && category.track_stock) {
            const newQty = category.quantity + item.quantity;
            await category.update({ quantity: newQty });
            stockMessage = `Stock updated for ${category.name}: ${category.quantity} -> ${newQty}`;
        } else {
            stockMessage = 'Category not tracked or not found - Stock not updated';
        }

        // Mark Item as Returned
        await item.update({
            is_returned: true,
            returned_at: new Date()
        });

        // Audit Log
        await logAudit({
            req,
            action: 'RESTOCK',
            entityType: 'RequestItem',
            entityId: item.id,
            details: {
                requestNumber: request.request_number,
                itemCategory: item.category,
                quantity: item.quantity,
                stockUpdate: stockMessage
            }
        });

        res.json({
            message: 'Item returned to inventory successfully',
            item: {
                id: item.id,
                is_returned: true,
                returned_at: item.returned_at
            }
        });

    } catch (error) {
        console.error('Error restocking item:', error);
        res.status(500).json({
            error: 'Failed to restock item',
            message: error.message
        });
    }
};

// Delete Request Item (Service Desk)
export const deleteRequestItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;

        // Verify permissions (only Service Desk or Admin)
        // Request.canProcessRequests logic might need to be checked or duplicated if not available on req.user directly here properly, 
        // but assuming it works as per previous code.
        // Actually, let's stick to safe role check if canProcessRequests isn't guaranteed on req.user object in this context (it should be if middleware sets it, but simple role check is safer).
        if (!['service_desk', 'super_administrator'].includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only Service Desk or Admins can delete request items'
            });
        }

        const item = await RequestItem.findOne({
            where: {
                id: itemId,
                request_id: id
            }
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Audit Log
        const request = await Request.findByPk(id);
        await logAudit({
            req,
            action: 'DELETE_ITEM',
            entityType: 'RequestItem',
            entityId: item.id,
            details: {
                requestNumber: request ? request.request_number : 'Unknown',
                itemCategory: item.category,
                reason: 'Deleted from deployed assets'
            }
        });

        await item.destroy();

        res.json({ message: 'Item deleted successfully' });

    } catch (error) {
        console.error('Error deleting request item:', error);
        res.status(500).json({
            error: 'Failed to delete item',
            message: error.message
        });
    }
};

// Upload attachment
export const uploadAttachments = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Check permissions (Requestor or Service Desk/Admin)
        // Requestors can only upload if draft or returned
        // Approvers/Service Desk can upload if processing

        let canUpload = false;
        if (req.user.id === request.requestor_id) {
            if (['draft', 'returned'].includes(request.status)) canUpload = true;
        } else if (['service_desk', 'super_administrator'].includes(req.user.role)) {
            // Service desk can upload anytime (e.g. attaching quotes, PRs)
            canUpload = true;
        } else if (req.user.role === 'department_approver' && request.department_id === req.user.department_id) {
            // Department approver might want to attach something? Maybe not for now, stick to requirements.
            // But existing code for vehicle requests allows approvers. Let's allow service desk specifically.
        }

        if (!canUpload) {
            return res.status(403).json({ success: false, message: 'Permission denied or invalid status for upload' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const newAttachments = req.files.map(file => ({
            originalName: file.originalname,
            filename: file.filename,
            path: `/uploads/${file.filename}`,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date(),
            uploadedBy: {
                id: req.user.id,
                name: `${req.user.first_name} ${req.user.last_name}`
            }
        }));

        // Append to existing attachments
        const existingAttachments = request.attachments || [];
        const updatedAttachments = [...existingAttachments, ...newAttachments];

        await request.update({ attachments: updatedAttachments });

        await logAudit({
            req,
            action: 'UPDATE',
            entityType: 'Request',
            entityId: id,
            details: { message: `Uploaded ${newAttachments.length} attachment(s)` }
        });

        res.json({
            success: true,
            message: 'Attachments uploaded successfully',
            attachments: updatedAttachments
        });
    } catch (error) {
        console.error('Error uploading attachments:', error);
        res.status(500).json({ success: false, message: 'Failed to upload attachments', error: error.message });
    }
};

// Delete attachment
export const deleteAttachment = async (req, res) => {
    try {
        const { id, index } = req.params;
        const request = await Request.findByPk(id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Check permissions
        const canDelete = req.user.id === request.requestor_id || ['service_desk', 'super_administrator'].includes(req.user.role);
        if (!canDelete) {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }

        const attachments = request.attachments || [];
        const attachmentIndex = parseInt(index);

        if (isNaN(attachmentIndex) || attachmentIndex < 0 || attachmentIndex >= attachments.length) {
            return res.status(400).json({ success: false, message: 'Invalid attachment index' });
        }

        const deletedAttachment = attachments[attachmentIndex];

        // Remove from array
        const updatedAttachments = attachments.filter((_, i) => i !== attachmentIndex);

        await request.update({ attachments: updatedAttachments });

        await logAudit({
            req,
            action: 'UPDATE',
            entityType: 'Request',
            entityId: id,
            details: { message: `Deleted attachment: ${deletedAttachment.originalName}` }
        });

        res.json({
            success: true,
            message: 'Attachment deleted successfully',
            attachments: updatedAttachments
        });
    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ success: false, message: 'Failed to delete attachment', error: error.message });
    }
};

// Approve PR
export const approvePR = async (req, res) => {
    try {
        const { id } = req.params;
        const { replenishments } = req.body; // Expect replenishments here

        console.log(`[${new Date().toISOString()}] Received Payload: ${JSON.stringify(req.body)}`);

        // Ensure user is service desk or admin
        if (!['service_desk', 'super_administrator'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Only Service Desk can approve PRs' });
        }

        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Validate attachments exist
        if (!request.attachments || request.attachments.length === 0) {
            return res.status(400).json({ success: false, message: 'Cannot approve PR without attachments (e.g. PR document)' });
        }

        // Validate status - PR can only be approved when in service_desk_processing
        if (request.status !== 'service_desk_processing') {
            return res.status(400).json({
                success: false,
                message: 'PR can only be approved when request is in Service Desk Processing status. Please approve the request first.'
            });
        }

        // --- Replenishment Logic ---
        if (replenishments) {
            console.log('📦 Processing Replenishments for PR Approval:', JSON.stringify(replenishments));

            // Fetch items to match
            const requestItems = await RequestItem.findAll({ where: { request_id: request.id } });

            for (const item of requestItems) {
                if (item.approval_status === 'rejected') continue;

                // Lookup replenishment data (robust key check)
                const itemId = item.id;
                const replenishment = replenishments[itemId] || replenishments[String(itemId)];

                if (replenishment) {
                    const category = await Category.findOne({ where: { name: item.category } });
                    if (category && category.track_stock) {
                        const { prNumber, addedQty } = replenishment;

                        // Validate
                        if (!prNumber || !/^\d{8}$/.test(prNumber)) {
                            throw new Error(`Invalid PR Number for ${category.name}. Must be 8 digits.`);
                        }
                        if (!addedQty || parseInt(addedQty) <= 0) {
                            throw new Error(`Invalid Quantity for ${category.name}. Must be greater than 0.`);
                        }

                        // Update Stock
                        const supplyQty = parseInt(addedQty);
                        const newStock = category.quantity + supplyQty;

                        await category.update({
                            quantity: newStock,
                            stock_updated_at: new Date()
                        });

                        console.log(`✅ Stock Replenished for ${category.name}: +${supplyQty} -> ${newStock} (PR: ${prNumber})`);

                        // Log specific replenishment action
                        await logAudit({
                            req,
                            action: 'RESTOCK', // Using RESTOCK or UPDATE
                            entityType: 'Category',
                            entityId: category.id,
                            details: {
                                message: `Stock replenished via PR Approval`,
                                addedQty: supplyQty,
                                prNumber: prNumber,
                                newTotal: newStock
                            }
                        });
                    }
                }
            }
        }
        // ---------------------------

        // Update status and clear workflow step to allow completion
        const oldStatus = request.status;
        await request.update({
            status: 'pr_approved',
            current_step_id: null,
            pending_approver_ids: []
        });

        await logAudit({
            req,
            action: 'APPROVE', // Use standard enum value
            entityType: 'Request',
            entityId: id,
            details: {
                previousStatus: oldStatus,
                newStatus: 'pr_approved',
                approvalType: 'pr_approval' // Distinct marker for timeline
            }
        });

        res.json({
            success: true,
            message: 'PR Approved and Stock Replenished successfully',
            request: {
                id: request.id,
                status: 'pr_approved'
            }
        });

    } catch (error) {
        console.error('Error approving PR:', error);
        res.status(500).json({ success: false, message: 'Failed to approve PR', error: error.message });
    }
};

// Ready to Deploy (In Stock Workflow)
export const readyToDeploy = async (req, res) => {
    try {
        const { id } = req.params;

        // Ensure user is service desk or admin
        if (!['service_desk', 'super_administrator'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Only Service Desk can mark requests as Ready to Deploy' });
        }

        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Validate status - Can transition from it_manager_approved or service_desk_processing (if mistaken)
        if (!['it_manager_approved', 'service_desk_processing'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                message: 'Request must be IT Manager Approved or Processing to be marked as Ready to Deploy.'
            });
        }

        // Update status and clear workflow step to allow completion
        const oldStatus = request.status;
        await request.update({
            status: 'ready_to_deploy',
            current_step_id: null,
            pending_approver_ids: []
        });

        await logAudit({
            req,
            action: 'APPROVE',
            entityType: 'Request',
            entityId: id,
            details: {
                previousStatus: oldStatus,
                newStatus: 'ready_to_deploy',
                approvalType: 'ready_to_deploy'
            }
        });

        res.json({
            success: true,
            message: 'Request marked as Ready to Deploy',
            request: {
                id: request.id,
                status: 'ready_to_deploy'
            }
        });

    } catch (error) {
        console.error('Error marking as Ready to Deploy:', error);
        res.status(500).json({ success: false, message: 'Failed to update request status', error: error.message });
    }
};

export const assignVerifier = async (req, res) => {
    try {
        const { id } = req.params;
        const { verifier_id, reason } = req.body;

        // Role restriction: Only IT Manager can assign verifier
        if (req.user.role !== 'it_manager') {
            return res.status(403).json({ success: false, message: "Only IT Managers are authorized to assign a verifier." });
        }

        // Fetch the request, the requestor, and the assigned verifier to send the email
        const request = await Request.findByPk(id, {
            include: [
                { model: User, as: 'Requestor' }
            ]
        });
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        const verifier = await User.findByPk(verifier_id);
        if (!verifier) return res.status(404).json({ success: false, message: "Verifier not found" });

        // Update Request
        await request.update({
            verifier_id,
            verifier_reason: reason,
            verification_status: 'pending',
            verified_at: null, // Reset if reassigned
            verifier_comments: null
        });

        // Send Email Notification to Verifier
        await emailService.notifyVerifierAssigned(request, request.Requestor, verifier, reason);

        res.json({ success: true, message: "Verifier assigned successfully" });

    } catch (error) {
        console.error("Error assigning verifier:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body; // status: 'verified' | 'declined'

        if (!['verified', 'declined'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const request = await Request.findByPk(id);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        // Permission Check
        if (request.verifier_id !== req.user.id) {
            return res.status(403).json({ success: false, message: "You are not the assigned verifier for this request." });
        }
        if (request.verification_status !== 'pending') {
            return res.status(400).json({ success: false, message: "This request is not pending verification." });
        }

        // Update Request
        await request.update({
            verification_status: status,
            verified_at: new Date(),
            verifier_comments: comments
        });

        // ---------------------------------------------------------
        // Send Email Notification for Verification Completed
        // ---------------------------------------------------------
        try {
            // Re-fetch request with Requestor to ensure we have the email
            const updatedRequest = await Request.findByPk(id, {
                include: [
                    { model: User, as: 'Requestor', attributes: ['id', 'first_name', 'last_name', 'email', 'username'] }
                ]
            });

            // Fetch IT Managers to CC them
            const itManagers = await User.findAll({
                where: { role: 'it_manager', is_active: true },
                attributes: ['id', 'email', 'first_name', 'last_name']
            });

            // The verifier is req.user
            await emailService.notifyVerificationCompleted(
                updatedRequest,
                updatedRequest.Requestor,
                req.user,
                status,
                comments,
                itManagers
            );
        } catch (emailError) {
            console.error("Error sending verification completion email:", emailError);
            // Don't fail the request verification just because the email failed
        }

        res.json({ success: true, message: "Verification processed successfully", request });

    } catch (error) {
        console.error("Error verifying request:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};