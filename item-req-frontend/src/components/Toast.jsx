import React, { useContext } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastContext } from '../contexts/ToastContext';

export const Toast = () => {
  const { toasts, removeToast } = useContext(ToastContext);

  const getToastStyles = (type) => {
    const style = 'flex items-start gap-3 p-4 rounded-lg shadow-lg mb-3 animate-slide-in';
    switch (type) {
      case 'success':
        return `${style} bg-green-50 border border-green-200`;
      case 'error':
        return `${style} bg-red-50 border border-red-200`;
      case 'warning':
        return `${style} bg-yellow-50 border border-yellow-200`;
      case 'info':
      default:
        return `${style} bg-blue-50 border border-blue-200`;
    }
  };

  const getIconStyles = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
      default:
        return 'text-blue-600';
    }
  };

  const getTextStyles = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
      default:
        return 'text-blue-800';
    }
  };

  const getIcon = (type) => {
    const iconClass = `h-5 w-5 flex-shrink-0`;
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} ${getIconStyles(type)}`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} ${getIconStyles(type)}`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} ${getIconStyles(type)}`} />;
      case 'info':
      default:
        return <Info className={`${iconClass} ${getIconStyles(type)}`} />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col max-w-md">
      {toasts.map((toast) => (
        <div key={toast.id} className={getToastStyles(toast.type)}>
          <div className="flex-shrink-0">
            {getIcon(toast.type)}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${getTextStyles(toast.type)}`}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className={`flex-shrink-0 ml-2 transition-colors ${
              toast.type === 'success' ? 'text-green-600 hover:text-green-700' :
              toast.type === 'error' ? 'text-red-600 hover:text-red-700' :
              toast.type === 'warning' ? 'text-yellow-600 hover:text-yellow-700' :
              'text-blue-600 hover:text-blue-700'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
