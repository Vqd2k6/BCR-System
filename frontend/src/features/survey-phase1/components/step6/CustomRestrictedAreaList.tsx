import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { addCustomRestrictedArea } from '../../utils/accessLimitation';

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
  readOnly?: boolean;
}

/** Mỗi khu vực tự nhập là một phần tử riêng trong JSON, nên trích xuất lại không cần phân tích chữ. */
export const CustomRestrictedAreaList: React.FC<Props> = ({ items, onChange, readOnly = false }) => {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const next = addCustomRestrictedArea(items, draft);
    if (next !== items) onChange(next);
    setDraft('');
  };

  if (readOnly) {
    return items.length > 0 ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="p-2.5 rounded-lg border bg-amber-100 border-amber-400 font-bold text-amber-950 text-xs"
          >
            {item}
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-amber-700 italic">Chưa ghi rõ khu vực khác.</p>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in">
      <div className="flex items-center gap-2">
        <input
          id="input-custom-restricted-area"
          type="text"
          enterKeyHint="done"
          placeholder="Nhập một khu vực rồi nhấn Enter, ví dụ: Phòng ngủ lầu 1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // Enter lúc bộ gõ tiếng Việt đang ghép dấu chỉ để chốt ký tự, chưa phải thêm mục
            if (!e.nativeEvent.isComposing) commitDraft();
          }}
          className="flex-1 min-w-0 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={!draft.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-amber-400 bg-amber-100 text-xs font-bold text-amber-950 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm
        </button>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => (
            <label
              key={item}
              className="flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all bg-amber-100 border-amber-400 font-bold text-amber-950"
            >
              <input
                type="checkbox"
                checked
                onChange={() => onChange(items.filter((other) => other !== item))}
                className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
