/**
 * ============================================================================
 * BRA 4x4 MATRIX LOOKUP & BUILDER (SECTION 8 SUB-MODULE — ZERO CALCULATE)
 * ============================================================================
 */

import { BraMatrixRow, BraMatrixCell, BilingualText } from '../../report.types';

export interface BraCellLookup {
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  riskLevelVi: string;
  riskLevelEn: string;
  recVi: string;
  recEn: string;
}

export const BRA_MATRIX_LOOKUP: Record<'V1' | 'V2' | 'V3' | 'V4', Record<'I1' | 'I2' | 'I3' | 'I4', BraCellLookup>> = {
  V1: {
    I1: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Công trình ít nhạy cảm, nằm ngoài vùng ảnh hưởng chính. Theo dõi định kỳ.', recEn: 'Low vulnerability, outside main influence zone. Periodic monitoring.' },
    I2: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Khảo sát hiện trạng bình thường, theo dõi chu kỳ định kỳ.', recEn: 'Normal baseline condition, periodic monitoring recommended.' },
    I3: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Nằm gần tuyến thi công. Thiết lập mốc quan trắc lún trước khi đào hầm.', recEn: 'Close to alignment. Establish settlement monitoring pins before excavation.' },
    I4: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Khoảng cách rất gần tim hầm. Cần kiểm tra kỹ móng và lập phương án giám sát 24/7.', recEn: 'Very close to tunnel. Foundation check and 24/7 monitoring plan required.' },
  },
  V2: {
    I1: { riskLevel: 'Low', riskLevelVi: 'Rủi ro thấp', riskLevelEn: 'Low Risk', recVi: 'Khoảng cách an toàn bù đắp độ tổn thương trung bình. Khảo sát định kỳ.', recEn: 'Safe distance compensates for moderate vulnerability. Periodic survey.' },
    I2: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Cần quan trắc lún chênh và theo dõi sự phát triển của các vết nứt hiện hữu.', recEn: 'Monitor differential settlement and progression of existing cracks.' },
    I3: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Đo đạc biên độ rung động khi máy TBM đào qua hoặc thi công hố đào.', recEn: 'Measure vibration amplitudes during TBM tunneling or excavation.' },
    I4: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Bắt buộc lắp cảm biến đo lún thời gian thực và khảo sát trước - sau thi công.', recEn: 'Real-time settlement sensors and pre/post construction surveys required.' },
  },
  V3: {
    I1: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Công trình có độ tổn thương cao (kết cấu yếu/tuổi thọ cao). Theo dõi sát lún chênh.', recEn: 'Higher vulnerability (structural system/age). Closely monitor differential settlement.' },
    I2: { riskLevel: 'Medium', riskLevelVi: 'Rủi ro trung bình', riskLevelEn: 'Medium Risk', recVi: 'Khuyến nghị trám vá gia cố các vị trí nứt kết cấu trước khi thi công ngầm.', recEn: 'Local structural repairs recommended prior to tunneling.' },
    I3: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Khả năng phát sinh nứt mới hoặc nứt rộng lớn. Cần lập biện pháp bảo vệ kết cấu.', recEn: 'Potential for new or widened cracks. Structural protection plan needed.' },
    I4: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Nguy cơ mất ổn định cao. Bắt buộc có phương án chống đỡ / gia cường móng trước thi công.', recEn: 'High instability risk. Emergency underpinning/shoring plan mandatory.' },
  },
  V4: {
    I1: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Công trình thuộc nhóm đặc biệt nhạy cảm hoặc nguy cấp. Kiểm toán an toàn trước thi công.', recEn: 'Special sensitivity or critical condition. Pre-construction safety audit required.' },
    I2: { riskLevel: 'High', riskLevelVi: 'Rủi ro cao', riskLevelEn: 'High Risk', recVi: 'Quan trắc chuyên sâu liên tục và kiểm toán an toàn trước khi máy TBM đi qua.', recEn: 'Intensive continuous monitoring and safety audit required.' },
    I3: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Tiềm ẩn nguy cơ mất ổn định kết cấu nghiêm trọng khi đào ngầm. Họp chuyên gia xử lý.', recEn: 'High potential for structural instability during tunneling. Expert review needed.' },
    I4: { riskLevel: 'Very High', riskLevelVi: 'Rủi ro rất cao', riskLevelEn: 'Very High Risk', recVi: 'Nguy cấp tối đa. Bắt buộc Hội đồng chuyên môn Metro họp thẩm tra và xử lý đặc biệt.', recEn: 'Critical maximum risk. Specialized engineering intervention mandatory.' },
  },
};

export function buildBraMatrixRows(
  vCode: 'V1' | 'V2' | 'V3' | 'V4' | null,
  validImpactCode: 'I1' | 'I2' | 'I3' | 'I4' | '--'
): BraMatrixRow[] {
  const vKeys: Array<'V1' | 'V2' | 'V3' | 'V4'> = ['V1', 'V2', 'V3', 'V4'];
  const iKeys: Array<'I1' | 'I2' | 'I3' | 'I4'> = ['I1', 'I2', 'I3', 'I4'];

  return vKeys.map((vk) => {
    const vLabelVi = vk === 'V1' ? 'V1 (Thấp / Low)' : vk === 'V2' ? 'V2 (Trung bình / Medium)' : vk === 'V3' ? 'V3 (Cao / High)' : 'V4 (Rất cao / Very High)';
    const vLabelEn = vk === 'V1' ? 'V1 (Low ≤ 1.50)' : vk === 'V2' ? 'V2 (Medium 1.51-2.50)' : vk === 'V3' ? 'V3 (High 2.51-3.25)' : 'V4 (Very High > 3.25)';

    const cells: BraMatrixCell[] = iKeys.map((ik) => {
      const item = BRA_MATRIX_LOOKUP[vk][ik];
      const isCur = vCode !== null && validImpactCode !== '--' && vk === vCode && ik === validImpactCode;
      return {
        vCode: vk,
        iCode: ik,
        riskLevel: item.riskLevel,
        riskLevelVi: item.riskLevelVi,
        riskLevelEn: item.riskLevelEn,
        badgeBg: item.riskLevel === 'Low' ? '#dcfce7' : item.riskLevel === 'Medium' ? '#fef3c7' : item.riskLevel === 'High' ? '#fed7aa' : '#fee2e2',
        isCurrent: isCur,
      };
    });

    return {
      vCode: vk,
      vLabel: { vi: vLabelVi, en: vLabelEn } as BilingualText,
      cells,
    };
  });
}

