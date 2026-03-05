import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/auth.js';
import { Department, Category, Request, ServiceVehicleRequest, RequestItem, Approval, User } from '../models/index.js';

const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Use a capable free/cheap model on OpenRouter that supports function calling
const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

// Service Desk / Technical Support portal URL
const TECHNICAL_SUPPORT_URL = 'http://172.16.1.127:8081/znuny/customer.pl';

// System prompt to restrict the AI to this system's context
const systemPrompt = `You are the PRISM Chatbot.
Your ONLY purpose is to assist users regarding this specific system, its data, and processes.

CRITICAL RULES:
1. You must ONLY answer questions using the data provided by the tools (functions) you have access to.
2. Under absolutely NO circumstances should you provide general knowledge, answer questions about topics unrelated to the PRISM system, write code, or roleplay.
3. If a user asks a question that cannot be answered using the provided tools, or is outside the scope of the PRISM system, you MUST decline to answer and politely explain your restriction.
4. You have tools to get system info, departments, categories, recent requests, technical support info, and request status tracking. USE THEM.
5. When a user asks about technical support, help desk, IT support, or how to raise a ticket, use the getTechnicalSupport tool.
6. When a user asks about the status of a specific request (by providing a request number like ITR-0303-00001), use the getRequestStatus tool.
7. Be concise and professional.`;

// Tool definitions in OpenAI function-calling format
const tools = [
    {
        type: 'function',
        function: {
            name: 'getSystemInfo',
            description: 'Returns general information about the PRISM system.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getDepartments',
            description: 'Returns a list of all active departments in the company that can make requests.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getCategories',
            description: 'Returns a list of all item categories available for requesting.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getRecentRequestsStats',
            description: 'Returns statistics about recent requests in the system.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getTechnicalSupport',
            description: 'Returns technical support and service desk contact information, including the helpdesk portal URL where users can raise a ticket for IT issues or general technical problems.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getRequestStatus',
            description: 'Looks up the current status and approval progress of a specific PRISM request by its request number (e.g. ITR-0303-00001). Use this when the user provides a request number and wants to know its status.',
            parameters: {
                type: 'object',
                required: ['requestNumber'],
                properties: {
                    requestNumber: {
                        type: 'string',
                        description: 'The request reference number, e.g. ITR-0303-00001'
                    }
                }
            }
        }
    }
];

// Tool implementation handlers
const toolExecutors = {
    getSystemInfo: async () => ({
        appName: 'PRISM',
        description:
            'An internal system for employees to request IT Equipment (laptops, monitors, software) and Service Vehicles. It includes a multi-step approval workflow involving Department managers, IT Managers, and the Service Desk.',
        keyFeatures: [
            'Create, track, and approve IT Equipment Requests.',
            'Request Service Vehicles with driver assignment.',
            'Role-based access (Requestor, Department Approver, IT Manager, Service Desk, Super Admin).',
            'LDAP/Active Directory integration for login.',
            'Automated email notifications.'
        ]
    }),

    getDepartments: async () => {
        try {
            const departments = await Department.findAll({
                where: { is_active: true },
                attributes: ['name', 'description']
            });
            return departments.map(d => ({ name: d.name, description: d.description }));
        } catch (error) {
            console.error('Error fetching departments:', error);
            return { error: 'Could not fetch departments.' };
        }
    },

    getCategories: async () => {
        try {
            const categories = await Category.findAll({
                attributes: ['name', 'description', 'track_stock']
            });
            return categories.map(c => ({
                name: c.name,
                description: c.description,
                requiresStockTracking: c.track_stock
            }));
        } catch (error) {
            console.error('Error fetching categories:', error);
            return { error: 'Could not fetch categories.' };
        }
    },

    getRecentRequestsStats: async () => {
        try {
            const totalItemRequests = await Request.count();
            const pendingItemRequests = await Request.count({ where: { status: 'submitted' } });
            const totalVehicleRequests = await ServiceVehicleRequest.count();
            return { totalItemRequests, pendingItemRequests, totalVehicleRequests };
        } catch (error) {
            console.error('Error fetching request stats:', error);
            return { error: 'Could not fetch request statistics at this time.' };
        }
    },

    getTechnicalSupport: async () => ({
        serviceDeskPortal: TECHNICAL_SUPPORT_URL,
        description: 'The IT Service Desk portal (Znuny/OTRS) where you can raise, track, and manage support tickets for any technical issues, hardware problems, or general IT assistance.',
        instructions: [
            '1. Open the portal link in your browser.',
            '2. Log in with your company credentials.',
            '3. Click "New Ticket" to raise a support request.',
            '4. Fill in the subject, category, and description of your issue.',
            '5. Submit the ticket and note your ticket number for follow-up.'
        ],
        note: 'For PRISM-specific requests (IT equipment or vehicle requests), please use the PRISM system directly. The service desk portal is for general technical support issues.'
    }),

    getRequestStatus: async ({ requestNumber }) => {
        try {
            if (!requestNumber) {
                return { error: 'Please provide a request number (e.g. ITR-0303-00001).' };
            }

            const request = await Request.findOne({
                where: { request_number: requestNumber.trim().toUpperCase() },
                include: [
                    {
                        model: User,
                        as: 'Requestor',
                        attributes: ['first_name', 'last_name']
                    },
                    {
                        model: Department,
                        as: 'Department',
                        attributes: ['name']
                    },
                    {
                        model: RequestItem,
                        as: 'Items',
                        attributes: ['category', 'item_description', 'quantity', 'approval_status']
                    },
                    {
                        model: Approval,
                        as: 'Approvals',
                        include: [{
                            model: User,
                            as: 'Approver',
                            attributes: ['first_name', 'last_name', 'role']
                        }],
                        attributes: ['approval_type', 'status', 'comments', 'approved_at', 'declined_at', 'returned_at']
                    }
                ]
            });

            if (!request) {
                return { error: `No request found with number "${requestNumber}". Please double-check the request number and try again.` };
            }

            // Format a human-readable status label
            const statusLabels = {
                draft: 'Draft (not yet submitted)',
                submitted: 'Submitted — Awaiting Department Approval',
                department_approved: 'Department Approved — Awaiting IT Manager Review',
                it_manager_approved: 'IT Manager Approved — Being Processed by Service Desk',
                service_desk_processing: 'Being Processed by Service Desk',
                completed: 'Completed',
                declined: 'Declined',
                it_manager_declined: 'Declined by IT Manager',
                returned: 'Returned for Revision',
                cancelled: 'Cancelled'
            };

            return {
                requestNumber: request.request_number,
                status: request.status,
                statusLabel: statusLabels[request.status] || request.status,
                requestor: request.Requestor ? `${request.Requestor.first_name} ${request.Requestor.last_name}` : 'Unknown',
                department: request.Department?.name || 'Unknown',
                priority: request.priority,
                submittedAt: request.submitted_at,
                completedAt: request.completed_at,
                items: (request.Items || []).map(i => ({
                    category: i.category,
                    description: i.item_description,
                    quantity: i.quantity,
                    approvalStatus: i.approval_status
                })),
                approvals: (request.Approvals || []).map(a => ({
                    type: a.approval_type,
                    status: a.status,
                    approver: a.Approver ? `${a.Approver.first_name} ${a.Approver.last_name}` : 'Unknown',
                    comments: a.comments || null,
                    approvedAt: a.approved_at || null,
                    declinedAt: a.declined_at || null,
                    returnedAt: a.returned_at || null
                }))
            };
        } catch (error) {
            console.error('Error fetching request status:', error);
            return { error: 'Could not retrieve request status. Please try again later.' };
        }
    }
};

// Helper: call OpenRouter chat completions
async function callOpenRouter(messages, useTools = true) {
    const body = {
        model: OPENROUTER_MODEL,
        messages,
        ...(useTools && { tools, tool_choice: 'auto' })
    };

    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://prism.local',
            'X-Title': 'PRISM Chatbot'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    return response.json();
}

// Route to handle chat messages
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { history, message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY is not configured in the environment variables.');
        }

        // Build the messages array: system prompt + prior history + current user message
        // history is stored in Gemini format {role, parts:[{text}]}, convert to OpenAI format {role, content}
        const convertedHistory = (history || []).map(h => ({
            role: h.role === 'model' ? 'assistant' : h.role,
            content: Array.isArray(h.parts) ? h.parts.map(p => p.text).join('') : h.content
        }));

        const messages = [
            { role: 'system', content: systemPrompt },
            ...convertedHistory,
            { role: 'user', content: message }
        ];

        // First call to the model
        let data = await callOpenRouter(messages);
        let assistantMessage = data.choices[0].message;

        // Agentic loop: handle tool calls
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            console.log(`🤖 Chatbot is handling ${assistantMessage.tool_calls.length} tool call(s)...`);

            // Add assistant's tool-call message to the conversation
            messages.push(assistantMessage);

            // Execute each tool call and add results
            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name;
                let toolResult;

                if (toolExecutors[toolName]) {
                    try {
                        console.log(`🔧 Executing tool: ${toolName}`);
                        const args = toolCall.function.arguments
                            ? JSON.parse(toolCall.function.arguments)
                            : {};
                        toolResult = await toolExecutors[toolName](args);
                    } catch (error) {
                        console.error(`Error executing tool ${toolName}:`, error);
                        toolResult = { error: 'An error occurred while executing this function.' };
                    }
                } else {
                    toolResult = { error: `Unknown tool: ${toolName}` };
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });
            }

            // Call the model again with the tool results (no tools needed after data is fetched)
            data = await callOpenRouter(messages, false);
            assistantMessage = data.choices[0].message;
        }

        const responseText = assistantMessage.content || '';

        // Build updated history in the same Gemini-like format the frontend stores
        // so backward compatibility is maintained with ChatbotWidget.jsx
        const updatedHistory = [
            ...convertedHistory,
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: responseText }] }
        ];

        res.json({ text: responseText, history: updatedHistory });
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({
            error: 'An error occurred while processing your request.',
            details: error.message
        });
    }
});

export default router;
