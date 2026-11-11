import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { updateResurveyExtraTime2 } from '../api/photoResurvey.api';
import type { ResurveySessionView } from '../types';

interface ResurveyTime2EditorProps {
  sessionId: string;
  itemId: string;
  /** Chữ giờ đang in, dạng "6 thg 10, 2026 15:50:29". */
  text: string | null;
  isAdminEdited: boolean;
  canEdit: boolean;
  onSaved: (view: ResurveySessionView) => void;
}

/** "6 thg 10, 2026 15:50:29" → { date: "2026-10-06", time: "15:50:29" } cho ô nhập. */
function toInputs(text: string | null): { date: string; time: string } {
  const m = String(text || '').match(/^(\d{1,2}) thg (\d{1,2}), (\d{4})(?: (\d{2}:\d{2}:\d{2}))?$/);
  if (!m) return { date: '', time: '' };
  return { date: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, time: m[4] ?? '00:00:00' };
}

/**
 * Giờ in trên report của ảnh phát sinh, Admin chỉnh tay được (giờ Việt Nam).
 * Server kiểm tra giờ nằm giữa ảnh trước / ảnh sau, ghi nhật ký và đánh dấu nguồn ADMIN.
 */
export const ResurveyTime2Editor: React.FC<ResurveyTime2EditorProps> = ({ sessionId, itemId, text, isAdminEdited, canEdit, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const v = toInputs(text);
    setDate(v.date);
    setTime(v.time);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const t = time.length === 5 ? `${time}:00` : time;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(t)) {
      setError('Nhập đủ ngày và giờ (giờ:phút:giây)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateResurveyExtraTime2(sessionId, itemId, `${date}T${t}`));
      setEditing(false);
    } catch (err: unknown) {
      console.error('[ResurveyTime2Editor:save] Không lưu được giờ in', err);
      setError(getErrorMessage(err, 'Không lưu được giờ in'));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5 normal-case font-semibold text-emerald-700">
        <span>Giờ in trên report: {text ?? '---'}</span>
        {isAdminEdited && (
          <span className="px-1.5 py-px rounded-full border text-[9px] bg-amber-950 text-amber-300 border-amber-700">Admin chỉnh</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={start}
            className="p-0.5 rounded hover:bg-emerald-50 text-emerald-700 cursor-pointer"
            title="Chỉnh giờ in của ảnh phát sinh"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="block normal-case space-y-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-0.5 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-800"
        />
        <input
          type="time"
          step={1}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="px-2 py-0.5 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-800"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3" /> {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-3 h-3" /> Huỷ
        </button>
      </span>
      <span className="block text-[10px] text-slate-500">Giờ Việt Nam. Phải nằm giữa giờ ảnh trước và ảnh sau trong hồ sơ.</span>
      {error && <span className="block text-[11px] font-semibold text-rose-600">{error}</span>}
    </span>
  );
};
