import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Car, ArrowLeft } from 'lucide-react';

const FormSelector = () => {
  const navigate = useNavigate();

  const formOptions = [
    {
      id: 'item',
      title: 'Item Request Form',
      description: 'Request IT equipment and accessories',
      icon: FileText,
      color: 'blue',
      route: '/requests/new'
    },
    {
      id: 'vehicle',
      title: 'Vehicle Request Form',
      description: 'Request service vehicle for transportation',
      icon: Car,
      color: 'green',
      route: '/service-vehicle-requests/new'
    }
  ];

  const handleFormSelect = (form) => {
    navigate(form.route);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-blue-600 flex items-center justify-center text-white font-bold text-xl rounded-lg">
                  STC
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">STYROTECH CORPORATION</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Request Forms</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Select a Form Type</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose the type of request you would like to create
              </p>
            </div>
          </div>
        </div>

        {/* Form Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formOptions.map((form) => {
            const Icon = form.icon;
            const colorClasses = {
              blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700',
              green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 hover:border-green-300 dark:hover:border-green-700'
            };
            const iconColorClasses = {
              blue: 'bg-blue-600 text-white',
              green: 'bg-green-600 text-white'
            };

            return (
              <div
                key={form.id}
                onClick={() => handleFormSelect(form)}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${colorClasses[form.color]}`}
              >
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`p-4 rounded-lg ${iconColorClasses[form.color]}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {form.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {form.description}
                      </p>
                      <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
                        <span>Click to open form</span>
                        <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Form Information</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <strong className="text-gray-900 dark:text-white">Item Request Form:</strong> Use this form to request IT equipment,
              accessories, software, or other technology items. The form includes sections for item specifications,
              purpose, and approval workflow.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Vehicle Request Form:</strong> Use this form to request service
              vehicles for transportation needs including passenger pickup/drop-off, item delivery, or car-only requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSelector;
