import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

export const ErrorState = ({
  message = 'An unexpected error occurred while loading data.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-red-950/20 border border-red-500/20 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h4 className="text-base font-semibold text-white mb-1.5">
        Failed to Load Content
      </h4>
      <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
        {typeof message === 'string' ? message : message?.message || 'Error occurred'}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={RefreshCw}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
