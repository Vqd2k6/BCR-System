import { Phase1SurveyFormData, ViScoreState, EcsScoreState } from '../types/phase1.types';

/**
 * Thuật toán tính toán chỉ số VI (Vulnerability Index - 13. Docx)
 * 6 tiêu chí V1..V6 (thang 1-4 điểm), tổng 6-24, điểm trung bình VIavg = tổng / 6
 */
export function calculateViScore(formData: Partial<Phase1SurveyFormData>, currentEcs?: EcsScoreState): ViScoreState {
  // 1. V1: Công năng & Quy mô (Tự động đề xuất từ Nhóm đối tượng Bước 1)
  let v1 = 1;
  const objGroup = formData.objectGroup || 'GENERAL';
  if (objGroup === 'CRITICAL') v1 = 4;
  else if (objGroup === 'IMPORTANT') v1 = 2;
  else v1 = 1;

  // 2. V2: Hệ kết cấu chịu lực (Mặc định hoặc chọn từ B2.1)
  let v2 = formData.vi?.v2 ?? 2;
  const structSys = formData.structureSystem || '';
  if (structSys.includes('RC') || structSys.includes('BTCT toàn khối')) v2 = 1;
  else if (structSys.includes('Masonry') || structSys.includes('Tường gạch')) v2 = 3;
  else if (structSys.includes('Kém ổn định')) v2 = 4;

  // 3. V3: Loại móng & Nền đất (Tự động ánh xạ từ điểm CAT móng B2.1)
  const catScore = formData.foundationCatScore ?? 3;
  let v3 = 2;
  if (catScore >= 4) v3 = 1;
  else if (catScore === 3) v3 = 2;
  else if (catScore === 2) v3 = 3;
  else v3 = 4; // Cat 1

  // 4. V4: Tuổi đời / Cơi nới (Tự động tính theo năm xây dựng)
  let v4 = formData.vi?.v4 ?? 2;
  const currentYear = new Date().getFullYear();
  if (typeof formData.constructionYear === 'number' && formData.constructionYear > 1900) {
    const age = currentYear - formData.constructionYear;
    if (age < 10) v4 = 1;
    else if (age <= 25) v4 = 2;
    else if (age <= 40) v4 = 3;
    else v4 = 4;
  }
  // Nếu có cơi nới tải trọng nặng ở B2.2 thì đẩy lên mức 4
  if ((formData.historyInterview?.renovationLoad ?? 0) >= 3) {
    v4 = 4;
  }

  // 5. V5: Hiện trạng kỹ thuật ECS (Tự động map từ ECS Class)
  const ecsClass = currentEcs?.ecsClass || formData.ecs?.ecsClass || 'GOOD';
  let v5 = 1;
  if (ecsClass === 'CRITICAL') v5 = 4;
  else if (ecsClass === 'DEFICIENT') v5 = 3;
  else if (ecsClass === 'MEDIUM') v5 = 2;
  else v5 = 1;

  // 6. V6: Thiết bị nhạy cảm (Tự động map từ B2.2)
  let v6 = formData.vi?.v6 ?? 1;
  if (formData.historyInterview?.continuousOperation247) {
    v6 = 4;
  } else if (formData.historyInterview?.sensitiveEquipment?.has) {
    v6 = 3;
  }

  // Tính tổng và điểm trung bình
  const totalVi = v1 + v2 + v3 + v4 + v5 + v6;
  const viAvg = Number((totalVi / 6).toFixed(2));

  // Phân hạng VI Class
  let viClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' = 'LOW';
  if (viAvg > 3.25) viClass = 'VERY_HIGH';
  else if (viAvg > 2.5) viClass = 'HIGH';
  else if (viAvg > 1.5) viClass = 'MEDIUM';
  else viClass = 'LOW';

  return {
    v1,
    v2,
    v3,
    v4,
    v5,
    v6,
    totalVi,
    viAvg,
    viClass,
    engineeringJudgement: formData.vi?.engineeringJudgement || { action: 'KEEP', reason: '' },
  };
}
