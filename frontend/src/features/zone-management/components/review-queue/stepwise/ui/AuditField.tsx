import React from 'react';

export const AUDIT_EMPTY_VALUE = '---';

export const AuditDirtyBadge: React.FC = () => (
  <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 inline-block normal-case">
    Đã sửa
  </span>
);

export interface AuditFieldOption {
  value: string;
  label: string;
}

/** Giữ giá trị đã lưu nằm ngoài danh sách chọn, tránh select tự hiển thị sang lựa chọn khác. */
export function withCurrentOption(options: AuditFieldOption[], value: string | null | undefined): AuditFieldOption[] {
  if (!value || options.some((opt) => opt.value === value)) return options;
  return [{ value, label: value }, ...options];
}

interface AuditFieldProps {
  label: string;
  value: string | number | null | undefined;
  isEditMode?: boolean;
  isDirty?: boolean;
  /** Không truyền thì ô luôn chỉ đọc, kể cả khi đang bật chế độ sửa. */
  onChange?: (val: string) => void;
  type?: 'text' | 'number' | 'textarea' | 'select';
  options?: AuditFieldOption[];
  unit?: string;
  mono?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

/** Ô dữ liệu thẩm định: thẻ tĩnh khi xem, input khi sửa, viền vàng và nhãn "Đã sửa" khi có thay đổi. */
export const AuditField: React.FC<AuditFieldProps> = ({
  label,
  value,
  isEditMode = false,
  isDirty = false,
  onChange,
  type = 'text',
  options = [],
  unit,
  mono = false,
  rows = 3,
  placeholder,
  className = '',
}) => {
  const hasValue = value !== null && value !== undefined && value !== '';
  const fontClass = mono ? 'font-mono' : '';
  const dirtyClass = isDirty ? 'ring-2 ring-amber-400 border-amber-500 bg-amber-50/20' : '';
  const inputClass = `w-full px-2.5 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold text-xs text-slate-800 ${fontClass} ${dirtyClass}`;
  const selectedLabel = options.find((opt) => opt.value === String(value ?? ''))?.label;
  const staticText = hasValue ? `${selectedLabel ?? value}${unit ? ` ${unit}` : ''}` : AUDIT_EMPTY_VALUE;

  return (
    <div className={className}>
      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
        {label}
        {isDirty && <AuditDirtyBadge />}
      </label>
      {isEditMode && onChange ? (
        type === 'textarea' ? (
          <textarea
            rows={rows}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        ) : type === 'select' ? (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {!hasValue && <option value="">{AUDIT_EMPTY_VALUE}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            step={type === 'number' ? 'any' : undefined}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        )
      ) : (
        <div
          className={`p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold whitespace-pre-wrap ${fontClass} ${
            hasValue ? 'text-slate-800' : 'text-slate-400'
          } ${dirtyClass}`}
        >
          {staticText}
        </div>
      )}
    </div>
  );
};
