import React from 'react';

export const Input = ({
  label,
  name,
  type = 'text',
  error,
  placeholder,
  register,
  disabled = false,
  icon: Icon,
  className = '',
  helperText,
  ...rest
}) => {
  const registerProps = register && name ? register(name) : {};

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full rounded-lg bg-navy-800/50 border text-white placeholder-gray-500 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            Icon ? 'pl-10' : 'pl-3.5'
          } pr-3.5 py-2.5 ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-white/10 hover:border-white/20'
          }`}
          {...registerProps}
          {...rest}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 font-medium">
          {typeof error === 'string' ? error : error?.message}
        </p>
      )}
      {!error && helperText && (
        <p className="mt-1.5 text-xs text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export default Input;
