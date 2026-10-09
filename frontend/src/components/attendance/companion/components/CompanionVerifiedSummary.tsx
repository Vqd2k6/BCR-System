import React from 'react';
import {
  ShieldCheck,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { CompanionRecord } from '../types';

interface CompanionVerifiedSummaryProps {
  checkInData: CompanionRecord;
  todayStr: string;
  changeCount: number;
  onReCheckIn: () => void;
}

export const CompanionVerifiedSummary: React.FC<CompanionVerifiedSummaryProps> = ({
  checkInData,
  todayStr,
  changeCount,
  onReCheckIn,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Verified Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1.5px solid #86efac',
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
            backgroundColor: '#bbf7d0',
            color: '#15803d',
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
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#14532d', textTransform: 'uppercase' }}>
              Cán bộ đi kèm đã điểm danh
            </span>
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '999px',
                backgroundColor: checkInData.status === 'FLAGGED_WARNING' ? '#fef3c7' : '#dcfce7',
                color: checkInData.status === 'FLAGGED_WARNING' ? '#b45309' : '#15803d',
                border: `1px solid ${checkInData.status === 'FLAGGED_WARNING' ? '#fde68a' : '#86efac'}`,
              }}
            >
              {checkInData.status === 'FLAGGED_WARNING' ? 'Cảnh báo vị trí' : 'Hợp lệ'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '3px' }}>
            Ghi nhận lúc: <strong>{checkInData.time}</strong> hôm nay ({todayStr})
          </div>
        </div>
      </div>

      {/* Co-Surveyor Personal Info & Photo Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.85rem',
          padding: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {checkInData.selfieUrl ? (
          <img
            src={checkInData.selfieUrl}
            alt={checkInData.name}
            style={{
              width: '110px',
              height: '140px',
              borderRadius: '0.65rem',
              objectFit: 'cover',
              border: '2px solid #7dd3fc',
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
              backgroundColor: '#f8fafc',
              border: '2px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              flexShrink: 0,
            }}
          >
            <User size={32} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.775rem' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Họ tên cán bộ:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{checkInData.name}</span>
          </div>

          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Vai trò / Chức danh:</span>
            <span style={{ fontWeight: 700, color: '#0284c7' }}>{checkInData.role}</span>
          </div>

          {checkInData.phone && (
            <div>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Số điện thoại:</span>
              <span style={{ color: '#334155', fontWeight: 600 }}>{checkInData.phone}</span>
            </div>
          )}

          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Khoảng cách tới Ga S9:</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{checkInData.distance}m</span>
          </div>
        </div>
      </div>

      {/* Specific Out of Bounds Note for Companion */}
      {checkInData.notes && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '0.65rem',
            padding: '0.65rem 0.85rem',
            fontSize: '0.75rem',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
          }}
        >
          <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <span style={{ fontWeight: 700, display: 'block' }}>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
            <span style={{ color: '#78350f', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
              "{checkInData.notes}"
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons: limit notice if >= 3, otherwise re-checkin button */}
      <div style={{ marginTop: '0.35rem' }}>
        {changeCount >= 3 ? (
          <div
            style={{
              backgroundColor: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '0.65rem',
              padding: '0.75rem 0.95rem',
              fontSize: '0.775rem',
              color: '#9f1239',
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
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '0.65rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
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
