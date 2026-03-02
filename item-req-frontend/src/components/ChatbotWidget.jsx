import React, { useState, useRef, useEffect } from 'react';
import Spline from '@splinetool/react-spline';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const ChatbotWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'model', parts: [{ text: 'Hello! I am your STC IT & Vehicle Request Assistant. How can I help you today?' }] }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');

        // Add user message to UI
        const newMessages = [...messages, { role: 'user', parts: [{ text: userMessage }] }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Gemini API requires the first message in the history to be from 'user'.
            // Remove the initial generic greeting from the history payload to prevent the 
            // `First content should be with role 'user', got model` error in the backend SDK.
            const apiHistory = messages.filter(msg => !(msg.role === 'model' && msg.parts[0].text.startsWith('Hello! I am your STC IT')));

            // Send to API using the configured axios instance
            const response = await api.post('/chat', {
                message: userMessage,
                history: apiHistory // Send filtered history for context
            });

            const data = response.data;

            if (data && data.text) {
                setMessages([...newMessages, { role: 'model', parts: [{ text: data.text }] }]);
            } else {
                throw new Error(data.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages([
                ...newMessages,
                { role: 'model', parts: [{ text: 'Sorry, I encountered an error while processing your request. Please try again later.' }] }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Chatbot Toggle Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl z-50 text-white transition-colors duration-300 ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        className="fixed bottom-24 right-6 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200 dark:border-gray-700 max-h-[calc(100vh-120px)] sm:w-[400px]"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center space-x-2">
                                <Bot size={24} />
                                <h3 className="font-semibold text-lg">STC Assistant</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Spline 3D Scene */}
                        <div className="h-[200px] w-full bg-blue-50/50 dark:bg-gray-900/50 relative overflow-hidden shrink-0 border-b border-gray-200 dark:border-gray-700">
                            <div className="absolute inset-0">
                                <Spline scene="https://prod.spline.design/VfDQAEVxREWv6mj5/scene.splinecode" />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900 space-y-4">
                            {messages.map((msg, idx) => {
                                const isModel = msg.role === 'model';
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, x: isModel ? -10 : 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={idx}
                                        className={`flex ${isModel ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div className={`max-w-[80%] p-3 rounded-2xl flex items-start gap-2 ${isModel
                                            ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm'
                                            : 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                                            }`}>
                                            {isModel && <Bot size={16} className="mt-1 shrink-0 text-blue-500" />}
                                            <div className="text-sm render-markdown prose-sm dark:prose-invert">
                                                {/* We use basic text rendering here, but a markdown parser would be better for complex answers */}
                                                {msg.parts[0].text.split('\n').map((line, i) => (
                                                    <React.Fragment key={i}>
                                                        {line}
                                                        {i < msg.parts[0].text.split('\n').length - 1 && <br />}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            {!isModel && <User size={16} className="mt-1 shrink-0 text-blue-200" />}
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-2 border border-gray-100 dark:border-gray-700">
                                        <Loader2 size={16} className="animate-spin text-blue-600" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Processing...</span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
                            <form onSubmit={handleSendMessage} className="flex space-x-2 relative">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask a question..."
                                    className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 rounded-full pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500 text-sm dark:text-gray-100 placeholder-gray-500"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isLoading}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatbotWidget;
