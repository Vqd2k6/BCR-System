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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const approxWidth = size === 'lg' ? 480 : size === 'md' ? 360 : 300;
    
    // Horizontal positioning: align with button left or right to avoid viewport overflow
    let left = rect.left;
    if (left + approxWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - approxWidth - 16);
    }
    if (left < 16) left = 16;

    // Vertical positioning: default below button, or above if near bottom
    let top = rect.bottom + 6;
    if (top + 280 > window.innerHeight && rect.top > 300) {
      top = Math.max(16, rect.top - 280);
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      const handleWindowEvents = () => calculatePosition();
      window.addEventListener('resize', handleWindowEvents);
      window.addEventListener('scroll', handleWindowEvents, true);

      const handleClickOutside = (event: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('resize', handleWindowEvents);
        window.removeEventListener('scroll', handleWindowEvents, true);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, size]);

  const sizeWidths = {
    sm: 'w-72 sm:w-80',
    md: 'w-80 sm:w-96',
    lg: 'w-96 sm:w-[32rem]',
  };

  return (
    <div className={clsx('relative inline-flex items-center', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-600 transition-colors p-1 rounded-full hover:bg-sky-50 focus:outline-none"
        title={title || 'Xem thông tin hướng dẫn'}
      >
        {icon || <HelpCircle className="w-4 h-4" />}
        {triggerLabel && <span className="text-xs font-semibold underline">{triggerLabel}</span>}
      </button>

      {isOpen && coords && (
        <div
          ref={popoverRef}
          style={{ top: `${coords.top}px`, left: `${coords.left}px`, position: 'fixed' }}
          className={clsx(
            'z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 text-slate-700 text-xs leading-relaxed max-h-[80vh] overflow-y-auto',
            sizeWidths[size]
          )}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>{title || 'Thông tin hướng dẫn'}</span>
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
