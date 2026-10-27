import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-gradient-to-r from-primary-600 to-cyan-500 text-white hover:from-primary-500 hover:to-cyan-400 shadow-glow focus:ring-primary-500',
  secondary: 'bg-navy-700 hover:bg-navy-600 text-white focus:ring-slate-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm',
  ghost: 'bg-transparent hover:bg-white/10 text-gray-300 hover:text-white focus:ring-white/20',
  outline: 'border border-white/20 hover:bg-white/10 text-gray-200 hover:text-white focus:ring-white/20',
};

const SIZES = {
  sm: 'min-h-10 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  onClick,
  icon: Icon,
  ...rest
}) => {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex max-w-full min-w-0 items-center justify-center whitespace-normal break-words text-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] ${variantClass} ${sizeClass} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
          <span className="min-w-0">{children}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 mr-2 shrink-0" />}
          <span className="min-w-0">{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;
