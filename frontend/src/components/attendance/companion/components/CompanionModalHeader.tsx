import React from 'react';
import { Users, X } from 'lucide-react';

interface CompanionModalHeaderProps {
  zoneName: string;
  onClose: () => void;
}

export const CompanionModalHeader: React.FC<CompanionModalHeaderProps> = ({ zoneName, onClose }) => {
  return (
    <div
      style={{
        backgroundColor: 'rgb(var(--bg-white))',
        borderBottom: '1px solid rgb(var(--border-slate-200))',
        padding: '0.85rem 1.15rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
            color: '#ffffff',
          }}
        >
          <Users size={19} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                backgroundColor: 'rgb(var(--bg-sky-100))',
                color: 'rgb(var(--text-sky-700))',
                padding: '1px 6px',
                borderRadius: '999px',
                border: '1px solid rgb(var(--border-sky-200))',
              }}
            >
              Tổ 02 Cán Bộ
            </span>
            <span style={{ fontSize: '0.7rem', color: 'rgb(var(--text-slate-500))' }}>{zoneName}</span>
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
            Điểm Danh Cán Bộ Đi Kèm (Co-Surveyor)
          </h2>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'rgb(var(--bg-slate-50))',
          border: '1px solid rgb(var(--border-slate-200))',
          color: 'rgb(var(--text-slate-500))',
          borderRadius: '0.5rem',
          padding: '0.35rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={17} />
      </button>
    </div>
  );
};
