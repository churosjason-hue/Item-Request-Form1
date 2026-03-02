import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import STC_LOGO from '../../assets/STC_LOGO.png';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ModuleStatsGrid from '../dashboard/ModuleStats';
import ModuleTable from '../dashboard/ModuleTable';

// A wrapper page for a specific module's list view
const ModuleRequestsPage = ({ moduleConfig }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme } = useTheme();

    // State
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Selection state for bulk actions
    const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());

    const [filters, setFilters] = useState({
        status: '',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'date',
        sortOrder: 'desc'
    });

    const [pagination, setPagination] = useState({
        total: 0,
        pages: 1,
        currentPage: 1
    });

    // Effects
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) setSidebarOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        loadData();
    }, [moduleConfig.id, filters]);

    // Data Loading
    const loadData = async () => {
        try {
            setLoading(true);
            const queryParams = { ...filters };

            const [listRes, statsRes] = await Promise.all([
                moduleConfig.api.getAll(queryParams),
                moduleConfig.api.getStats()
            ]);

            const data = listRes.data.requests || listRes.data || [];
            setRequests(Array.isArray(data) ? data : []);

            if (listRes.data.pagination) {
                setPagination({
                    total: listRes.data.pagination.total || 0,
                    pages: listRes.data.pagination.pages || 0,
                    currentPage: listRes.data.pagination.page || 1
                });
            }

            setStats({
                ...statsRes.data.stats,
                verificationStats: statsRes.data.verificationStats,
                total: statsRes.data.total
            });
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await moduleConfig.api.delete(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete');
        }
    };

    const isODHC = user?.department?.name?.toUpperCase()?.includes('ODHC') || user?.role === 'super_administrator';

    // Specific Action: Generate Trip Ticket (Vehicle Only)
    const handleGenerateTripTicket = () => {
        if (selectedRequestIds.size === 0) return;
        const selectedData = requests.filter(r => selectedRequestIds.has(r.id || r.request_id));

        const doc = new jsPDF('l', 'mm', 'a4');
        const imgProps = doc.getImageProperties(STC_LOGO);
        const imgWidth = 40;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        doc.addImage(STC_LOGO, 'PNG', 14, 10, imgWidth, imgHeight);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("BATCH TRAVEL ITINERARY", 297 / 2, 20, { align: "center" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("HRD-FM-072 rev.02 080625", 280, 10, { align: "right" });

        const tableBody = selectedData.map(req => {
            const vehicle = req.AssignedVehicle || {};
            const vehicleMakeModel = vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : (req.destination_car || '-');
            const plateNumber = vehicle.plate || '-';
            const driver = req.assigned_driver || '-';

            let passengerName = req.passenger_name || '-';
            if ((!passengerName || passengerName === '-') && req.passengers?.length > 0) {
                passengerName = req.passengers.map(p => p.name).join(', ');
            }

            return [
                req.reference_code || `SVR-${req.id}`,
                req.request_type ? req.request_type.replace(/_/g, ' ').toUpperCase() : '-',
                req.travel_date_from ? new Date(req.travel_date_from).toLocaleDateString() : '-',
                req.travel_date_to ? new Date(req.travel_date_to).toLocaleDateString() : '-',
                req.pick_up_location || req.destination || '-',
                req.pick_up_time || req.departure_time || '-',
                req.drop_off_location || '-',
                passengerName,
                vehicleMakeModel,
                plateNumber,
                driver
            ];
        });

        autoTable(doc, {
            startY: 35,
            head: [[
                { content: 'REF CODE', styles: { valign: 'middle' } },
                { content: 'TYPE', styles: { valign: 'middle' } },
                { content: 'FROM', styles: { valign: 'middle' } },
                { content: 'TO', styles: { valign: 'middle' } },
                { content: 'DESTINATION', styles: { valign: 'middle' } },
                { content: 'TIME', styles: { valign: 'middle' } },
                { content: 'DROP-OFF', styles: { valign: 'middle' } },
                { content: 'PASSENGER', styles: { valign: 'middle' } },
                { content: 'VEHICLE', styles: { valign: 'middle' } },
                { content: 'PLATE', styles: { valign: 'middle' } },
                { content: 'DRIVER', styles: { valign: 'middle' } }
            ]],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 112, 192], textColor: 255, fontSize: 6, fontStyle: 'bold' },
            bodyStyles: { fontSize: 6 },
        });
        doc.save(`Trip_Ticket_${new Date().toISOString().slice(0, 10)}.pdf`);
    };


    return (
        <>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                                <moduleConfig.icon className="h-8 w-8 mr-3 text-primary-600" />
                                {moduleConfig.label}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Manage and view all your {moduleConfig.label.toLowerCase()}
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <ModuleStatsGrid stats={stats} config={moduleConfig} user={user} />

                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
                        <div className="flex space-x-3">
                            <button
                                onClick={() => navigate(moduleConfig.routes.create)}
                                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Request
                            </button>

                            {moduleConfig.id === 'vehicle' && isODHC && selectedRequestIds.size > 0 && (
                                <button
                                    onClick={handleGenerateTripTicket}
                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Trip Ticket ({selectedRequestIds.size})
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search requests..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <ModuleTable
                        config={moduleConfig}
                        data={requests}
                        user={user}
                        isLoading={loading}
                        pagination={pagination}
                        filters={filters}
                        setFilters={setFilters}
                        onDelete={handleDelete}
                        selectedIds={selectedRequestIds}
                        onToggleSelection={(id) => {
                            const newSet = new Set(selectedRequestIds);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            setSelectedRequestIds(newSet);
                        }}
                        onToggleAll={(checked) => {
                            if (checked) {
                                const allIds = new Set(requests.map(r => r.id || r.request_id));
                                setSelectedRequestIds(allIds);
                            } else {
                                setSelectedRequestIds(new Set());
                            }
                        }}
                    />
                </div>
            </main>
        </>
    );
};

export default ModuleRequestsPage;
