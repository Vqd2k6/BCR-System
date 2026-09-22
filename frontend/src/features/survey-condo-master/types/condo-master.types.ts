import {
  Phase1SurveyFormData,
} from '../../survey-phase1/types/phase1.types';

export const CONDO_USAGE_FUNCTIONS = [
  'Chung cư/ Toà nhiều căn hộ',
  'Chung cư hỗn hợp (Căn hộ & Trung tâm thương mại / Dịch vụ)',
  'Tòa nhà chung cư mini / Căn hộ dịch vụ cho thuê',
  'Tòa nhà phức hợp cao tầng',
] as const;

export const CONDO_FOUNDATION_TYPES = [
  'Móng cọc khoan nhồi BTCT (Bored Piles D1000 - D1500)',
  'Móng bè trên nền cọc khoan nhồi (Piled Raft Foundation)',
  'Móng tường vây kết hợp cọc Barrette (Diaphragm Wall + Barrette)',
  'Móng bè hộp tầng hầm BTCT toàn khối (Box Raft Foundation)',
  'Móng cọc ép / cọc ly tâm D500 - D800',
  'Khác (Ghi chú chi tiết)',
] as const;

export const CONDO_STRUCTURAL_SYSTEMS = [
  'Khung BTCT kết hợp vách cứng / lõi thang máy (RC Core Wall + Frame)',
  'Hệ tường vách chịu lực toàn khối (Cast-in-place Shear Wall System)',
  'Sàn nấm dầm bẹt cáp ứng suất trước (Post-Tensioned Flat Slab)',
  'Kết cấu khung thép tiền chế liên hợp BTCT (Steel-Concrete Composite)',
  'Khung bê tông cốt thép toàn khối thông thường',
  'Khác',
] as const;

export interface CondoMasterFormData extends Omit<Phase1SurveyFormData, 'usageFunction'> {
  usageFunction: string;
  unitsPerFloor: number | ''; // Số căn mỗi tầng
  totalUnitsCount: number | ''; // Tổng số căn hộ ước tính
  managementContactName?: string; // Đại diện BQL / BQT tòa nhà
  managementContactPhone?: string; // Số điện thoại BQL
}
