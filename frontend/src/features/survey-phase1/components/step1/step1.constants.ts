import { ObjectGroupType } from '../../types/phase1.types';
import { LevelOptionGuide } from '../LevelSelectorWithGuide';

export const OBJECT_GROUPS: { value: ObjectGroupType; label: string; desc: string; badgeColor: string }[] = [
  {
    value: 'GENERAL',
    label: '1. Nhà ở dân dụng thông thường (General)',
    desc: 'Nhà phố, nhà liên kế, biệt thự thông thường dưới 5 tầng.',
    badgeColor: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  },
  {
    value: 'IMPORTANT',
    label: '2. Công trình nhạy cảm / Quan trọng (Important)',
    desc: 'Chung cư cao tầng (≥ 5 tầng), trường học, bệnh viện, công trình tập trung đông người.',
    badgeColor: 'bg-amber-50 border-amber-300 text-amber-900',
  },
  {
    value: 'CRITICAL',
    label: '3. Di tích lịch sử / Bảo tồn / Đặc biệt (Critical)',
    desc: 'Công trình di sản văn hóa, tôn giáo cổ, cơ sở quốc phòng trọng yếu.',
    badgeColor: 'bg-red-50 border-red-300 text-red-900',
  },
];

export const ADJACENT_LEFT_RIGHT = [
  'Nhà phố / Nhà dân',
  'Cao tầng / Chung cư',
  'Bệnh viện / Y tế',
  'Trường học',
  'Công viên / Cây xanh',
  'Đất trống',
  'Cơ sở tôn giáo (Chùa, Nhà thờ)',
  'Không biết / Không rõ (Bị che khuất)',
  'Khác...',
];

export const ADJACENT_REAR = [
  'Nhà phố / Nhà dân',
  'Cao tầng / Chung cư',
  'Bệnh viện / Y tế',
  'Trường học',
  'Công viên / Cây xanh',
  'Đất trống',
  'Hẻm / Đường nội bộ',
  'Không biết / Không rõ (Bị che khuất)',
  'Khác...',
];

export const P03_TAGS = ['Bên hông trái', 'Bên hông phải', 'Phía sau', 'Khác'];

export const SETTLEMENT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  { level: 0, title: 'Không', physicalManifestation: 'Không phát hiện dấu hiệu bất thường. Nền móng và tường phẳng phiu.' },
  { level: 1, title: 'Nghi ngờ / Rất nhẹ', physicalManifestation: 'Chớm xuất hiện vết nứt chân chim (<0.5mm) tiếp giáp móng-tường trệt.' },
  { level: 2, title: 'Rõ nhưng ổn định', physicalManifestation: 'Nền trệt lún lệch rõ rệt (1–2cm), mép chân tường nứt tách 1–3mm.' },
  { level: 3, title: 'Tiến triển / Nghiêm trọng', physicalManifestation: 'Nền lún sụt mạnh, nứt xiên bậc thang 45° tường bao ≥ 5mm.' },
  { level: 4, title: 'Mất ổn định / Nguy cấp', physicalManifestation: 'Móng bị gãy khúc hoặc trượt lún sâu, tường tách rời khung BTCT.' },
];

export const TILT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  { level: 0, title: 'Không', physicalManifestation: 'Công trình thẳng đứng, không có dấu hiệu nghiêng (<1‰).' },
  { level: 1, title: 'Nghi ngờ / Rất nhẹ', physicalManifestation: 'Độ nghiêng rất nhỏ (<2‰), sinh hoạt bình thường.' },
  { level: 2, title: 'Rõ nhưng ổn định', physicalManifestation: 'Nghiêng thấy rõ bằng mắt hoặc nivo (2–5‰).' },
  { level: 3, title: 'Tiến triển / Nghiêm trọng', physicalManifestation: 'Độ nghiêng lớn (5–10‰), có hiện tượng chạm đỉnh với nhà bên cạnh.' },
  { level: 4, title: 'Mất ổn định / Nguy cấp', physicalManifestation: 'Độ nghiêng vượt ngưỡng nguy cấp (>10‰), nguy cơ lật đổ sập.' },
];

export const DATA_SOURCES = [
  'Quan sát hiện trường',
  'Thước Laser / Nivo',
  'Hồ sơ bản vẽ',
  'Chủ nhà cung cấp',
];

export const ABSENTEE_REASONS = [
  'Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)',
  'Chủ hộ đi làm, không có người lớn ở nhà',
  'Từ chối phối hợp khảo sát',
  'Khu đất trống / Nhà đang tranh chấp',
  'Lý do khác',
];
