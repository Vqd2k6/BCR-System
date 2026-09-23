import { ObjectGroupType } from '../types/phase1.types';

export type ImpactCode = 'I1' | 'I2' | 'I3' | 'I4';
export type BraRiskLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export interface ConstructionImpactResult {
  code: ImpactCode;
  levelText: string;
  label: string;
  distance: number;
  conditionFormula: string;
  isSpecialObject: boolean;
  colorClass: string;
  badgeBg: string;
}

export interface BraRiskResult {
  riskLevel: BraRiskLevel;
  label: string;
  vCode: 'V1' | 'V2' | 'V3' | 'V4';
  vLabel: string;
  iCode: ImpactCode;
  iLabel: string;
  colorClass: string;
  badgeBg: string;
  recommendation: string;
}

/**
 * Tính toán Tác động thi công Metro (Impact I1 - I4) theo khoảng cách d đến tim hầm Metro
 * và phân nhóm công trình (General vs Critical/Important).
 */
export function calculateConstructionImpact(
  objectGroup: ObjectGroupType | string = 'GENERAL',
  metroOffsetDistance: string | number = ''
): ConstructionImpactResult {
  const d =
    typeof metroOffsetDistance === 'number'
      ? metroOffsetDistance
      : parseFloat(String(metroOffsetDistance || '').replace(/[^\d.]/g, '')) || 0;

  const isSpecial = objectGroup === 'CRITICAL' || objectGroup === 'IMPORTANT';

  let code: ImpactCode = 'I1';
  let levelText = 'Low';
  let label = 'I1 Low';
  let conditionFormula = '';
  let colorClass = 'text-emerald-700';
  let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';

  if (isSpecial) {
    if (d >= 30) {
      code = 'I1';
      levelText = 'Low';
      label = 'I1 Low';
      conditionFormula = 'd ≥ 30m';
      colorClass = 'text-emerald-700';
      badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (d >= 20) {
      code = 'I2';
      levelText = 'Medium';
      label = 'I2 Medium';
      conditionFormula = '20m ≤ d < 30m';
      colorClass = 'text-amber-700';
      badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (d >= 10) {
      code = 'I3';
      levelText = 'High';
      label = 'I3 High';
      conditionFormula = '10m ≤ d < 20m';
      colorClass = 'text-orange-700';
      badgeBg = 'bg-orange-50 text-orange-800 border-orange-200';
    } else {
      code = 'I4';
      levelText = 'Very High';
      label = 'I4 Very High';
      conditionFormula = 'd < 10m';
      colorClass = 'text-red-700';
      badgeBg = 'bg-red-50 text-red-800 border-red-200';
    }
  } else {
    // General
    if (d >= 20) {
      code = 'I1';
      levelText = 'Low';
      label = 'I1 Low';
      conditionFormula = 'd ≥ 20m';
      colorClass = 'text-emerald-700';
      badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (d >= 10) {
      code = 'I2';
      levelText = 'Medium';
      label = 'I2 Medium';
      conditionFormula = '10m ≤ d < 20m';
      colorClass = 'text-amber-700';
      badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (d >= 5) {
      code = 'I3';
      levelText = 'High';
      label = 'I3 High';
      conditionFormula = '5m ≤ d < 10m';
      colorClass = 'text-orange-700';
      badgeBg = 'bg-orange-50 text-orange-800 border-orange-200';
    } else {
      code = 'I4';
      levelText = 'Very High';
      label = 'I4 Very High';
      conditionFormula = 'd < 5m';
      colorClass = 'text-red-700';
      badgeBg = 'bg-red-50 text-red-800 border-red-200';
    }
  }

  return {
    code,
    levelText,
    label,
    distance: d,
    conditionFormula,
    isSpecialObject: isSpecial,
    colorClass,
    badgeBg,
  };
}

/**
 * Ma trận đánh giá rủi ro cơ sở BRA (Baseline Risk Assessment)
 * Kết hợp giữa Vulnerability (V) và Impact (I)
 */
export const BRA_MATRIX_LOOKUP: Record<
  'V1' | 'V2' | 'V3' | 'V4',
  Record<'I1' | 'I2' | 'I3' | 'I4', { riskLevel: BraRiskLevel; colorClass: string; badgeBg: string; recommendation: string }>
> = {
  V1: {
    I1: {
      riskLevel: 'Low',
      colorClass: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      recommendation: 'Rủi ro thấp. Công trình ít nhạy cảm, nằm ngoài vùng ảnh hưởng chính.',
    },
    I2: {
      riskLevel: 'Low',
      colorClass: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      recommendation: 'Rủi ro thấp. Khảo sát hiện trạng bình thường, theo dõi chu kỳ định kỳ.',
    },
    I3: {
      riskLevel: 'Medium',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      recommendation: 'Rủi ro trung bình do nằm gần tuyến. Thiết lập mốc quan trắc lún trước khi đào hầm.',
    },
    I4: {
      riskLevel: 'High',
      colorClass: 'text-orange-700',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
      recommendation: 'Rủi ro cao do khoảng cách rất gần tim hầm. Cần kiểm tra kỹ móng và lập phương án giám sát chuyển vị 24/7.',
    },
  },
  V2: {
    I1: {
      riskLevel: 'Low',
      colorClass: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      recommendation: 'Rủi ro thấp. Khoảng cách an toàn bù đắp độ tổn thương trung bình.',
    },
    I2: {
      riskLevel: 'Medium',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      recommendation: 'Rủi ro trung bình. Cần quan trắc lún chênh và theo dõi các vết nứt hiện hữu.',
    },
    I3: {
      riskLevel: 'Medium',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      recommendation: 'Rủi ro trung bình. Đo đạc biên độ rung động khi máy TBM đào qua.',
    },
    I4: {
      riskLevel: 'High',
      colorClass: 'text-orange-700',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
      recommendation: 'Rủi ro cao. Bắt buộc lắp cảm biến đo lún thời gian thực và khảo sát trước - sau thi công.',
    },
  },
  V3: {
    I1: {
      riskLevel: 'Medium',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      recommendation: 'Rủi ro trung bình do công trình có độ tổn thương cao (kết cấu yếu/tuổi thọ cao).',
    },
    I2: {
      riskLevel: 'Medium',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      recommendation: 'Rủi ro trung bình. Khuyến nghị gia cố các vị trí nứt kết cấu trước khi thi công.',
    },
    I3: {
      riskLevel: 'High',
      colorClass: 'text-orange-700',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
      recommendation: 'Rủi ro cao. Khả năng phát sinh nứt mới hoặc nứt rộng lớn. Cần lập biện pháp bảo vệ kết cấu.',
    },
    I4: {
      riskLevel: 'Very High',
      colorClass: 'text-red-700',
      badgeBg: 'bg-red-50 text-red-800 border-red-200',
      recommendation: 'Rủi ro rất cao (Nguy cấp). Bắt buộc giải trình kỹ thuật và có phương án chống đỡ / gia cường móng khẩn cấp.',
    },
  },
  V4: {
    I1: {
      riskLevel: 'High',
      colorClass: 'text-orange-700',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
      recommendation: 'Rủi ro cao do công trình thuộc nhóm đặc biệt nhạy cảm hoặc nguy cấp về kết cấu.',
    },
    I2: {
      riskLevel: 'High',
      colorClass: 'text-orange-700',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
      recommendation: 'Rủi ro cao. Cần quan trắc chuyên sâu liên tục và kiểm toán an toàn trước khi máy TBM đi qua.',
    },
    I3: {
      riskLevel: 'Very High',
      colorClass: 'text-red-700',
      badgeBg: 'bg-red-50 text-red-800 border-red-200',
      recommendation: 'Rủi ro rất cao. Tiềm ẩn nguy cơ mất ổn định kết cấu nghiêm trọng khi đào ngầm.',
    },
    I4: {
      riskLevel: 'Very High',
      colorClass: 'text-red-700',
      badgeBg: 'bg-red-50 text-red-800 border-red-200',
      recommendation: 'Rủi ro rất cao (Nguy cấp tối đa). Bắt buộc Hội đồng chuyên môn Metro họp thẩm tra và xử lý gia cường đặc biệt.',
    },
  },
};

/**
 * Đánh giá rủi ro cơ sở BRA từ VI Class và Impact Code
 */
export function calculateBraRisk(
  vulnerabilityClass: string = 'LOW',
  impactCode: ImpactCode = 'I1'
): BraRiskResult {
  let vCode: 'V1' | 'V2' | 'V3' | 'V4' = 'V1';
  let vLabel = 'V1 Low';

  const vNorm = (vulnerabilityClass || '').toUpperCase();
  if (vNorm.includes('VERY_HIGH') || vNorm.includes('VERY HIGH') || vNorm.includes('V4')) {
    vCode = 'V4';
    vLabel = 'V4 Very High';
  } else if (vNorm.includes('HIGH') || vNorm.includes('V3') || vNorm.includes('TĂNG NẶNG')) {
    vCode = 'V3';
    vLabel = 'V3 High';
  } else if (vNorm.includes('MEDIUM') || vNorm.includes('V2') || vNorm.includes('TRUNG BÌNH')) {
    vCode = 'V2';
    vLabel = 'V2 Medium';
  } else {
    vCode = 'V1';
    vLabel = 'V1 Low';
  }

  const iCode: ImpactCode = impactCode || 'I1';
  const iLabel =
    iCode === 'I1' ? 'I1 Low' : iCode === 'I2' ? 'I2 Medium' : iCode === 'I3' ? 'I3 High' : 'I4 Very High';

  const lookup = BRA_MATRIX_LOOKUP[vCode][iCode];

  return {
    riskLevel: lookup.riskLevel,
    label: lookup.riskLevel,
    vCode,
    vLabel,
    iCode,
    iLabel,
    colorClass: lookup.colorClass,
    badgeBg: lookup.badgeBg,
    recommendation: lookup.recommendation,
  };
}
