import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/80 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-3 text-center sm:p-0">
        <div
          role="dialog"
          aria-modal="true"
          className={`relative my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-full transform overflow-hidden rounded-2xl bg-navy-900 border border-white/10 text-left shadow-2xl transition-all sm:my-8 ${sizeClass} animate-slide-up ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10 sm:px-6">
            <h3 className="min-w-0 text-lg font-semibold text-white tracking-tight">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto px-4 py-5 sm:max-h-[calc(100vh-12rem)] sm:px-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
