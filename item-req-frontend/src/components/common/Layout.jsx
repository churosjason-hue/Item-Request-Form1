import React, { useState, useEffect } from "react";
import { Sidebar, SidebarBody } from "../ui/sidebar";
import {
    LayoutDashboard,
    Car,
    FileText,
    LogOut,
    FilePlus,
    Folder,
    FolderOpen,
    ChevronDown,
    ChevronRight,
    FileStack,
    Settings,
    Building2,
    Users,
    Building,
    Shield,
    Package,
    Monitor,
    GitBranch,
    Lock,
    KeyRound,
} from "lucide-react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import STC_LOGO from '../../assets/STC_LOGO.png';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from "lucide-react";
import { settingsAPI } from '../../services/api';
import { DEFAULT_ROLE_UI_CONFIG } from '../admin/RoleUIConfig';

// ── Tree Node ────────────────────────────────────────────────
const TreeNode = ({ node, depth = 0, sidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(node.defaultOpen ?? false);

    const isActive = node.path && location.pathname === node.path;
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 10;

    if (node.path) {
        // Leaf — clickable nav link
        return (
            <button
                onClick={() => navigate(node.path)}
                title={node.label}
                style={{ paddingLeft: sidebarOpen ? `${indent + 10}px` : undefined }}
                className={cn(
                    "w-full flex items-center gap-2 py-1.5 pr-2 text-sm rounded-md transition-all duration-150 group",
                    isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
                    !sidebarOpen && "justify-center px-2"
                )}
            >
                {node.icon && (
                    <node.icon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive ? "text-blue-500" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                    )} />
                )}
                {sidebarOpen && <span className="truncate">{node.label}</span>}
            </button>
        );
    }

    // Branch — expandable folder
    return (
        <div>
            <button
                onClick={() => sidebarOpen && setExpanded(prev => !prev)}
                title={node.label}
                style={{ paddingLeft: sidebarOpen ? `${indent + 2}px` : undefined }}
                className={cn(
                    "w-full flex items-center gap-2 py-1.5 pr-2 text-sm rounded-md transition-all duration-150 group",
                    depth === 0
                        ? "font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                        : "font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
                    !sidebarOpen && "justify-center px-2"
                )}
            >
                {sidebarOpen ? (
                    expanded
                        ? <FolderOpen className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-blue-500" : "text-yellow-500")} />
                        : <Folder className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-blue-500" : "text-yellow-400")} />
                ) : (
                    node.icon
                        ? <node.icon className="h-5 w-5 flex-shrink-0 text-blue-500" />
                        : <Folder className="h-5 w-5 flex-shrink-0 text-blue-500" />
                )}

                {sidebarOpen && (
                    <>
                        <span className="flex-1 text-left truncate">{node.label}</span>
                        {hasChildren && (
                            expanded
                                ? <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                : <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        )}
                    </>
                )}
            </button>

            {/* Children */}
            {sidebarOpen && expanded && hasChildren && (
                <div className="mt-0.5 ml-3 border-l border-gray-200 dark:border-gray-700 pl-1 space-y-0.5">
                    {node.children.map((child, idx) => (
                        <TreeNode key={idx} node={child} depth={depth + 1} sidebarOpen={sidebarOpen} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Layout ───────────────────────────────────────────────────
export function Layout() {
    const { user, logout, canManageUsers, isAdmin, canManageInventory } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [allowedMenus, setAllowedMenus] = useState(null); // null = not loaded yet

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Load role UI config on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await settingsAPI.getRoleUIConfig();
                const savedConfig = res.data.value;
                if (savedConfig && typeof savedConfig === 'object' && user?.role) {
                    // Merge saved with defaults so new items fall back to default
                    const merged = { ...DEFAULT_ROLE_UI_CONFIG, ...savedConfig };
                    setAllowedMenus(merged[user.role] ?? DEFAULT_ROLE_UI_CONFIG[user.role] ?? []);
                } else {
                    // No saved config — use defaults
                    setAllowedMenus(DEFAULT_ROLE_UI_CONFIG[user?.role] ?? []);
                }
            } catch (err) {
                console.warn('Could not load role UI config, using defaults:', err);
                setAllowedMenus(DEFAULT_ROLE_UI_CONFIG[user?.role] ?? []);
            }
        };
        if (user?.role) loadConfig();
    }, [user?.role]);

    // Helper: is a menu item allowed for the current user?
    const can = (key) => {
        if (!allowedMenus) return false; // still loading
        return allowedMenus.includes(key);
    };

    // Filter children of tree nodes based on config
    const filterChildren = (children) =>
        children
            .filter(child => !child.menuKey || can(child.menuKey))
            .map(child => ({
                ...child,
                children: child.children ? filterChildren(child.children) : undefined
            }));

    const tree = [
        // ── BSP ──────────────────────────────────
        {
            label: 'BSP',
            icon: Building2,
            defaultOpen: true,
            children: [
                {
                    label: 'System',
                    icon: Settings,
                    defaultOpen: false,
                    children: []
                },
                {
                    label: 'Forms',
                    icon: FileStack,
                    defaultOpen: true,
                    children: [
                        {
                            label: 'IT Requisition Form',
                            icon: FilePlus,
                            path: '/requests',
                            menuKey: 'it_requisition'
                        }
                    ]
                }
            ]
        },
        // ── ODHC ─────────────────────────────────
        {
            label: 'ODHC',
            icon: Car,
            defaultOpen: false,
            children: [
                {
                    label: 'System',
                    icon: Settings,
                    defaultOpen: false,
                    children: []
                },
                {
                    label: 'Forms',
                    icon: FileStack,
                    defaultOpen: true,
                    children: [
                        {
                            label: 'Service Vehicle Request Form',
                            icon: Car,
                            path: '/service-vehicle-requests',
                            menuKey: 'service_vehicle'
                        }
                    ]
                }
            ]
        },
        // ── General Forms ─────────────────────────
        {
            label: 'General Forms',
            icon: FileStack,
            defaultOpen: false,
            children: [
                {
                    label: 'IT Requisition Form',
                    icon: FilePlus,
                    path: '/requests',
                    menuKey: 'it_requisition'
                },
                {
                    label: 'Service Vehicle Request Form',
                    icon: Car,
                    path: '/service-vehicle-requests',
                    menuKey: 'service_vehicle'
                }
            ]
        }
    ];

    const filteredTree = filterChildren(tree);

    return (
        <div className={cn("flex flex-col md:flex-row w-full flex-1 h-screen overflow-hidden")}>
            <div className="no-print h-full flex-shrink-0">
                <Sidebar open={open} setOpen={setOpen}>
                    <SidebarBody className="justify-between gap-10 border-r border-gray-200 dark:border-gray-800">
                        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            {open ? <Logo /> : <LogoIcon />}

                            <div className="mt-6 flex flex-col gap-1">
                                {/* Dashboard */}
                                {can('dashboard') && (
                                    <TreeNode
                                        node={{
                                            label: 'Dashboard',
                                            icon: LayoutDashboard,
                                            path: '/dashboard'
                                        }}
                                        depth={0}
                                        sidebarOpen={open}
                                    />
                                )}

                                {/* Divider */}
                                {open && <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />}
                                {!open && <div className="h-px bg-gray-200 dark:bg-gray-700 w-8 mx-auto my-4" />}

                                {/* BSP / ODHC / General Forms tree */}
                                {filteredTree.map((rootNode, idx) => (
                                    <TreeNode key={idx} node={rootNode} depth={0} sidebarOpen={open} />
                                ))}

                                {/* Inventory section */}
                                {canManageInventory && canManageInventory() && (can('inventory') || can('deployed_assets')) && (
                                    <>
                                        {open && <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />}
                                        {!open && <div className="h-px bg-gray-200 dark:bg-gray-700 w-8 mx-auto my-4" />}
                                        {open && (
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2 mb-1">
                                                Inventory
                                            </p>
                                        )}
                                        {can('inventory') && <TreeNode node={{ label: 'Inventory Management', icon: Package, path: '/inventory' }} depth={0} sidebarOpen={open} />}
                                        {can('deployed_assets') && <TreeNode node={{ label: 'Deployed Assets', icon: Monitor, path: '/deployed-assets' }} depth={0} sidebarOpen={open} />}
                                    </>
                                )}

                                {/* Administration section (admin only) */}
                                {(canManageUsers() || isAdmin()) && (
                                    <>
                                        {open && <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />}
                                        {!open && <div className="h-px bg-gray-200 dark:bg-gray-700 w-8 mx-auto my-4" />}
                                        {open && (
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2 mb-1">
                                                Administration
                                            </p>
                                        )}
                                        {canManageUsers() && can('users') && (
                                            <TreeNode node={{ label: 'Manage Users', icon: Users, path: '/users' }} depth={0} sidebarOpen={open} />
                                        )}
                                        {isAdmin() && (
                                            <>
                                                {can('workflow_setup') && <TreeNode node={{ label: 'Workflow Setup', icon: GitBranch, path: '/settings/workflow-setup' }} depth={0} sidebarOpen={open} />}
                                                {can('departments') && <TreeNode node={{ label: 'Departments', icon: Building, path: '/departments' }} depth={0} sidebarOpen={open} />}
                                                {can('workflows') && <TreeNode node={{ label: 'Workflows', icon: Settings, path: '/settings/workflows' }} depth={0} sidebarOpen={open} />}
                                                {can('approval_matrix') && <TreeNode node={{ label: 'Approval Matrix', icon: FileStack, path: '/settings/approval-matrix' }} depth={0} sidebarOpen={open} />}
                                                {can('audit_logs') && <TreeNode node={{ label: 'Audit Logs', icon: Shield, path: '/audit-logs' }} depth={0} sidebarOpen={open} />}
                                                {can('role_access') && <TreeNode node={{ label: 'Role Access Config', icon: Lock, path: '/settings/role-access' }} depth={0} sidebarOpen={open} />}
                                                {isAdmin() && <TreeNode node={{ label: 'API Keys', icon: KeyRound, path: '/settings/api-keys' }} depth={0} sidebarOpen={open} />}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div>
                            <button onClick={toggleTheme} className="flex items-center justify-start gap-2 group/sidebar py-2 w-full mb-2">
                                {theme === 'dark'
                                    ? <Sun className="text-gray-700 dark:text-gray-200 h-5 w-5 flex-shrink-0" />
                                    : <Moon className="text-gray-700 dark:text-gray-200 h-5 w-5 flex-shrink-0" />}
                                <motion.span
                                    animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
                                    className="text-gray-700 dark:text-gray-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                                >
                                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                                </motion.span>
                            </button>

                            <button onClick={handleLogout} className="flex items-center justify-start gap-2 group/sidebar py-2 w-full">
                                <LogOut className="text-gray-700 dark:text-gray-200 h-5 w-5 flex-shrink-0" />
                                <motion.span
                                    animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
                                    className="text-gray-700 dark:text-gray-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                                >
                                    Logout
                                </motion.span>
                            </button>

                            {user && (
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
                                        {user.firstName ? user.firstName[0] : 'U'}
                                    </div>
                                    <motion.div
                                        animate={{ display: open ? "block" : "none", opacity: open ? 1 : 0 }}
                                        className="flex-1 min-w-0"
                                    >
                                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.fullName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {user.role ? user.role.replace(/_/g, ' ').toUpperCase() : ''}
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </div>
                    </SidebarBody>
                </Sidebar>
            </div>

            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 print:overflow-visible">
                <Outlet />
            </main>
        </div>
    );
}

export const Logo = () => (
    <Link to="/dashboard" className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20">
        <img src={STC_LOGO} alt="STC Logo" className="h-6 w-6 flex-shrink-0" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col justify-center">
            <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-pre leading-tight text-lg">PRISM</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Styrotech Corporation</span>
        </motion.div>
    </Link>
);

export const LogoIcon = () => (
    <Link to="/dashboard" className="font-normal flex items-center justify-center py-1 relative z-20">
        <img src={STC_LOGO} alt="STC Logo" className="h-6 w-6 flex-shrink-0" />
    </Link>
);
