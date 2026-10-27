import React from 'react';

export const Card = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  headerClassName = '',
  bodyClassName = '',
  ...rest
}) => {
  const hasHeader = title || subtitle || action;

  return (
    <div
      className={`card-premium min-w-0 p-4 sm:p-6 backdrop-blur-sm ${className}`}
      {...rest}
    >
      {hasHeader && (
        <div className={`flex flex-col gap-3 pb-4 mb-4 border-b border-white/10 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`}>
          <div className="min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-white tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="max-w-full sm:ml-4 sm:shrink-0">{action}</div>}
        </div>
      )}
      <div className={`card-content ${bodyClassName}`}>{children}</div>
    </div>
  );
};

export default Card;
