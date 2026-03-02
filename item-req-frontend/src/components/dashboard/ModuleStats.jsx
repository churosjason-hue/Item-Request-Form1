import React from 'react';

const ModuleStatsGrid = ({ stats, config, user }) => {
    // Get the cards configuration from the module config
    // We pass 'stats' (the data from API) and 'user' to the getStats function
    const cards = config.getStats(user, stats);

    const colorClasses = {
        gray: 'bg-gray-500',
        blue: 'bg-primary-500',
        green: 'bg-green-500',
        red: 'bg-red-500',
        yellow: 'bg-yellow-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500'
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map((card, index) => {
                const Icon = card.icon;

                return (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors duration-200">
                        <div className="flex items-center">
                            <div className={`p-2 rounded-md ${colorClasses[card.color] || 'bg-gray-500'}`}>
                                {Icon && <Icon className="h-6 w-6 text-white" />}
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{card.count}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ModuleStatsGrid;
