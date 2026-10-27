import React from 'react';

const SIZES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

export const LoadingSpinner = ({
  size = 'md',
  message,
  className = '',
}) => {
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <div className={`flex flex-col items-center justify-center p-6 space-y-3 ${className}`}>
      <div
        className={`${sizeClass} border-primary-500/20 border-t-primary-500 rounded-full animate-spin`}
      />
      {message && (
        <p className="text-sm text-gray-400 font-medium tracking-wide">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
