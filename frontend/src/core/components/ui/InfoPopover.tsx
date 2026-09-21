import React, { useState, useRef, useEffect } from 'react';
import { Info, HelpCircle, X } from 'lucide-react';
import clsx from 'clsx';

export interface InfoPopoverProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  triggerLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const InfoPopover: React.FC<InfoPopoverProps> = ({
  title,
  children,
  icon,
  triggerLabel,
  className,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const sizeWidths = {
    sm: 'w-72 sm:w-80',
    md: 'w-80 sm:w-96',
    lg: 'w-96 sm:w-[32rem]',
  };

  return (
    <div className={clsx('relative inline-flex items-center', className)} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-600 transition-colors p-1 rounded-full hover:bg-sky-50 focus:outline-none"
        title={title || 'Xem thông tin hướng dẫn'}
      >
        {icon || <HelpCircle className="w-4 h-4" />}
        {triggerLabel && <span className="text-xs font-semibold underline">{triggerLabel}</span>}
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute top-full right-0 sm:right-auto sm:left-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 text-slate-700 text-xs leading-relaxed max-h-[80vh] overflow-y-auto',
            sizeWidths[size]
          )}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600" />
              {title || 'Thông tin hướng dẫn'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>{children}</div>
        </div>
      )}
    </div>
  );
};
