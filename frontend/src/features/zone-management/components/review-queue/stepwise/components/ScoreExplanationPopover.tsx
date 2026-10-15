import React, { useState, useRef, useEffect } from 'react';
import { Info, X, Calculator, ShieldCheck, AlertCircle } from 'lucide-react';

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
      case 'E1':
        return {
          title: 'Tiêu Chí E1: Cấp Nứt Burland Cực Đại',
          formula: 'E1 = f(Bề rộng vết nứt lớn nhất w_max) theo Burland 1977',
          description: 'Phân loại bề rộng vết nứt lớn nhất ghi nhận trên toàn bộ công trình theo thang tiêu chuẩn quốc tế:',
          variables: [
            { code: '0 điểm', name: 'Cấp 0 (Tóc)', desc: 'w < 0.1mm - Nứt tóc không đáng kể' },
            { code: '1 điểm', name: 'Cấp 1 (Chân chim)', desc: '0.1mm ≤ w < 1.0mm - Nứt chân chim vữa trát' },
            { code: '2 điểm', name: 'Cấp 2 (Nhẹ)', desc: '1.0mm ≤ w < 5.0mm - Cần trám trét lại bề mặt' },
            { code: '3 điểm', name: 'Cấp 3 (Trung bình)', desc: '5.0mm ≤ w < 15.0mm - Nứt gạch xuyên tường' },
            { code: '4 điểm', name: 'Cấp 4/5 (Nặng/Nguy cấp)', desc: 'w ≥ 15.0mm - Nứt kết cấu nguy cơ cao' },
          ],
          thresholds: [],
        };
      case 'E2':
        return {
          title: 'Tiêu Chí E2: Khuyết Tật Cấu Kiện Chịu Lực Chính',
          formula: 'E2 = Max(Điểm nứt cột, dầm, sàn, cầu thang BTCT)',
          description: 'Mức độ phá hủy và suy giảm khả năng chịu lực của khung xương công trình:',
          variables: [
            { code: '0 điểm', name: 'Nguyên vẹn', desc: 'Không phát hiện nứt trên cấu kiện chịu lực' },
            { code: '1 điểm', name: 'Rạn chân chim', desc: 'Nứt chân chim lớp vữa bảo vệ bê tông' },
            { code: '2 điểm', name: 'Nứt chịu lực nhẹ', desc: 'Vết nứt bề mặt dầm/cột w < 1mm' },
            { code: '3 điểm', name: 'Nứt kết cấu đáng kể', desc: 'Vết nứt uốn/cắt 1mm ≤ w < 3mm' },
            { code: '4 điểm', name: 'Hư hại nghiêm trọng', desc: 'Vết nứt xuyên tiết diện w ≥ 3mm, bong bê tông lộ thép' },
          ],
          thresholds: [],
        };
      case 'E3':
        return {
          title: 'Tiêu Chí E3: Độ Nghiêng & Lún Lệch Hiện Hữu',
          formula: 'E3 = Max(Đo lún chân tường, lệch tầng, nứt tiếp giáp)',
          description: 'Dấu hiệu biến dạng lún không đều chân móng tích lũy từ quá khứ:',
          variables: [
            { code: '0 điểm', name: 'Không lún lệch', desc: 'Không có vết nứt bậc thang hay tách khe lún' },
            { code: '1 điểm', name: 'Lún nhẹ', desc: 'Vết nứt chân tường chân chim < 1mm' },
            { code: '2 điểm', name: 'Lún trung bình', desc: 'Vết nứt góc tường dạng bậc thang 1 - 3mm' },
            { code: '3 điểm', name: 'Lún rõ rệt', desc: 'Tách khe tiếp giáp nhà liền kề 3 - 10mm' },
            { code: '4 điểm', name: 'Lún chênh nghiêm trọng', desc: 'Vết nứt bậc thang xuyên tường > 10mm, kẹt cửa' },
          ],
          thresholds: [],
        };
      case 'E4':
        return {
          title: 'Tiêu Chí E4: Độ Nghiêng Tổng Thể Nhà',
          formula: 'E4 = f(Góc nghiêng θ = Δ/H đo bằng laser/toàn đạc)',
          description: 'Góc nghiêng lệch phương đứng của khối nhà so với tiêu chuẩn TCXDVN:',
          variables: [
            { code: '0 điểm', name: 'θ < 1/500', desc: 'Độ nghiêng trong giới hạn sai số cho phép' },
            { code: '1 điểm', name: '1/500 ≤ θ < 1/300', desc: 'Nghiêng nhẹ, mắt thường khó nhận thấy' },
            { code: '2 điểm', name: '1/300 ≤ θ < 1/150', desc: 'Nghiêng nhận biết được, bắt đầu ảnh hưởng thoát nước' },
            { code: '3 điểm', name: '1/150 ≤ θ < 1/100', desc: 'Nghiêng rõ rệt, vượt ngưỡng an toàn vận hành' },
            { code: '4 điểm', name: 'θ ≥ 1/100', desc: 'Nghiêng nghiêm trọng, nguy cơ mất ổn định lật' },
          ],
          thresholds: [],
        };
      case 'E5':
        return {
          title: 'Tiêu Chí E5: Lịch Sử Sửa Chữa & Cộng Hưởng Hư Hỏng',
          formula: 'E5 = Phỏng vấn 5 câu hỏi chuẩn hóa & cộng hưởng biến dạng',
          description: 'Đánh giá nguy cơ cộng hưởng từ các đợt thi công xung quanh và tiền sử cơi nới nâng tầng:',
          variables: [
            { code: '0 điểm', name: 'An toàn tuyệt đối', desc: 'Nhà xây nguyên khối, không sửa chữa lớn, chưa từng nứt' },
            { code: '1 điểm', name: 'Ít ảnh hưởng', desc: 'Có cải tạo nhỏ nội thất, không can thiệp kết cấu' },
            { code: '2 điểm', name: 'Trung bình', desc: 'Đã nâng thêm tầng hoặc kề cận công trình đào hóng' },
            { code: '3 điểm', name: 'Nguy cơ cao', desc: 'Cắt đục cấu kiện chịu lực hoặc từng nứt do chấn động' },
            { code: '4 điểm', name: 'Cộng hưởng đặc biệt', desc: 'Khẳng định ≥2 yếu tố cộng hưởng biến dạng nguy cấp' },
          ],
          thresholds: [],
        };
      case 'E6':
        return {
          title: 'Tiêu Chí E6: Bất Thường Kết Cấu Khác & Môi Trường',
          formula: 'E6 = Tổng hợp khuyết tật đặc thù (rỉ cốt thép, thấm dột, tường rỗng)',
          description: 'Các yếu tố ăn mòn, phong hóa hóa học và môi trường xâm thực cốt thép:',
          variables: [
            { code: '0 điểm', name: 'Bình thường', desc: 'Môi trường khô ráo, bê tông đặc chắc' },
            { code: '1 điểm', name: 'Thấm dột nhẹ', desc: 'Ẩm mốc bề mặt sơn, chưa ăn mòn cốt thép' },
            { code: '2 điểm', name: 'Thấm ẩm liên tục', desc: 'Rêu mốc, bong tróc lớp trát diện tích lớn' },
            { code: '3 điểm', name: 'Ăn mòn lộ thép', desc: 'Vết nứt dọc rỉ nở cốt thép, ố vàng bề mặt bê tông' },
            { code: '4 điểm', name: 'Mất mát tiết diện', desc: 'Bê tông bong lở từng mảng, cốt thép rỉ đứt giảm tiết diện' },
          ],
          thresholds: [],
        };
      case 'V1':
        return {
          title: 'Tiêu Chí V1: Tầm Quan Trọng & Niên Hạn Công Trình',
          formula: 'V1 = f(Cấp công trình theo Thông tư BXD & Năm xây dựng)',
          description: 'Hệ số trách nhiệm pháp lý và mức độ suy thoái vật liệu theo thời gian:',
          variables: [
            { code: '0 - 1.0 đ', name: 'Đất trống / Nhà kho cấp 4', desc: 'Công trình tạm hoặc niên hạn dưới 5 năm' },
            { code: '1.0 - 2.0 đ', name: 'Nhà dân sinh 1-2 tầng', desc: 'Niên hạn 5 - 15 năm, bê tông cốt thép kiên cố' },
            { code: '2.0 - 3.0 đ', name: 'Nhà phố 3-5 tầng / Cấp II', desc: 'Niên hạn 15 - 30 năm, bắt đầu lão hóa kết cấu' },
            { code: '3.0 - 4.0 đ', name: 'Công trình công cộng / Cấp I', desc: 'Niên hạn >30 năm, trường học, bệnh viện, đông người' },
          ],
          thresholds: [],
        };
      case 'V2':
        return {
          title: 'Tiêu Chí V2: Loại Hình Móng & Kết Cấu Chịu Lực',
          formula: 'V2 = f(Phân loại móng CAT 1-5 & Hệ kết cấu)',
          description: 'Độ nhạy cảm của móng công trình trước sự dịch chuyển của khối đất:',
          variables: [
            { code: '0 - 1.0 đ', name: 'Móng cọc khoan nhồi sâu', desc: 'CAT 1/2, mũi cọc cắm vào tầng cuội sỏi sét cứng' },
            { code: '1.0 - 2.0 đ', name: 'Móng cọc ép bê tông', desc: 'CAT 2/3, cọc cắm qua vùng ảnh hưởng hầm' },
            { code: '2.0 - 3.0 đ', name: 'Móng băng / Móng bè nông', desc: 'CAT 3/4, nằm trong tầng đất bở rời bị ảnh hưởng lún' },
            { code: '3.0 - 4.0 đ', name: 'Móng đơn gạch / Cừ tràm', desc: 'CAT 5, nhạy cảm cực cao khi mực nước ngầm hạ' },
          ],
          thresholds: [],
        };
      case 'V3':
        return {
          title: 'Tiêu Chí V3: Cự Ly Không Gian Đến Tim Tuyến Metro',
          formula: 'V3 = f(Khoảng cách 3D từ hố móng đến tim hầm d)',
          description: 'Cường độ tương tác từ vùng lún bề mặt do đào hầm TBM gây ra:',
          variables: [
            { code: '0 - 1.0 đ', name: 'd > 35m', desc: 'Nằm ngoài máng lún chính của tuyến hầm' },
            { code: '1.0 - 2.0 đ', name: '20m < d ≤ 35m', desc: 'Vùng ảnh hưởng thứ cấp, độ cong máng lún nhỏ' },
            { code: '2.0 - 3.0 đ', name: '10m < d ≤ 20m', desc: 'Vùng điểm uốn máng lún, chịu biến dạng kéo hông' },
            { code: '3.0 - 4.0 đ', name: 'd ≤ 10m hoặc giao cắt', desc: 'Trực diện vùng biến dạng cực đại trên nóc hầm' },
          ],
          thresholds: [],
        };
      case 'V4':
        return {
          title: 'Tiêu Chí V4: Ranh Giới & Trạng Thái Liền Kề',
          formula: 'V4 = f(Mức độ phụ thuộc kết cấu với công trình kề cận)',
          description: 'Nguy cơ bị lôi kéo chuyển vị không đồng đều từ khối nhà hàng xóm:',
          variables: [
            { code: '0 - 1.0 đ', name: 'Độc lập bốn phía', desc: 'Có khoảng lùi sân vườn, không chạm nhà bên cạnh' },
            { code: '1.0 - 2.0 đ', name: 'Sát vách có khe lún', desc: 'Móng và tường riêng biệt, có khe co giãn kỹ thuật' },
            { code: '2.0 - 3.0 đ', name: 'Chung tường lửng / móng sát', desc: 'Tường gạch xây chèn hoặc móng bè kẹp chân' },
            { code: '3.0 - 4.0 đ', name: 'Chung tường chịu lực', desc: 'Dầm gối trực tiếp lên tường chung, nguy cơ nứt dây chuyền' },
          ],
          thresholds: [],
        };
      case 'V5':
        return {
          title: 'Tiêu Chí V5: Quy Mô Tầng & Độ Cứng Uốn (EI)',
          formula: 'V5 = f(Số tầng nổi, tầng hầm, tỷ lệ chiều cao/bề rộng H/B)',
          description: 'Độ nhạy cảm của khối nhà trước chuyển vị uốn lượn và xoắn:',
          variables: [
            { code: '0 - 1.0 đ', name: 'Nhà 1 tầng thấp', desc: 'Khối tích nhỏ, khả năng chịu lún lệch tự do tốt' },
            { code: '1.0 - 2.0 đ', name: 'Nhà 2-3 tầng', desc: 'Độ cứng trung bình, tỷ lệ H/B cân đối' },
            { code: '2.0 - 3.0 đ', name: 'Nhà 4-5 tầng', desc: 'Độ cứng uốn lớn, dễ nứt khi xuất hiện chênh lún' },
            { code: '3.0 - 4.0 đ', name: 'Nhà >5 tầng / Có hầm', desc: 'Tải trọng chân cột lớn, ứng suất tiếp xúc đáy móng cao' },
          ],
          thresholds: [],
        };
      case 'V6':
        return {
          title: 'Tiêu Chí V6: Độ Tin Cậy Dữ Liệu Khảo Sát',
          formula: 'V6 = f(Hạn chế tiếp cận, hồ sơ móng & mức độ che khuất)',
          description: 'Hệ số an toàn dự phòng rủi ro khi số liệu thực địa bị khuyết:',
          variables: [
            { code: '0 - 1.0 đ', name: 'Tiếp cận 100% + Có bản vẽ', desc: 'Đầy đủ hồ sơ hoàn công, kiểm tra chi tiết các phòng' },
            { code: '1.0 - 2.0 đ', name: 'Tiếp cận tốt', desc: 'Kiểm tra hầu hết các tầng, chủ nhà nhớ rõ quy cách móng' },
            { code: '2.0 - 3.0 đ', name: 'Hạn chế một phần', desc: 'Khóa cửa một số phòng, móng suy luận theo quy chuẩn' },
            { code: '3.0 - 4.0 đ', name: 'Chỉ quan sát ngoại quan', desc: 'Chủ nhà vắng mặt hoặc không cho vào trong, rủi ro che khuất cao' },
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
