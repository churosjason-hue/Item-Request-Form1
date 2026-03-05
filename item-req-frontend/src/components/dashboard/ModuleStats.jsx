import React from 'react';

const ModuleStatsGrid = ({ stats, config, user, onCardClick, activeFilter, roleUIConfig }) => {
    const allCards = config.getStats(user, stats);

    // Apply visibility config if present
    // roleUIConfig shape: { item_request: { it_manager: ['checked_endorsed', ...], ... }, vehicle_request: { ... } }
    const moduleKey = config.id === 'item' ? 'item_request' : 'vehicle_request';
    const roleKey = user?.role;
    const visibleSet = roleUIConfig?.[moduleKey]?.[roleKey]; // undefined = not configured (show all)

    const cards = visibleSet
        ? allCards.filter(card => visibleSet.includes(card.filterStatus) || card.filterStatus?.startsWith('verification_'))
        : allCards;

    const colorClasses = {
        gray: 'bg-gray-500',
        blue: 'bg-primary-500',
        green: 'bg-green-500',
        red: 'bg-red-500',
        yellow: 'bg-yellow-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500'
    };

    const activeRingClasses = {
        gray: 'ring-2 ring-gray-400',
        blue: 'ring-2 ring-primary-400',
        green: 'ring-2 ring-green-400',
        red: 'ring-2 ring-red-400',
        yellow: 'ring-2 ring-yellow-400',
        orange: 'ring-2 ring-orange-400',
        purple: 'ring-2 ring-purple-400'
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((card, index) => {
                const Icon = card.icon;
                const isClickable = card.filterStatus !== undefined;
                const isActive = isClickable && card.filterStatus !== 'all'
                    ? activeFilter === card.filterStatus
                    : isClickable && card.filterStatus === 'all' && (activeFilter === '' || activeFilter === 'all');

                return (
                    <div
                        key={index}
                        onClick={() => {
                            if (!isClickable || !onCardClick) return;
                            const newFilter = card.filterStatus === 'all' ? '' : card.filterStatus;
                            onCardClick(isActive ? '' : newFilter);
                        }}
                        className={`
                            bg-white dark:bg-gray-800 rounded-lg shadow p-5 transition-all duration-150
                            ${isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}
                            ${isActive ? `${activeRingClasses[card.color] || 'ring-2 ring-gray-300'} shadow-md -translate-y-0.5` : ''}
                        `}
                        title={isClickable ? (isActive ? 'Click to clear filter' : `Filter by: ${card.title}`) : ''}
                    >
                        <div className="flex items-center">
                            <div className={`p-2 rounded-md ${colorClasses[card.color] || 'bg-gray-500'} ${isActive ? 'opacity-100' : 'opacity-90'}`}>
                                {Icon && <Icon className="h-6 w-6 text-white" />}
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isActive ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {card.title}
                                </p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {card.count}
                                </p>
                            </div>
                            {isActive && (
                                <div className="ml-1 flex-shrink-0">
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Active</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ModuleStatsGrid;
