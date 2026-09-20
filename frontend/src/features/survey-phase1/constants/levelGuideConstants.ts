import { LevelOptionGuide } from '../components/LevelSelectorWithGuide';

export const SETTLEMENT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  {
    level: 0,
    scoreLabel: '0đ',
    title: 'Không có',
    subtitle: 'Bình thường',
    physicalManifestation:
      'Không phát hiện dấu hiệu bất thường. Nền móng và tường phẳng phiu, không có vết nứt chân chim tiếp giáp móng-tường.',
    colorClass: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/60',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  },
  {
    level: 1,
    scoreLabel: '1đ',
    title: 'Nghi ngờ / Rất nhẹ',
    subtitle: 'Chớm vi phạm thẩm mỹ',
    physicalManifestation:
      'Chớm xuất hiện vết nứt chân chim (<0.5mm) tiếp giáp móng-tường trệt, gạch lát sàn chớm tách khe nhẹ, chưa ảnh hưởng đến đóng mở cửa hoặc sinh hoạt.',
    colorClass: {
      border: 'border-blue-300',
      bg: 'bg-blue-50/60',
      text: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-800',
    },
  },
  {
    level: 2,
    scoreLabel: '2đ',
    title: 'Rõ nhưng ổn định',
    subtitle: 'Ảnh hưởng sử dụng',
    physicalManifestation:
      'Nền trệt lún lệch rõ rệt (1–2cm), mép chân tường nứt tách 1–3mm, cửa đi/cửa sổ bắt đầu có hiện tượng rít nhẹ nhưng vẫn sử dụng được, vết nứt đã ổn định theo thời gian.',
    colorClass: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/60',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800',
    },
  },
  {
    level: 3,
    scoreLabel: '3đ',
    title: 'Tiến triển / Nghiêm trọng',
    subtitle: 'Nguy hiểm kết cấu',
    physicalManifestation:
      'Nền lún sụt mạnh, nứt xiên bậc thang 45° tường bao ≥ 5mm, kẹt cứng toàn bộ cửa, vết nứt tiếp tục mở rộng tiến triển đe dọa an toàn kết cấu móng.',
    colorClass: {
      border: 'border-orange-300',
      bg: 'bg-orange-50/60',
      text: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-800',
    },
  },
  {
    level: 4,
    scoreLabel: '4đ',
    title: 'Mất ổn định / Nguy cấp',
    subtitle: 'Nguy cơ sập đổ',
    physicalManifestation:
      'Móng bị gãy khúc hoặc trượt lún sâu, tường tách rời hoàn toàn khỏi khung BTCT, sụt lún sạt lở nền đất nguy cấp đe dọa sập đổ công trình.',
    colorClass: {
      border: 'border-red-400',
      bg: 'bg-red-50/70',
      text: 'text-red-900',
      badge: 'bg-red-100 text-red-800',
    },
  },
];

export const TILT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  {
    level: 0,
    scoreLabel: '0đ',
    title: 'Không thấy',
    subtitle: 'Thẳng đứng',
    physicalManifestation:
      'Công trình thẳng đứng, không có dấu hiệu nghiêng bằng mắt thường hoặc nivo (<1‰). Khe hở với nhà bên cạnh đồng đều từ dưới lên trên.',
    colorClass: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/60',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  },
  {
    level: 1,
    scoreLabel: '1đ',
    title: 'Nghi ngờ / Rất nhẹ',
    subtitle: 'Chớm vi phạm thẩm mỹ',
    physicalManifestation:
      'Độ nghiêng rất nhỏ (<2‰), chớm vi phạm khe hở mỹ quan với nhà láng giềng lân cận, sinh hoạt bình thường không cảm nhận thấy lệch.',
    colorClass: {
      border: 'border-blue-300',
      bg: 'bg-blue-50/60',
      text: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-800',
    },
  },
  {
    level: 2,
    scoreLabel: '2đ',
    title: 'Rõ nhưng ổn định',
    subtitle: 'Ảnh hưởng sử dụng',
    physicalManifestation:
      'Nghiêng thấy rõ bằng mắt hoặc nivo (2–5‰), khe hở đỉnh nhà hẹp lại hoặc mở rộng rõ rệt, nước trên mặt sàn chảy dồn về một góc, cửa tự trôi đóng mở.',
    colorClass: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/60',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800',
    },
  },
  {
    level: 3,
    scoreLabel: '3đ',
    title: 'Tiến triển / Nghiêm trọng',
    subtitle: 'Nguy hiểm kết cấu',
    physicalManifestation:
      'Độ nghiêng lớn (5–10‰), có hiện tượng chạm đỉnh hoặc chèn ép kết cấu với nhà láng giềng, xuất hiện vết nứt xoắn hoặc nứt cắt chân cột tầng trệt.',
    colorClass: {
      border: 'border-orange-300',
      bg: 'bg-orange-50/60',
      text: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-800',
    },
  },
  {
    level: 4,
    scoreLabel: '4đ',
    title: 'Mất ổn định / Nguy cấp',
    subtitle: 'Nguy cơ sập đổ',
    physicalManifestation:
      'Độ nghiêng vượt ngưỡng giới hạn nguy cấp (>10‰), lệch tâm cực đại nguy hiểm, công trình tựa hẳn vào nhà bên cạnh hoặc có nguy cơ lật đổ sập.',
    colorClass: {
      border: 'border-red-400',
      bg: 'bg-red-50/70',
      text: 'text-red-900',
      badge: 'bg-red-100 text-red-800',
    },
  },
];

export const SAG_LEVEL_OPTIONS: LevelOptionGuide[] = [
  {
    level: 0,
    scoreLabel: '0đ',
    title: 'Không thấy',
    subtitle: 'Bằng phẳng',
    physicalManifestation:
      'Dầm, bản sàn phẳng phiu hoàn toàn, không có độ võng nhận biết và không có vết nứt chịu uốn.',
    colorClass: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/60',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  },
  {
    level: 1,
    scoreLabel: '1đ',
    title: 'Nghi ngờ / Rất nhẹ',
    subtitle: 'Chớm vi phạm thẩm mỹ',
    physicalManifestation:
      'Độ võng rất nhỏ (< L/500), chưa nhìn thấy rõ bằng mắt thường, chỉ phát hiện khi đo bằng máy cân mực laser hoặc căng dây kiểm tra.',
    colorClass: {
      border: 'border-blue-300',
      bg: 'bg-blue-50/60',
      text: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-800',
    },
  },
  {
    level: 2,
    scoreLabel: '2đ',
    title: 'Rõ nhưng ổn định',
    subtitle: 'Ảnh hưởng sử dụng',
    physicalManifestation:
      'Dầm / bản sàn võng thấy rõ bằng mắt thường (L/500 đến L/250), có hiện tượng đọng nước vũng giữa sàn, xuất hiện vết nứt tế vi mặt dưới dầm.',
    colorClass: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/60',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800',
    },
  },
  {
    level: 3,
    scoreLabel: '3đ',
    title: 'Tiến triển / Nghiêm trọng',
    subtitle: 'Nguy hiểm kết cấu',
    physicalManifestation:
      'Độ võng lớn (> L/250), xuất hiện vết nứt hình chữ V uốn dọc giữa nhịp dầm rộng > 0.5mm, lớp bê tông bảo vệ chớm bong rộp rỗ nứt.',
    colorClass: {
      border: 'border-orange-300',
      bg: 'bg-orange-50/60',
      text: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-800',
    },
  },
  {
    level: 4,
    scoreLabel: '4đ',
    title: 'Mất ổn định / Nguy cấp',
    subtitle: 'Nguy cơ sập đổ',
    physicalManifestation:
      'Dầm / sàn võng nghiêm trọng (> L/150), cốt thép chịu kéo bắt đầu chảy dẻo, bê tông vùng nén đỉnh dầm bị vỡ vụn hoặc lộ cốt thép cong vênh, nguy cơ sập gãy.',
    colorClass: {
      border: 'border-red-400',
      bg: 'bg-red-50/70',
      text: 'text-red-900',
      badge: 'bg-red-100 text-red-800',
    },
  },
];
