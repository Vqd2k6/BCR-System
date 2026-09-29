import React from 'react';
import clsx from 'clsx';

// Input Field
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  statusHighlight?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  className,
  id,
  statusHighlight = true,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isSpecialType = props.type === 'hidden' || props.type === 'checkbox' || props.type === 'radio';
  const hasValue = props.value !== undefined && props.value !== null && String(props.value).trim() !== '';
  const shouldHighlight = statusHighlight && !props.disabled && !isSpecialType && !props.readOnly;

  const borderClass = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
    : shouldHighlight
      ? hasValue
        ? 'border-emerald-500 bg-emerald-50/10 text-slate-900 focus:border-emerald-600 focus:ring-emerald-500/20 shadow-2xs'
        : 'border-amber-400 bg-amber-50/25 text-slate-800 focus:border-amber-500 focus:ring-amber-500/20 shadow-2xs'
      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx(
            'w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 shadow-sm disabled:bg-slate-50 disabled:text-slate-400',
            icon && 'pl-9',
            borderClass,
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  );
};

// Select Field
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: { value: string | number; label: string }[];
  statusHighlight?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  hint,
  options,
  children,
  className,
  id,
  statusHighlight = true,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  // Kiểm tra nếu value hiện tại không có trong options list (VD: khi read-only restore từ API)
  const currentValue = props.value as string | undefined;
  const valueExistsInOptions = !options || !currentValue || currentValue === ''
    || options.some(opt => String(opt.value) === String(currentValue));

  const hasValue = currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== '';
  const shouldHighlight = statusHighlight && !props.disabled;

  const borderClass = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
    : shouldHighlight
      ? hasValue
        ? 'border-emerald-500 bg-emerald-50/10 text-slate-900 focus:border-emerald-600 focus:ring-emerald-500/20 shadow-2xs'
        : 'border-amber-400 bg-amber-50/25 text-slate-800 focus:border-amber-500 focus:ring-amber-500/20 shadow-2xs'
      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={clsx(
          'w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 transition-all focus:outline-none focus:ring-2 shadow-sm disabled:bg-slate-50 disabled:text-slate-400',
          borderClass,
          className
        )}
        {...props}
      >
        {options
          ? (
            <>
              {/* Nếu value không match option nào (VD: read-only từ API), hiển thị như option đặc biệt */}
              {!valueExistsInOptions && currentValue && (
                <option value={currentValue}>{currentValue}</option>
              )}
              {options.map((opt, index) => (
                <option key={`${opt.value}-${index}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </>
          )
          : children}
      </select>
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  );
};

// Textarea Field
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  statusHighlight?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  hint,
  className,
  id,
  rows = 3,
  statusHighlight = true,
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const hasValue = props.value !== undefined && props.value !== null && String(props.value).trim() !== '';
  const shouldHighlight = statusHighlight && !props.disabled && !props.readOnly;

  const borderClass = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
    : shouldHighlight
      ? hasValue
        ? 'border-emerald-500 bg-emerald-50/10 text-slate-900 focus:border-emerald-600 focus:ring-emerald-500/20 shadow-2xs'
        : 'border-amber-400 bg-amber-50/25 text-slate-800 focus:border-amber-500 focus:ring-amber-500/20 shadow-2xs'
      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={clsx(
          'w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 shadow-sm disabled:bg-slate-50 disabled:text-slate-400',
          borderClass,
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  );
};
