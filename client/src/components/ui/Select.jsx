import React from 'react';

export const Select = ({
  label,
  name,
  options = [],
  error,
  register,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
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
        <select
          id={name}
          name={name}
          disabled={disabled}
          className={`block w-full rounded-lg bg-navy-800/90 border text-white text-sm transition-colors duration-150 px-3.5 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-white/10 hover:border-white/20'
          }`}
          {...registerProps}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled className="bg-navy-900 text-gray-500">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-navy-900 text-slate-100 py-1"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
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

export default Select;
