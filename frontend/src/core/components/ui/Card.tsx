import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'glass' | 'slate' | 'highlight';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'white',
  hoverEffect = false,
  className,
  children,
  ...props
}) => {
  const variantStyles = {
    white: 'bg-white border-slate-200/80 shadow-sm text-slate-800',
    glass: 'bg-white/80 backdrop-blur-md border-white/60 shadow-md text-slate-800',
    slate: 'bg-slate-900 border-slate-800 text-white shadow-lg',
    highlight: 'bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border-emerald-200/80 shadow-sm text-slate-800',
  };

  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 sm:p-5 transition-all duration-200',
        variantStyles[variant],
        hoverEffect && 'hover:shadow-md hover:border-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
