import React from 'react';
import {
  FileText,
  Clock,
  GitCompare,
  Navigation,
  UserX,
} from 'lucide-react';

interface StatusHelpModalProps {
  show: boolean;
}

export const StatusHelpModal: React.FC<StatusHelpModalProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '0.75rem 1rem',
        fontSize: '0.775rem',
        color: '#475569',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <FileText size={14} color="#0284c7" />
        <span>
          <strong>Chưa làm / Đang làm dở:</strong> Cần thực hiện hoặc tiếp tục hoàn thiện hồ sơ Phase 1.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Clock size={14} color="#0284c7" />
        <span>
          <strong>Đã nộp (Chờ duyệt):</strong> Đã gửi Zone Admin phê duyệt, có thể xem lại thông tin.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <GitCompare size={14} color="#9333ea" />
        <span>
          <strong>Khảo sát Phase 2:</strong> Kích hoạt sau khi Phase 1 được duyệt để đối soát biến động trước thi công.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Navigation size={14} color="#0369a1" />
        <span>
          <strong>Chỉ đường:</strong> Mở Google Maps dẫn đường trực tiếp tới vị trí thửa đất.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <UserX size={14} color="#dc2626" />
        <span>
          <strong>Báo vắng mặt:</strong> Ghi nhận chủ hộ vắng nhà kèm hình ảnh thực địa và dán giấy hẹn.
        </span>
      </div>
    </div>
  );
};
