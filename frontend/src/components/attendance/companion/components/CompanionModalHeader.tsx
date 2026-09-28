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
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
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
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                padding: '1px 6px',
                borderRadius: '999px',
                border: '1px solid #bae6fd',
              }}
            >
              Tổ 02 Cán Bộ
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{zoneName}</span>
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            Điểm Danh Cán Bộ Đi Kèm (Co-Surveyor)
          </h2>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          color: '#64748b',
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
