import { Phase1SurveyFormData, EcsScoreState } from '../types/phase1.types';

/**
 * Thuật toán tính toán chỉ số ECS (Existing Condition Score - 11. Docx)
 * 6 tiêu chí E1..E6 (thang 0-4 điểm), tổng điểm 0-24
 */
export function calculateEcsScore(formData: Partial<Phase1SurveyFormData>): EcsScoreState {
  // 1. E1: Hư hỏng nhìn thấy tường/khối xây (Tự động map từ Burland Grade Max ở Bước 4)
  const burlandMax = formData.burlandSummary?.localMaxGrade ?? 0;
  let e1 = 0;
  if (burlandMax <= 1) e1 = 0;
  else if (burlandMax === 2) e1 = 1;
  else if (burlandMax === 3) e1 = 2;
  else if (burlandMax === 4) e1 = 3;
  else if (burlandMax >= 5) e1 = 4;

  // 2. E2: Khuyết tật kết cấu cột/dầm/sàn/tường chịu lực (Tự động map từ Cờ kết cấu Bước 4 & Ý nghĩa KC Defect D-xx)
  let maxDefectStructural = 0;
  formData.floors?.forEach((fl) => {
    fl.zones?.forEach((zn) => {
      zn.defects?.forEach((df) => {
        const rawVal = df.structuralSignificanceE2 ?? 0;
        const val = typeof rawVal === 'number' ? rawVal : 0;
        if (val > maxDefectStructural) maxDefectStructural = val;
      });
    });
    fl.structuralElements?.forEach((el) => {
      el.defects?.forEach((df) => {
        const rawVal = df.structuralSignificanceE2 ?? 0;
        const val = typeof rawVal === 'number' ? rawVal : 0;
        if (val > maxDefectStructural) maxDefectStructural = val;
      });
    });
  });

  const flagLevel = formData.burlandSummary?.structuralFlagLevel || 'NONE';
  let flagVal = 0;
  if (flagLevel === 'LOW') flagVal = 1;
  else if (flagLevel === 'MODERATE') flagVal = 2;
  else if (flagLevel === 'HIGH') flagVal = 3;
  else if (flagLevel === 'CRITICAL') flagVal = 4;

  const e2 = Math.max(maxDefectStructural, flagVal);

  // 3. E3: Lún/nghiêng/võng/biến dạng (Tự động tính từ Level của Lún chênh, Độ nghiêng B1 & Võng dầm sàn B5)
  let e3 = 0;
  const st = formData.settlementTilt;
  if (st) {
    const lSettlement = st.diffSettlement?.level ?? 0;
    const lTilt = st.buildingTilt?.level ?? 0;
    const lSag = st.beamSagging?.level ?? 0;
    e3 = Math.min(4, Math.max(lSettlement, lTilt, lSag));
  }

  // 4. E4: Suy giảm vật liệu/độ bền (Tự động quét max từ tất cả Defect D-xx Bước 3.3 & 3.4)
  let e4 = 0;
  formData.floors?.forEach((fl) => {
    fl.zones?.forEach((zn) => {
      zn.defects?.forEach((df) => {
        const rawVal = df.materialDegradationE4 ?? 0;
        const val = typeof rawVal === 'number' ? rawVal : 0;
        if (val > e4) e4 = val;
      });
    });
    fl.structuralElements?.forEach((el) => {
      el.defects?.forEach((df) => {
        const rawVal = df.materialDegradationE4 ?? 0;
        const val = typeof rawVal === 'number' ? rawVal : 0;
        if (val > e4) e4 = val;
      });
    });
  });

  // 5. E5: Lịch sử/cơi nới/sự cố & tính toàn vẹn (Cơ chế cộng hưởng khi có từ 2 trường cùng > 2 và bằng nhau)
  let e5 = 0;
  const hi = formData.historyInterview;
  if (hi) {
    const scores = [
      hi.renovationLoad ?? 0,
      hi.majorRepair ?? 0,
      hi.pastSettlement ?? 0,
      hi.neighborDamage ?? 0,
      hi.fireFloodIncident ?? 0,
    ];
    const maxScore = Math.max(...scores);
    // Nếu có từ 2 trường thông tin cùng > 2 (tức cùng đạt 3đ) và bằng nhau -> +1 điểm
    const countHigh = scores.filter((s) => s > 2).length;
    if (countHigh >= 2) {
      e5 = 4; // 3 + 1 = 4
    } else {
      e5 = maxScore;
    }
  }

  // 6. E6: Tình trạng chức năng/tổng thể (Tự động quét từ khuyết tật Thấm dột, Kẹt cửa Bước 3.3 & Vùng cần sửa chữa)
  let maxDefectE6 = 0;
  let damagedZoneCount = 0;
  formData.floors?.forEach((fl) => {
    fl.zones?.forEach((zn) => {
      if (zn.functionalImpactRepairNeeded || (zn.burlandGrade && zn.burlandGrade >= 3)) {
        damagedZoneCount++;
      }
      zn.defects?.forEach((df: any) => {
        let val = df.functionalImpactE6 ?? 0;
        if (val === 5) val = 2; // Kẹt cửa: tính 2 điểm ảnh hưởng chức năng
        if (val > maxDefectE6) maxDefectE6 = val;
      });
    });
    fl.structuralElements?.forEach((el) => {
      if (el.hasDamage || (el.defects && el.defects.length > 0)) {
        damagedZoneCount++;
      }
      el.defects?.forEach((df: any) => {
        let val = df.functionalImpactE6 ?? 0;
        if (val === 5) val = 2; // Kẹt cửa: tính 2 điểm ảnh hưởng chức năng
        if (val > maxDefectE6) maxDefectE6 = val;
      });
    });
  });

  let zoneScore = 0;
  if (damagedZoneCount === 0) zoneScore = 0;
  else if (damagedZoneCount <= 2) zoneScore = 1;
  else if (damagedZoneCount <= 4) zoneScore = 2;
  else zoneScore = 3;

  const e6 = Math.min(4, Math.max(maxDefectE6, zoneScore));

  // Tính tổng ECS
  const totalEcs = e1 + e2 + e3 + e4 + e5 + e6;

  // Phân hạng ECS Class
  let ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' = 'GOOD';
  if (totalEcs >= 17) ecsClass = 'CRITICAL';
  else if (totalEcs >= 11) ecsClass = 'DEFICIENT';
  else if (totalEcs >= 6) ecsClass = 'MEDIUM';
  else ecsClass = 'GOOD';

  // Khóa an toàn ECS Override (Nếu E2 >= 3 hoặc E3 >= 3 thì không cho phép hạ hạng ECS)
  const isOverrideLocked = e2 >= 3 || e3 >= 3;

  return {
    e1,
    e2,
    e3,
    e4,
    e5,
    e6,
    totalEcs,
    ecsClass,
    engineeringJudgement: formData.ecs?.engineeringJudgement || { action: 'KEEP', reason: '' },
    isOverrideLocked,
  };
}
