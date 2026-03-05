import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    Monitor,
    Car,
    FileText,
    LayoutDashboard,
    Menu,
    X,
    ChevronLeft,
    LogOut,
    Plus,
    Package,
    ClipboardList,
    Folder,
    FolderOpen,
    Building2,
    FileStack,
    Settings,
    FilePlus,
    Users,
    Building,
    Shield,
    GitBranch,
    KeyRound
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import STC_LOGO from '../../assets/STC_LOGO.png';

// --- Tree Node Component ---
const TreeNode = ({ node, depth = 0, isOpen: sidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(node.defaultOpen ?? false);

    const isActive = node.path && location.pathname === node.path;
    const hasChildren = node.children && node.children.length > 0;

    const indent = depth * 12;

    if (node.path) {
        // Leaf node — clickable link
        return (
            <button
                onClick={() => navigate(node.path)}
                style={{ paddingLeft: `${indent + 12}px` }}
                className={`
                    w-full flex items-center gap-2 py-2 pr-3 text-sm font-medium rounded-lg transition-all duration-200 group
                    ${isActive
                        ? 'bg-blue-500/15 text-blue-400 border-l-2 border-blue-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'}
                    ${!sidebarOpen ? 'justify-center' : ''}
                `}
                title={!sidebarOpen ? node.label : ''}
            >
                {node.icon && (
                    <node.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-white'}`} />
                )}
                {sidebarOpen && (
                    <span className="truncate">{node.label}</span>
                )}
            </button>
        );
    }

    // Branch node — expandable folder
    return (
        <div>
            <button
                onClick={() => sidebarOpen && setExpanded(prev => !prev)}
                style={{ paddingLeft: `${indent + 4}px` }}
                className={`
                    w-full flex items-center gap-2 py-2 pr-3 text-sm rounded-lg transition-all duration-200 group
                    ${depth === 0
                        ? 'font-semibold text-gray-200 hover:bg-white/5'
                        : 'font-medium text-gray-400 hover:text-white hover:bg-white/5'}
                    ${!sidebarOpen ? 'justify-center' : ''}
                `}
                title={!sidebarOpen ? node.label : ''}
            >
                {/* Folder icon toggles open/closed */}
                {sidebarOpen ? (
                    expanded
                        ? <FolderOpen className={`h-4 w-4 flex-shrink-0 ${depth === 0 ? 'text-blue-400' : 'text-yellow-400/80'}`} />
                        : <Folder className={`h-4 w-4 flex-shrink-0 ${depth === 0 ? 'text-blue-400' : 'text-yellow-400/80'}`} />
                ) : (
                    node.icon
                        ? <node.icon className="h-5 w-5 flex-shrink-0 text-blue-400" />
                        : <Folder className="h-5 w-5 flex-shrink-0 text-blue-400" />
                )}

                {sidebarOpen && (
                    <>
                        <span className="flex-1 text-left truncate">{node.label}</span>
                        {hasChildren && (
                            expanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        )}
                    </>
                )}
            </button>

            {/* Children */}
            {sidebarOpen && expanded && hasChildren && (
                <div className="mt-0.5 ml-3 border-l border-slate-700/60 pl-1 space-y-0.5">
                    {node.children.map((child, idx) => (
                        <TreeNode key={idx} node={child} depth={depth + 1} isOpen={sidebarOpen} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Sidebar ---
const Sidebar = ({ isOpen, toggleSidebar, isMobile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, canManageInventory, canManageUsers, isAdmin } = useAuth();

    const isActive = (path) => location.pathname === path;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Tree structure
    const tree = [
        // ── BSP Root ──────────────────────────────────────────
        {
            id: 'bsp',
            label: 'BSP',
            icon: Building2,
            defaultOpen: true,
            children: [
                {
                    label: 'System',
                    icon: Settings,
                    defaultOpen: false,
                    children: [] // placeholder — no system pages yet
                },
                {
                    label: 'Forms',
                    icon: FileStack,
                    defaultOpen: true,
                    children: [
                        {
                            label: 'IT Requisition Form',
                            icon: FilePlus,
                            path: '/requests/new'
                        }
                    ]
                }
            ]
        },
        // ── ODHC Root ─────────────────────────────────────────
        {
            id: 'odhc',
            label: 'ODHC',
            icon: Car,
            defaultOpen: false,
            children: [
                {
                    label: 'System',
                    icon: Settings,
                    defaultOpen: false,
                    children: [] // placeholder — no system pages yet
                },
                {
                    label: 'Forms',
                    icon: FileStack,
                    defaultOpen: true,
                    children: [
                        {
                            label: 'Service Vehicle Request Form',
                            icon: Car,
                            path: '/service-vehicle-requests/new'
                        }
                    ]
                }
            ]
        },
        // ── General Forms Root ────────────────────────────────
        {
            id: 'general',
            label: 'General Forms',
            icon: FileStack,
            defaultOpen: false,
            children: [
                {
                    label: 'IT Requisition Form',
                    icon: FilePlus,
                    path: '/requests/new'
                },
                {
                    label: 'Service Vehicle Request Form',
                    icon: Car,
                    path: '/service-vehicle-requests/new'
                }
            ]
        }
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
        fixed md:static inset-y-0 left-0 z-50
        flex flex-col h-screen
        bg-slate-900 border-r border-slate-800 text-white transition-all duration-300 ease-in-out
        ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}
      `}>
                {/* Header */}
                <div className={`
          flex items-center h-16 px-4 bg-slate-950/50 border-b border-slate-800
          ${isOpen ? 'justify-between' : 'justify-center'}
        `}>
                    {isOpen ? (
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <img src={STC_LOGO} alt="STC Logo" className="h-8 w-8 flex-shrink-0" />
                            <div className="truncate">
                                <div className="font-bold text-lg tracking-tight text-blue-400 truncate">PRISM</div>
                                <div className="text-xs text-gray-400 truncate">Styrotech Corporation</div>
                            </div>
                        </div>
                    ) : (
                        <div className="font-bold text-xl tracking-tight text-blue-400 hidden md:block">
                            PRISM
                        </div>
                    )}

                    {/* Mobile Close Button */}
                    <button
                        onClick={toggleSidebar}
                        className="md:hidden p-1 hover:bg-white/10 rounded-lg transition-colors ml-auto"
                    >
                        <X className="h-6 w-6 text-gray-400 hover:text-white" />
                    </button>
                </div>

                {/* Dashboard shortcut */}
                <div className="px-3 pt-4 pb-1">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className={`
              relative w-full flex items-center py-2.5 px-3 text-sm font-medium rounded-xl transition-all duration-200 group
              ${isActive('/dashboard')
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'}
              ${!isOpen ? 'justify-center' : ''}
            `}
                        title={!isOpen ? 'Dashboard' : ''}
                    >
                        <LayoutDashboard className={`h-5 w-5 flex-shrink-0 ${!isOpen ? '' : 'mr-3'} ${isActive('/dashboard') ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                        <span className={`whitespace-nowrap ${!isOpen ? 'hidden' : 'block'}`}>
                            Dashboard
                        </span>
                        {!isOpen && (
                            <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                Dashboard
                            </div>
                        )}
                    </button>
                </div>

                {/* Divider */}
                {isOpen && (
                    <div className="mx-4 my-2 border-t border-slate-800" />
                )}

                {/* Tree Nav */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
                    <nav className="space-y-1 px-3">
                        {tree.map((rootNode) => (
                            <TreeNode key={rootNode.id} node={rootNode} depth={0} isOpen={isOpen} />
                        ))}

                        {/* Inventory section */}
                        {canManageInventory && canManageInventory() && (
                            <>
                                {isOpen && <div className="mx-4 my-2 border-t border-slate-800" />}
                                {!isOpen && <div className="mx-auto my-2 w-8 border-t border-slate-800" />}
                                {isOpen && (
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-2">
                                        Inventory
                                    </p>
                                )}
                                <TreeNode node={{ label: 'Inventory Management', icon: Package, path: '/inventory' }} depth={0} isOpen={isOpen} />
                                <TreeNode node={{ label: 'Deployed Assets', icon: Monitor, path: '/deployed-assets' }} depth={0} isOpen={isOpen} />
                            </>
                        )}

                        {/* Administration section (admin only) */}
                        {((canManageUsers && canManageUsers()) || (isAdmin && isAdmin())) && (
                            <>
                                {isOpen && <div className="mx-4 my-2 border-t border-slate-800" />}
                                {!isOpen && <div className="mx-auto my-2 w-8 border-t border-slate-800" />}
                                {isOpen && (
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-2">
                                        Administration
                                    </p>
                                )}
                                {canManageUsers && canManageUsers() && (
                                    <TreeNode node={{ label: 'Manage Users', icon: Users, path: '/users' }} depth={0} isOpen={isOpen} />
                                )}
                                {isAdmin && isAdmin() && (
                                    <>
                                        <TreeNode node={{ label: 'Workflow Setup', icon: GitBranch, path: '/settings/workflow-setup' }} depth={0} isOpen={isOpen} />
                                        <TreeNode node={{ label: 'Departments', icon: Building, path: '/departments' }} depth={0} isOpen={isOpen} />
                                        <TreeNode node={{ label: 'Workflows', icon: Settings, path: '/settings/workflows' }} depth={0} isOpen={isOpen} />
                                        <TreeNode node={{ label: 'Approval Matrix', icon: FileStack, path: '/settings/approval-matrix' }} depth={0} isOpen={isOpen} />
                                        <TreeNode node={{ label: 'Audit Logs', icon: Shield, path: '/audit-logs' }} depth={0} isOpen={isOpen} />
                                        <TreeNode node={{ label: 'API Keys', icon: KeyRound, path: '/settings/api-keys' }} depth={0} isOpen={isOpen} />
                                    </>
                                )}
                            </>
                        )}
                    </nav>
                </div>

                {/* Footer */}
                <div className="bg-slate-950/30 border-t border-slate-800">
                    {isOpen && user && (
                        <div className="p-4 border-b border-slate-800">
                            <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                                    {user.firstName ? user.firstName[0] : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">
                                        {user.fullName}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate">
                                        {user.role ? user.role.replace(/_/g, ' ').toUpperCase() : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!isMobile && (
                        <div className="p-4">
                            <button
                                onClick={toggleSidebar}
                                className="flex items-center justify-center w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-gray-400 hover:text-white rounded-lg transition-colors"
                            >
                                {isOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
