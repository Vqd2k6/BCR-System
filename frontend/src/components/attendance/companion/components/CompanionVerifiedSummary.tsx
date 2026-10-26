import React from 'react';
import {
  ShieldCheck,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { resolveAttendancePhotoUrl } from '../../../../core/utils/metroZoneUtils';
import type { CompanionRecord } from '../types';

interface CompanionVerifiedSummaryProps {
  checkInData: CompanionRecord;
  zoneName?: string;
  todayStr: string;
  changeCount: number;
  onReCheckIn: () => void;
}

export const CompanionVerifiedSummary: React.FC<CompanionVerifiedSummaryProps> = ({
  checkInData,
  zoneName = 'Ga phụ trách',
  todayStr,
  changeCount,
  onReCheckIn,
}) => {
  const displaySelfieUrl = resolveAttendancePhotoUrl(checkInData.selfieUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Verified Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgb(var(--bg-green-50)) 0%, rgb(var(--bg-green-100)) 100%)',
          border: '1.5px solid rgb(var(--border-green-300))',
          borderRadius: '0.85rem',
          padding: '0.95rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgb(var(--bg-green-200))',
            color: 'rgb(var(--text-green-700))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'rgb(var(--text-green-900))', textTransform: 'uppercase' }}>
              Cán bộ đi kèm đã điểm danh
            </span>
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '999px',
                backgroundColor: checkInData.status === 'FLAGGED_WARNING' ? 'rgb(var(--bg-amber-100))' : 'rgb(var(--bg-green-100))',
                color: checkInData.status === 'FLAGGED_WARNING' ? 'rgb(var(--text-amber-700))' : 'rgb(var(--text-green-700))',
                border: `1px solid ${checkInData.status === 'FLAGGED_WARNING' ? 'rgb(var(--border-amber-200))' : 'rgb(var(--border-green-300))'}`,
              }}
            >
              {checkInData.status === 'FLAGGED_WARNING' ? 'Cảnh báo vị trí' : 'Hợp lệ'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgb(var(--text-green-800))', marginTop: '3px' }}>
            Ghi nhận lúc: <strong>{checkInData.time}</strong> hôm nay ({todayStr})
          </div>
        </div>
      </div>

      {/* Co-Surveyor Personal Info & Photo Card */}
      <div
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: '1px solid rgb(var(--border-slate-200))',
          borderRadius: '0.85rem',
          padding: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {displaySelfieUrl ? (
          <img
            src={displaySelfieUrl}
            alt={checkInData.name}
            style={{
              width: '110px',
              height: '140px',
              borderRadius: '0.65rem',
              objectFit: 'cover',
              border: '2px solid rgb(var(--border-sky-300))',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '110px',
              height: '140px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgb(var(--bg-slate-50))',
              border: '2px dashed rgb(var(--border-slate-300))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgb(var(--text-slate-400))',
              flexShrink: 0,
            }}
          >
            <User size={32} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.775rem' }}>
          <div>
            <span style={{ color: 'rgb(var(--text-slate-400))', fontSize: '0.7rem', display: 'block' }}>Họ tên cán bộ:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>{checkInData.name}</span>
          </div>

          <div>
            <span style={{ color: 'rgb(var(--text-slate-400))', fontSize: '0.7rem', display: 'block' }}>Vai trò / Chức danh:</span>
            <span style={{ fontWeight: 700, color: 'rgb(var(--text-sky-600))' }}>{checkInData.role}</span>
          </div>

          {checkInData.phone && (
            <div>
              <span style={{ color: 'rgb(var(--text-slate-400))', fontSize: '0.7rem', display: 'block' }}>Số điện thoại:</span>
              <span style={{ color: 'rgb(var(--text-slate-700))', fontWeight: 600 }}>{checkInData.phone}</span>
            </div>
          )}

          <div>
            <span style={{ color: 'rgb(var(--text-slate-400))', fontSize: '0.7rem', display: 'block' }}>Khoảng cách tới {zoneName}:</span>
            <span style={{ fontWeight: 700, color: 'rgb(var(--text-slate-900))' }}>{checkInData.distance}m</span>
          </div>
        </div>
      </div>

      {/* Specific Out of Bounds Note for Companion */}
      {checkInData.notes && (
        <div
          style={{
            backgroundColor: 'rgb(var(--bg-amber-50))',
            border: '1px solid rgb(var(--border-amber-200))',
            borderRadius: '0.65rem',
            padding: '0.65rem 0.85rem',
            fontSize: '0.75rem',
            color: 'rgb(var(--text-amber-800))',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
          }}
        >
          <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <span style={{ fontWeight: 700, display: 'block' }}>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
            <span style={{ color: 'rgb(var(--text-amber-900))', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
              &quot;{checkInData.notes}&quot;
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons: limit notice if >= 3, otherwise re-checkin button */}
      <div style={{ marginTop: '0.35rem' }}>
        {changeCount >= 3 ? (
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-rose-50))',
              border: '1.5px solid rgb(var(--border-rose-200))',
              borderRadius: '0.65rem',
              padding: '0.75rem 0.95rem',
              fontSize: '0.775rem',
              color: 'rgb(var(--text-rose-800))',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={17} color="#e11d48" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>Đã đạt giới hạn điểm danh hôm nay</strong>
              <span>Cán bộ đi kèm chỉ được phép điểm danh / đổi tối đa 3 lần/ngày (Đã dùng 3/3 lần).</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReCheckIn}
            className="cursor-pointer"
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '0.65rem',
              border: '1px solid rgb(var(--border-slate-300))',
              backgroundColor: 'rgb(var(--bg-slate-50))',
              color: 'rgb(var(--text-slate-700))',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <RotateCcw size={14} />
            <span>Điểm danh lại / Đổi người ({changeCount}/3 lần hôm nay)</span>
          </button>
        )}
      </div>
    </div>
  );
};
