import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Department, Category, Request, ServiceVehicleRequest, Item } from '../models/index.js';

const router = express.Router();

// Define the system instructions to explicitly restrict the AI
const systemInstruction = `
You are the STC Packaging IT Equipment & Vehicle Request Form System Chatbot.
Your ONLY purpose is to assist users regarding this specific system, its data, and processes.

CRITICAL RULES:
1. You must ONLY answer questions using the data provided by the tools (functions) you have access to.
2. Under absolutely NO circumstances should you provide general knowledge, answer questions about topics unrelated to the STC IT Request System, write code, or roleplay.
3. If a user asks a question that cannot be answered using the provided tools, or is outside the scope of the STC IT Equipment & Vehicle Request system, you MUST decline to answer and politely explain your restriction.
4. You have tools to get system info, departments, categories, and recent requests. USE THEM.
5. Be concise and professional.
`;

// Define the tools for Function Calling
const tools = [
    {
        functionDeclarations: [
            {
                name: 'getSystemInfo',
                description: 'Returns general information about the STC IT Equipment and Vehicle Request System.',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'getDepartments',
                description: 'Returns a list of all active departments in the company that can make requests.',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'getCategories',
                description: 'Returns a list of all item categories available for requesting.',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'getRecentRequestsStats',
                description: 'Returns statistics about recent IT and Vehicle requests in the system.',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            }
        ]
    }
];

// Tool implementation handlers
const toolExecutors = {
    getSystemInfo: async () => {
        return {
            appName: "STC Packaging IT Equipment & Vehicle Request Form",
            description: "An internal system for employees to request IT Equipment (laptops, monitors, software) and Service Vehicles. It includes a multi-step approval workflow involving Department managers, IT Managers, and the Service Desk.",
            keyFeatures: [
                "Create, track, and approve IT Equipment Requests.",
                "Request Service Vehicles with driver assignment.",
                "Role-based access (Requestor, Department Approver, IT Manager, Service Desk, Super Admin).",
                "LDAP/Active Directory integration for login.",
                "Automated email notifications."
            ]
        };
    },
    getDepartments: async () => {
        try {
            const departments = await Department.findAll({
                where: { is_active: true },
                attributes: ['name', 'description']
            });
            return departments.map(d => ({ name: d.name, description: d.description }));
        } catch (error) {
            console.error("Error fetching departments:", error);
            return { error: "Could not fetch departments." };
        }
    },
    getCategories: async () => {
        try {
            const categories = await Category.findAll({
                attributes: ['name', 'description', 'track_stock']
            });
            return categories.map(c => ({ name: c.name, description: c.description, requiresStockTracking: c.track_stock }));
        } catch (error) {
            console.error("Error fetching categories:", error);
            return { error: "Could not fetch categories." };
        }
    },
    getRecentRequestsStats: async () => {
        try {
            const itemRequestsCount = await Request.count();
            const pendingItemRequests = await Request.count({ where: { status: 'submitted' } });
            const vehicleRequestsCount = await ServiceVehicleRequest.count();

            return {
                totalItemRequests: itemRequestsCount,
                pendingItemRequests: pendingItemRequests,
                totalVehicleRequests: vehicleRequestsCount
            };
        } catch (error) {
            console.error("Error fetching request stats:", error);
            return { error: "Could not fetch request statistics at this time." };
        }
    }
};

// Route to handle chat messages
router.post('/', async (req, res) => {
    try {
        const { history, message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured in the environment variables.");
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Use gemini-2.5-flash as it's the latest fast model supporting function calling well
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction,
            tools: tools
        });

        // Start a chat session
        const chat = model.startChat({
            history: history || [],
        });

        // Send the user's message
        let result = await chat.sendMessage(message);

        // Check if the model wants to call a function
        let functionCalls = result.response.functionCalls();

        // Process function calls if any
        if (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                const toolName = call.name;

                if (toolExecutors[toolName]) {
                    try {
                        console.log(`🤖 Chatbot is executing tool: ${toolName}`);
                        const apiResponse = await toolExecutors[toolName](call.args);

                        functionResponses.push({
                            functionResponse: {
                                name: toolName,
                                response: apiResponse
                            }
                        });
                    } catch (error) {
                        console.error(`Error executing tool ${toolName}:`, error);
                        functionResponses.push({
                            functionResponse: {
                                name: toolName,
                                response: { error: "An error occurred while executing this function." }
                            }
                        });
                    }
                }
            }

            // Send the function responses back to the model so it can generate a final answer
            if (functionResponses.length > 0) {
                result = await chat.sendMessage(functionResponses);
            }
        }

        // Return the final response text and the updated history
        res.json({
            text: result.response.text(),
            history: await chat.getHistory()
        });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({
            error: 'An error occurred while processing your request.',
            details: error.message
        });
    }
});

export default router;
