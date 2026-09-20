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
        const val = df.structuralSignificanceE2 ?? 0;
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

  // 3. E3: Lún/nghiêng/võng/biến dạng (Tự động tính từ Bước 5 Lún nghiêng)
  let e3 = 0;
  const st = formData.settlementTilt;
  if (st) {
    const isPresent = (field?: { status: string }) => field?.status === 'PRESENT';
    const isSuspected = (field?: { status: string }) => field?.status === 'SUSPECTED';

    const x = typeof st.buildingTilt?.xPermille === 'number' ? st.buildingTilt.xPermille : 0;
    const y = typeof st.buildingTilt?.yPermille === 'number' ? st.buildingTilt.yPermille : 0;
    const maxTilt = Math.max(x, y);

    const floorTilt = typeof st.floorTilt?.permille === 'number' ? st.floorTilt.permille : 0;
    const overallMaxTilt = Math.max(maxTilt, floorTilt);

    if (overallMaxTilt > 10 || (isPresent(st.diffSettlement) && isPresent(st.buildingTilt))) {
      e3 = 3;
    } else if (overallMaxTilt >= 5 || isPresent(st.diffSettlement) || isPresent(st.buildingTilt) || isPresent(st.beamSagging)) {
      e3 = 2;
    } else if (overallMaxTilt >= 2 || isSuspected(st.diffSettlement) || isSuspected(st.buildingTilt) || isSuspected(st.beamSagging)) {
      e3 = 1;
    } else {
      e3 = 0;
    }
  }

  // 4. E4: Suy giảm vật liệu/độ bền (Tự động quét max từ tất cả Defect D-xx Bước 3.3)
  let e4 = 0;
  formData.floors?.forEach((fl) => {
    fl.zones?.forEach((zn) => {
      zn.defects?.forEach((df) => {
        const val = df.materialDegradationE4 ?? 0;
        if (val > e4) e4 = val;
      });
    });
  });

  // 5. E5: Lịch sử/cơi nới/sự cố & tính toàn vẹn (Tự động quét max từ 5 câu hỏi phỏng vấn B2.2)
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
    e5 = Math.min(4, Math.max(...scores));
  }

  // 6. E6: Tình trạng chức năng/tổng thể (Tự động gợi ý từ các Vùng Z có cờ sửa chữa)
  let damagedZoneCount = 0;
  formData.floors?.forEach((fl) => {
    fl.zones?.forEach((zn) => {
      if (zn.functionalImpactRepairNeeded || zn.burlandGrade >= 3) {
        damagedZoneCount++;
      }
    });
  });

  let e6 = 0;
  if (damagedZoneCount === 0) e6 = 0;
  else if (damagedZoneCount <= 2) e6 = 1;
  else if (damagedZoneCount <= 4) e6 = 2;
  else e6 = 3;

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
