import React, { useState, useRef, useEffect } from 'react';
import { Info, X, Calculator, ShieldCheck, AlertCircle } from 'lucide-react';

export type MetricType = 'ECS' | 'VI' | 'I' | 'BRA';

interface Props {
  metric: MetricType;
  className?: string;
}

export const ScoreExplanationPopover: React.FC<Props> = ({ metric, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const getContent = () => {
    switch (metric) {
      case 'ECS':
        return {
          title: 'Điểm Hư Hỏng Kết Cấu (ECS - Engineering Condition Score)',
          formula: 'ECS = E1 + E2 + E3 + E4 + E5 + E6  (Thang điểm 0 - 24)',
          description:
            'Chỉ số định lượng mức độ hư hỏng hiện hữu của công trình dựa trên tổng hợp 6 nhóm khuyết tật kỹ thuật theo tiêu chuẩn khảo sát Metro Tuyến 2:',
          variables: [
            { code: 'E1', name: 'Cấp Nứt Burland Cực Đại', desc: 'Bề rộng khe nứt tường/sàn lớn nhất (0 - 4đ)' },
            { code: 'E2', name: 'Khuyết Tật Dầm/Cột Chịu Lực', desc: 'Mức độ phá hủy cấu kiện chịu lực chính (0 - 4đ)' },
            { code: 'E3', name: 'Lún Lệch Móng Hiện Hữu', desc: 'Dấu hiệu lún nứt bất đối xứng chân tường (0 - 4đ)' },
            { code: 'E4', name: 'Độ Nghiêng Tổng Thể Nhà', desc: 'Độ nghiêng đo bằng máy toàn đạc / quả dọi (0 - 4đ)' },
            { code: 'E5', name: 'Độ Võng Dầm Sàn', desc: 'Độ võng nhìn thấy hoặc đo đạc trên trần/dầm (0 - 4đ)' },
            { code: 'E6', name: 'Bất Thường Kết Cấu Khác', desc: 'Cải tạo sai phép, rỉ cốt thép, thấm dột cốt lõi (0 - 4đ)' },
          ],
          thresholds: [
            { range: '0 - 5 điểm', label: 'Tốt / Rất Thấp (GOOD)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: '6 - 10 điểm', label: 'Trung Bình (MEDIUM)', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: '11 - 16 điểm', label: 'Xuống Cấp / Cao (DEFICIENT)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: '> 16 điểm', label: 'Nguy Cấp / Rất Cao (CRITICAL)', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
      case 'VI':
        return {
          title: 'Chỉ Số Dễ Bị Tổn Thương (VI - Vulnerability Index)',
          formula: 'VI = (V1 + V2 + V3 + V4) / 4  (Thang điểm 0.0 - 4.0)',
          description:
            'Đo lường độ nhạy cảm của công trình trước các biến động địa chất, rung chấn và hạ mực nước ngầm khi máy đào TBM / thi công cọc ngầm Metro hoạt động:',
          variables: [
            { code: 'V1', name: 'Tuổi Thọ & Niên Hạn', desc: 'Năm xây dựng và mức độ lão hóa vật liệu bê tông/gạch' },
            { code: 'V2', name: 'Loại Hình Móng & Kết Cấu', desc: 'Móng nông / móng cọc, kết cấu tường chịu lực hay khung BTCT' },
            { code: 'V3', name: 'Cự Ly Đến Tim Tuyến Metro', desc: 'Khoảng cách không gian từ hố móng công trình đến vách hầm' },
            { code: 'V4', name: 'Tình Trạng Ranh Giới Tiếp Giáp', desc: 'Nhà chung tường, khe lún liền kề với các công trình lân cận' },
          ],
          thresholds: [
            { range: '< 1.50', label: 'Rủi Ro Thấp (LOW)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: '1.50 - 2.49', label: 'Rủi Ro Trung Bình (MEDIUM)', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: '2.50 - 3.49', label: 'Rủi Ro Cao (HIGH)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: '≥ 3.50', label: 'Rủi Ro Rất Cao (VERY HIGH)', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
      case 'I':
        return {
          title: 'Hệ Số Tầm Quan Trọng Công Năng (I - Importance Factor)',
          formula: 'Hệ số phân cấp an toàn & pháp lý công trình (0.0 - 4.0)',
          description:
            'Quy định mức độ ưu tiên bảo vệ và bồi thường theo cấp công trình trong hành lang ảnh hưởng tuyến Metro:',
          variables: [
            { code: '0.0', name: 'Đất Trống / Nhà Bỏ Hoang', desc: 'Không có người cư trú, không phát sinh thiệt hại sinh mạng' },
            { code: '2.0', name: 'Nhà Ở Dân Sinh Riêng Lẻ', desc: 'Nhà phố thường, biệt thự gia đình cư trú ổn định' },
            { code: '3.0', name: 'Công Trình Tập Trung Đông Người', desc: 'Trường học, bệnh viện, chung cư, khách sạn lớn (Cấp II)' },
            { code: '4.0', name: 'Công Trình Trọng Điểm Quốc Gia', desc: 'Di tích lịch sử, bảo tàng, hạ tầng năng lượng ngầm (Cấp I)' },
          ],
          thresholds: [],
        };
      case 'BRA':
      default:
        return {
          title: 'Đánh Giá Rủi Ro Tổng Hợp Công Trình (BRA - Building Risk Assessment)',
          formula: 'BRA = Ma Trận 2D (ECS × VI) kết hợp Phán Quyết Kỹ Sư Trưởng',
          description:
            'Cấp rủi ro tổng thể quyết định hành động kỹ thuật trước khi bàn giao mặt bằng thi công Metro Tuyến 2:',
          variables: [
            { code: 'Gốc Hiện Trường', name: 'Thuật toán nội suy GIS', desc: 'Tính toán tự động từ hồ sơ khảo sát thực địa của KSV' },
            { code: 'Can Thiệp Override', name: 'Kỹ Sư Trưởng Zone Admin', desc: 'Hiệu chỉnh chuyên môn khi có yếu tố địa tầng/kết cấu đặc thù' },
          ],
          thresholds: [
            { range: 'Cấp Thấp (LOW)', label: 'Cho phép thi công ngầm bình thường', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: 'Cấp TB (MEDIUM)', label: 'Theo dõi mốc biến dạng định kỳ tuần/tháng', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: 'Cấp Cao (HIGH)', label: 'Quan trắc rung chấn liên tục, lập phương án bảo vệ', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: 'Nguy Cấp (CRITICAL)', label: 'Bắt buộc khảo sát chuyên sâu Phase 2 & gia cố móng', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
    }
  };

  const data = getContent();

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
        title={`Bấm để xem công thức và bảng ngưỡng tính toán ${metric}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 text-xs text-slate-700 z-50 animate-in fade-in slide-in-from-top-1 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                <Calculator className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs leading-snug">{data.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Công thức toán học */}
          <div className="p-2.5 bg-slate-900 text-sky-300 rounded-xl font-mono text-[11px] font-bold text-center tracking-wide shadow-inner">
            {data.formula}
          </div>

          {/* Mô tả nghiệp vụ */}
          <p className="text-[11px] text-slate-600 leading-relaxed">{data.description}</p>

          {/* Các biến thành phần */}
          {data.variables.length > 0 && (
            <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
              <span className="font-bold text-slate-800 text-[10px] uppercase block mb-1">
                Các Thành Phần Cấu Thành:
              </span>
              {data.variables.map((v, i) => (
                <div key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="font-mono font-bold text-sky-700 shrink-0">{v.code}:</span>
                  <span className="text-slate-700">
                    <strong>{v.name}</strong> - {v.desc}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bảng ngưỡng rủi ro */}
          {data.thresholds.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="font-bold text-slate-800 text-[10px] uppercase block">
                Bảng Ngưỡng Phân Loại Tiêu Chuẩn Kỹ Thuật:
              </span>
              <div className="grid grid-cols-1 gap-1 text-[11px]">
                {data.thresholds.map((t, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-2.5 py-1 rounded-lg border text-[11px] font-medium ${t.color}`}
                  >
                    <span className="font-mono font-bold">{t.range}</span>
                    <span className="font-bold">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
