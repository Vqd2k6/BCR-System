import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, Calculator } from 'lucide-react';

export type MetricType =
  | 'ECS'
  | 'VI'
  | 'I'
  | 'BRA'
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'V1'
  | 'V2'
  | 'V3'
  | 'V4'
  | 'V5'
  | 'V6';

interface Props {
  metric: MetricType;
  className?: string;
}

export const ScoreExplanationPopover: React.FC<Props> = ({ metric, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverPanelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: 'bottom' | 'top';
  }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;
    const gap = 8;

    const panelEl = popoverPanelRef.current;
    const panelW = panelEl ? panelEl.offsetWidth : Math.min(384, viewportW - margin * 2);
    const panelH = panelEl ? panelEl.offsetHeight : 320;

    // Căn ngang: ưu tiên bám mép trái nút (i) và mở rộng sang phải để không bị tràn mép trái bảng;
    // nếu vượt quá mép phải màn hình thì tự động lật sang bám mép phải nút (i) và kẹp trong khung nhìn.
    let nextLeft = triggerRect.left;
    if (nextLeft + panelW > viewportW - margin) {
      nextLeft = triggerRect.right - panelW;
    }
    nextLeft = Math.max(margin, Math.min(nextLeft, viewportW - panelW - margin));

    // Căn dọc: ưu tiên hiển thị bên dưới nút (i); nếu phía dưới bị hẹp thì tự động lật lên trên.
    const spaceBelow = viewportH - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    let placement: 'bottom' | 'top' = 'bottom';
    let nextTop = triggerRect.bottom + gap;

    if (spaceBelow < panelH && spaceAbove > spaceBelow) {
      placement = 'top';
      nextTop = Math.max(margin, triggerRect.top - panelH - gap);
    } else if (nextTop + panelH > viewportH - margin) {
      nextTop = Math.max(margin, viewportH - panelH - margin);
    }

    setCoords({
      top: Math.round(nextTop),
      left: Math.round(nextLeft),
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    // Đo lại sau frame đầu tiên khi DOM portal đã render đủ chiều cao thực tế
    const rafId = window.requestAnimationFrame(() => {
      updatePosition();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, metric, updatePosition]);

  // Đóng khi click ra ngoài hoặc nhấn phím Escape, đồng thời cập nhật vị trí khi cuộn/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverPanelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const getContent = () => {
    switch (metric) {
      case 'ECS':
        return {
          title: 'Điểm Hiện Trạng Kỹ Thuật (ECS - Existing Condition Score)',
          formula: 'ECS = E1 + E2 + E3 + E4 + E5 + E6  (Thang điểm 0 - 24)',
          description:
            'Chỉ số định lượng mức độ hư hỏng hiện hữu của công trình dựa trên tổng hợp 6 tiêu chí kỹ thuật chuẩn hóa từ Khảo sát Phase 1:',
          variables: [
            { code: 'E1', name: 'Hư Hỏng Nhìn Thấy Tường/Khối Xây', desc: 'Ánh xạ từ Burland Grade Max ở Bước 4: ≤1→0đ, 2→1đ, 3→2đ, 4→3đ, ≥5→4đ' },
            { code: 'E2', name: 'Khuyết Tật Kết Cấu Chịu Lực', desc: 'Max(Ý nghĩa kết cấu E2 của D-xx, Cờ kết cấu Bước 4) (0 - 4đ)' },
            { code: 'E3', name: 'Lún / Nghiêng / Võng Biến Dạng', desc: 'Max(Lún chênh, Độ nghiêng nhà, Độ võng dầm sàn) ở Bước 5 (0 - 4đ)' },
            { code: 'E4', name: 'Suy Giảm Vật Liệu & Độ Bền', desc: 'Max(Suy giảm vật liệu E4 của tất cả D-xx trên Z-xx & E-xx) (0 - 4đ)' },
            { code: 'E5', name: 'Lịch Sử Cơi Nới & Sự Cố Quá Khứ', desc: 'Max(5 câu hỏi phỏng vấn Bước 2) + Cộng hưởng (≥2 câu đạt 3đ → 4đ)' },
            { code: 'E6', name: 'Tình Trạng Chức Năng / Tổng Thể', desc: 'Max(Ảnh hưởng chức năng E6 [Kẹt cửa=2đ], Điểm số lượng vùng hư hỏng) (0 - 4đ)' },
          ],
          thresholds: [
            { range: '0 - 5 điểm', label: 'Tốt / Rất Thấp (GOOD)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: '6 - 10 điểm', label: 'Trung Bình (MEDIUM)', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: '11 - 16 điểm', label: 'Xuống Cấp / Cao (DEFICIENT)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: '17 - 24 điểm', label: 'Nguy Cấp / Rất Cao (CRITICAL)', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
      case 'VI':
        return {
          title: 'Chỉ Số Dễ Bị Tổn Thương (VI - Vulnerability Index)',
          formula: 'VI_avg = (V1 + V2 + V3 + V4 + V5 + V6) / 6  (Thang điểm 0.00 - 4.00)',
          description:
            'Đo lường độ nhạy cảm của công trình trước các biến động địa chất, rung chấn và hạ mực nước ngầm khi thi công tuyến Metro theo chuẩn Phase 1:',
          variables: [
            { code: 'V1', name: 'Công Năng & Nhóm Đối Tượng', desc: 'Đất trống/nhà bỏ trống (0đ), General (2đ), Important (3đ), Critical (4đ)' },
            { code: 'V2', name: 'Hệ Kết Cấu Chịu Lực Chính', desc: 'Khung BTCT (1đ), Hỗn hợp/Thép (2đ), Tường gạch chịu lực (3đ), Kém ổn định (4đ)' },
            { code: 'V3', name: 'Loại Móng & Hồ Sơ CAT Móng', desc: 'CAT 1-2 (1đ), CAT 3 (2đ), CAT 4 (3đ), CAT 5 (4đ)' },
            { code: 'V4', name: 'Tuổi Đời Công Trình & Cơi Nới', desc: '<10 năm (1đ), 10-25 năm (2đ), 26-40 năm (3đ), >40 năm hoặc cơi nới nặng ≥3đ (4đ)' },
            { code: 'V5', name: 'Hiện Trạng Kỹ Thuật (Từ ECS)', desc: 'GOOD (1đ), MEDIUM (2đ), DEFICIENT (3đ), CRITICAL (4đ)' },
            { code: 'V6', name: 'Thiết Bị Nhạy Cảm & Vận Hành 24/7', desc: 'Bình thường (1đ), Có thiết bị nhạy cảm (3đ), Vận hành 24/7 (4đ)' },
          ],
          thresholds: [
            { range: '≤ 1.50', label: 'Tổn Thương Thấp - V1 (LOW)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: '1.51 - 2.50', label: 'Tổn Thương Trung Bình - V2 (MEDIUM)', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: '2.51 - 3.25', label: 'Tổn Thương Cao - V3 (HIGH)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: '> 3.25', label: 'Tổn Thương Rất Cao - V4 (VERY_HIGH)', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
      case 'I':
        return {
          title: 'Phân Cấp Tác Động Thi Công Metro (Impact I1 - I4)',
          formula: 'I = f(Khoảng cách mép ga / tim hầm d, Nhóm đối tượng General vs Important/Critical)',
          description:
            'Ưu tiên tính theo khoảng cách đến mép ga / biên hố đào; nếu không có ga trong zone thì fallback theo khoảng cách đến tim hầm:',
          variables: [
            { code: 'I1 (Low)', name: 'Tác động thấp', desc: 'General: d ≥ 20m | Important/Critical: d ≥ 30m' },
            { code: 'I2 (Medium)', name: 'Tác động trung bình', desc: 'General: 10m ≤ d < 20m | Important/Critical: 20m ≤ d < 30m' },
            { code: 'I3 (High)', name: 'Tác động cao', desc: 'General: 5m ≤ d < 10m | Important/Critical: 10m ≤ d < 20m' },
            { code: 'I4 (Very High)', name: 'Tác động rất cao', desc: 'General: d < 5m | Important/Critical: d < 10m' },
          ],
          thresholds: [],
        };
      case 'E1':
        return {
          title: 'Tiêu Chí E1: Hư Hỏng Nhìn Thấy Tường / Khối Xây (Từ Burland Max)',
          formula: 'E1 = Quy đổi từ Cấp Burland cực đại (localMaxGrade) tại Bước 4',
          description: 'Quy đổi cấp nứt Burland 1977 của vùng tường kiến trúc Z-xx sang điểm thành phần E1 (0 - 4đ):',
          variables: [
            { code: '0 điểm', name: 'Burland Cấp 0 - 1', desc: 'w ≤ 1.0mm - Nứt tóc hoặc nứt chân chim vữa trát không đáng kể' },
            { code: '1 điểm', name: 'Burland Cấp 2 (Nhẹ)', desc: '1.0mm < w ≤ 5.0mm - Nứt nhẹ tường xây, cần trám trét bề mặt' },
            { code: '2 điểm', name: 'Burland Cấp 3 (Trung bình)', desc: '5.0mm < w ≤ 15.0mm - Vết nứt xuyên tường gạch' },
            { code: '3 điểm', name: 'Burland Cấp 4 (Nặng)', desc: '15.0mm < w ≤ 25.0mm - Hư hại tường gạch nghiêm trọng' },
            { code: '4 điểm', name: 'Burland Cấp 5 (Rất nặng)', desc: 'w > 25.0mm - Nguy cơ mất ổn định cục bộ hoặc toàn phần' },
          ],
          thresholds: [],
        };
      case 'E2':
        return {
          title: 'Tiêu Chí E2: Khuyết Tật Kết Cấu Chịu Lực Chính',
          formula: 'E2 = Max(structuralSignificanceE2 của D-xx, Cờ kết cấu Bước 4)',
          description: 'Mức độ hư hại kết cấu chịu lực chính (cột, dầm, sàn, tường chịu lực) và cờ cảnh báo kết cấu:',
          variables: [
            { code: '0 điểm', name: 'NONE (0đ)', desc: 'Không phát hiện khuyết tật ảnh hưởng kết cấu chịu lực' },
            { code: '1 điểm', name: 'LOW (1đ)', desc: 'Cờ kết cấu thấp / Rạn chân chim lớp bảo vệ bê tông' },
            { code: '2 điểm', name: 'MODERATE (2đ)', desc: 'Cờ kết cấu trung bình / Nứt nhẹ cấu kiện chịu lực' },
            { code: '3 điểm', name: 'HIGH (3đ)', desc: 'Cờ kết cấu cao / Nứt kết cấu đáng kể (Khóa an toàn chống hạ hạng)' },
            { code: '4 điểm', name: 'CRITICAL (4đ)', desc: 'Cờ kết cấu nguy cấp / Phá hủy tiết diện chịu lực chính' },
          ],
          thresholds: [],
        };
      case 'E3':
        return {
          title: 'Tiêu Chí E3: Lún / Nghiêng / Võng Biến Dạng',
          formula: 'E3 = Max(diffSettlement.level, buildingTilt.level, beamSagging.level)',
          description: 'Lấy mức độ cao nhất trong 3 chỉ tiêu biến dạng đo đạc tại Bước 5 (thang 0 - 4đ):',
          variables: [
            { code: '0 điểm', name: 'Mức 0', desc: 'Không ghi nhận lún chênh, nghiêng hay võng dầm sàn' },
            { code: '1 điểm', name: 'Mức 1 (Nhẹ)', desc: 'Biến dạng nhẹ trong giới hạn sai số cho phép' },
            { code: '2 điểm', name: 'Mức 2 (Trung bình)', desc: 'Lún chênh / nghiêng / võng nhận biết rõ cần theo dõi' },
            { code: '3 điểm', name: 'Mức 3 (Cao)', desc: 'Biến dạng vượt ngưỡng cảnh báo (Khóa an toàn chống hạ hạng)' },
            { code: '4 điểm', name: 'Mức 4 (Nguy cấp)', desc: 'Biến dạng nghiêm trọng đe dọa ổn định tổng thể công trình' },
          ],
          thresholds: [],
        };
      case 'E4':
        return {
          title: 'Tiêu Chí E4: Suy Giảm Vật Liệu & Độ Bền',
          formula: 'E4 = Max(materialDegradationE4 của toàn bộ khuyết tật D-xx)',
          description: 'Quét giá trị lớn nhất về suy giảm vật liệu (thấm ẩm, bong rộp, rỉ cốt thép) trên mọi vùng Z-xx và cấu kiện E-xx:',
          variables: [
            { code: '0 điểm', name: 'Không suy giảm', desc: 'Vật liệu khô ráo, đặc chắc' },
            { code: '1 điểm', name: 'Suy giảm nhẹ', desc: 'Ố ẩm nhẹ bề mặt sơn/vữa' },
            { code: '2 điểm', name: 'Suy giảm trung bình', desc: 'Thấm ẩm, bong tróc lớp trát cục bộ' },
            { code: '3 điểm', name: 'Suy giảm nặng', desc: 'Ăn mòn cốt thép, bong tách lớp bê tông bảo vệ' },
            { code: '4 điểm', name: 'Suy giảm nghiêm trọng', desc: 'Mất mát tiết diện thép chịu lực hoặc mục nát vật liệu' },
          ],
          thresholds: [],
        };
      case 'E5':
        return {
          title: 'Tiêu Chí E5: Lịch Sử Cơi Nới, Sự Cố & Tính Toàn Vẹn',
          formula: 'E5 = (Số câu > 2đ ≥ 2) ? 4 : Max(5 câu hỏi phỏng vấn Bước 2)',
          description: 'Đánh giá 5 yếu tố lịch sử (cơi nới, sửa chữa lớn, lún quá khứ, hư hại lân cận, cháy/ngập) kèm quy tắc cộng hưởng:',
          variables: [
            { code: '0 - 3 điểm', name: 'Điểm đơn lẻ cao nhất', desc: 'Lấy điểm lớn nhất trong 5 câu hỏi phỏng vấn lịch sử (0 - 3đ)' },
            { code: '4 điểm', name: 'Cộng hưởng rủi ro', desc: 'Khi có từ ≥ 2 câu hỏi cùng đạt mức 3đ → tự động cộng hưởng lên 4đ' },
          ],
          thresholds: [],
        };
      case 'E6':
        return {
          title: 'Tiêu Chí E6: Tình Trạng Chức Năng & Tổng Thể',
          formula: 'E6 = Min(4, Max(maxDefectE6, zoneScore))',
          description: 'Kết hợp giữa mức độ ảnh hưởng chức năng trực tiếp trên khuyết tật (kẹt cửa = 2đ) và tổng số vùng/cấu kiện bị hư hại:',
          variables: [
            { code: 'zoneScore = 0', name: '0 vùng hư hại', desc: 'Không có vùng cần sửa chữa hay cấu kiện E-xx bị hư hỏng' },
            { code: 'zoneScore = 1', name: '1 - 2 vùng hư hại', desc: 'Hư hỏng cục bộ ở 1 - 2 vùng/cấu kiện' },
            { code: 'zoneScore = 2', name: '3 - 4 vùng hư hại', desc: 'Hư hỏng phân bố ở 3 - 4 vùng/cấu kiện' },
            { code: 'zoneScore = 3', name: '≥ 5 vùng hư hại', desc: 'Hư hỏng lan rộng nhiều vùng trong công trình' },
            { code: 'maxDefectE6', name: 'Ảnh hưởng chức năng D-xx', desc: 'Lấy max functionalImpactE6 của D-xx (mã 5 Kẹt cửa quy đổi = 2đ)' },
          ],
          thresholds: [],
        };
      case 'V1':
        return {
          title: 'Tiêu Chí V1: Công Năng & Nhóm Đối Tượng Công Trình',
          formula: 'V1 = f(usageFunction, surveyCaseType, objectGroup)',
          description: 'Xét điều kiện Đất trống / Nhà bỏ trống (0đ) trước, sau đó xét theo Nhóm đối tượng công trình ở Bước 1:',
          variables: [
            { code: '0 điểm', name: 'Normal (0đ)', desc: 'Đất trống (VACANT_LAND) hoặc Nhà bỏ trống' },
            { code: '2 điểm', name: 'General (2đ)', desc: 'Nhà ở dân sinh thông thường (GENERAL)' },
            { code: '3 điểm', name: 'Important (3đ)', desc: 'Công trình quan trọng, thương mại/dịch vụ lớn (IMPORTANT)' },
            { code: '4 điểm', name: 'Critical (4đ)', desc: 'Công trình đặc biệt quan trọng, nhạy cảm cao (CRITICAL)' },
          ],
          thresholds: [],
        };
      case 'V2':
        return {
          title: 'Tiêu Chí V2: Hệ Kết Cấu Chịu Lực Chính',
          formula: 'V2 = f(structureSystem tại Bước 2.1)',
          description: 'Độ nhạy cảm theo loại hệ kết cấu chịu lực chính của công trình:',
          variables: [
            { code: '1 điểm', name: 'Khung BTCT toàn khối (RC)', desc: 'Hệ khung bê tông cốt thép toàn khối chịu lực tốt' },
            { code: '2 điểm', name: 'Kết cấu hỗn hợp / Khung thép', desc: 'Hệ kết cấu hỗn hợp hoặc khung thép' },
            { code: '3 điểm', name: 'Tường gạch chịu lực (Masonry)', desc: 'Tường gạch xây chịu lực, nhạy cảm với lún lệch' },
            { code: '4 điểm', name: 'Kết cấu tạm / Kém ổn định', desc: 'Nhà tạm, vật liệu thô sơ kém ổn định' },
          ],
          thresholds: [],
        };
      case 'V3':
        return {
          title: 'Tiêu Chí V3: Loại Móng & Hồ Sơ CAT Móng',
          formula: 'V3 = f(foundationCatScore 1..5 tại Bước 2.1)',
          description: 'Tự động ánh xạ từ điểm phân loại CAT móng (1 - 5) sang thang điểm V3 (1 - 4đ):',
          variables: [
            { code: '1 điểm', name: 'CAT 1 hoặc CAT 2', desc: 'Có hồ sơ hoàn công (CAT 1) hoặc hồ sơ thiết kế móng (CAT 2)' },
            { code: '2 điểm', name: 'CAT 3', desc: 'Chủ nhà nhớ rõ kết cấu móng hoặc kiểm tra thực tế' },
            { code: '3 điểm', name: 'CAT 4', desc: 'Suy luận kỹ thuật theo loại nhà và thời kỳ xây dựng' },
            { code: '4 điểm', name: 'CAT 5', desc: 'Không rõ thông tin móng / giả định bất lợi nhất' },
          ],
          thresholds: [],
        };
      case 'V4':
        return {
          title: 'Tiêu Chí V4: Tuổi Đời Công Trình & Cơi Nới',
          formula: 'V4 = (renovationLoad ≥ 3) ? 4 : f(Năm hiện tại - constructionYear)',
          description: 'Tính theo tuổi công trình (năm hiện tại trừ năm xây dựng) và đẩy lên 4đ nếu có cơi nới tải trọng nặng:',
          variables: [
            { code: '1 điểm', name: 'Tuổi < 10 năm', desc: 'Công trình mới xây dựng dưới 10 năm' },
            { code: '2 điểm', name: 'Tuổi 10 - 25 năm', desc: 'Công trình đã khai thác 10 đến 25 năm' },
            { code: '3 điểm', name: 'Tuổi 26 - 40 năm', desc: 'Công trình đã khai thác 26 đến 40 năm' },
            { code: '4 điểm', name: 'Tuổi > 40 năm hoặc Cơi nới nặng', desc: 'Trên 40 năm hoặc có cơi nới tải trọng nặng (renovationLoad ≥ 3)' },
          ],
          thresholds: [],
        };
      case 'V5':
        return {
          title: 'Tiêu Chí V5: Hiện Trạng Kỹ Thuật (Ánh Xạ Từ Hạng ECS)',
          formula: 'V5 = f(ECS Class)',
          description: 'Tự động quy đổi từ phân hạng hiện trạng kỹ thuật ECS sang điểm thành phần V5:',
          variables: [
            { code: '1 điểm', name: 'ECS = GOOD (0 - 5đ)', desc: 'Hiện trạng kỹ thuật tốt' },
            { code: '2 điểm', name: 'ECS = MEDIUM (6 - 10đ)', desc: 'Hiện trạng kỹ thuật trung bình' },
            { code: '3 điểm', name: 'ECS = DEFICIENT (11 - 16đ)', desc: 'Hiện trạng kỹ thuật xuống cấp' },
            { code: '4 điểm', name: 'ECS = CRITICAL (17 - 24đ)', desc: 'Hiện trạng kỹ thuật nguy cấp' },
          ],
          thresholds: [],
        };
      case 'V6':
        return {
          title: 'Tiêu Chí V6: Thiết Bị Nhạy Cảm & Chế Độ Vận Hành 24/7',
          formula: 'V6 = continuousOperation247 ? 4 : (sensitiveEquipment.has ? 3 : 1)',
          description: 'Tự động ánh xạ từ thông tin phỏng vấn ở Bước 2.2 về thiết bị nhạy cảm và vận hành liên tục:',
          variables: [
            { code: '1 điểm', name: 'Bình thường', desc: 'Không có thiết bị nhạy cảm và không vận hành đặc biệt 24/7' },
            { code: '3 điểm', name: 'Có thiết bị nhạy cảm', desc: 'Có máy móc/thiết bị chính xác nhạy cảm rung chấn (sensitiveEquipment.has = true)' },
            { code: '4 điểm', name: 'Vận hành liên tục 24/7', desc: 'Công trình hoạt động liên tục 24/7 không thể gián đoạn' },
          ],
          thresholds: [],
        };
      case 'BRA':
      default:
        return {
          title: 'Đánh Giá Rủi Ro Cơ Sở (BRA - Baseline Risk Assessment)',
          formula: 'BRA = Ma Trận 4×4 (Vulnerability V1..V4 × Impact I1..I4)',
          description:
            'Kết hợp giữa mức độ dễ tổn thương VI (V1 Low, V2 Medium, V3 High, V4 Very High) và cấp tác động thi công Metro (I1..I4):',
          variables: [
            { code: 'V1 × (I1..I4)', name: 'Tổn thương Thấp', desc: 'I1→Low, I2→Low, I3→Medium, I4→High' },
            { code: 'V2 × (I1..I4)', name: 'Tổn thương Trung bình', desc: 'I1→Low, I2→Medium, I3→Medium, I4→High' },
            { code: 'V3 × (I1..I4)', name: 'Tổn thương Cao', desc: 'I1→Medium, I2→Medium, I3→High, I4→Very High' },
            { code: 'V4 × (I1..I4)', name: 'Tổn thương Rất cao', desc: 'I1→High, I2→High, I3→Very High, I4→Very High' },
          ],
          thresholds: [
            { range: 'Low (Thấp)', label: 'Rủi ro thấp - Theo dõi định kỳ bình thường', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
            { range: 'Medium (Trung bình)', label: 'Rủi ro trung bình - Quan trắc lún & vết nứt định kỳ', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            { range: 'High (Cao)', label: 'Rủi ro cao - Giám sát chuyển vị & rung chấn chặt chẽ', color: 'text-amber-700 bg-amber-50 border-amber-300' },
            { range: 'Very High (Rất cao)', label: 'Rủi ro rất cao - Bắt buộc kiểm toán & phương án bảo vệ/gia cố', color: 'text-rose-700 bg-rose-50 border-rose-300' },
          ],
        };
    }
  };

  const data = getContent();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-1 rounded-full transition-colors cursor-pointer ${
          isOpen
            ? 'text-sky-600 bg-sky-100 ring-2 ring-sky-400/50'
            : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
        }`}
        title={`Bấm để xem công thức và bảng ngưỡng tính toán ${metric}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverPanelRef}
            role="dialog"
            aria-label={data.title}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="fixed w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 text-xs text-slate-700 z-[10050] animate-in fade-in zoom-in-95 duration-150 space-y-3 font-normal text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs leading-snug">{data.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Công thức toán học */}
            <div className="p-2.5 bg-slate-900 text-sky-300 rounded-xl font-mono text-[11px] font-bold text-center tracking-wide shadow-inner break-words">
              {data.formula}
            </div>

            {/* Mô tả nghiệp vụ */}
            <p className="text-[11px] text-slate-600 leading-relaxed">{data.description}</p>

            {/* Các biến thành phần */}
            {data.variables.length > 0 && (
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
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
                      className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${t.color}`}
                    >
                      <span className="font-mono font-bold shrink-0">{t.range}</span>
                      <span className="font-bold text-right">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
