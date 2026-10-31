import { Activity, Award, FileCheck2, Home, Layers, PenTool, User } from 'lucide-react';
import type {
  CondoStepRegistryItem,
  CondoUnitFormState,
} from '../types/condo-audit.types';
import { UnitStep01Identification } from './steps/UnitStep01Identification';
import { UnitStep02Deformation } from './steps/UnitStep02Deformation';
import { UnitStep03Interview } from './steps/UnitStep03Interview';
import { UnitStep04RoomsZonesElements } from './steps/UnitStep04RoomsZonesElements';
import { UnitStep05Burland } from './steps/UnitStep05Burland';
import { UnitStep08Conclusions } from './steps/UnitStep08Conclusions';
import { UnitStep09SignaturesAbsentee } from './steps/UnitStep09SignaturesAbsentee';

// Cùng số bước với Nhà dân; Metro/GIS và ECS/VI kế thừa từ Tòa nhà mẹ
export const CONDO_UNIT_STEPS: CondoStepRegistryItem<CondoUnitFormState>[] = [
  { stepId: 'step-1', number: '01', title: 'Nhận Diện & Hiện Trạng Tổng Quan', icon: Home, Component: UnitStep01Identification },
  { stepId: 'step-2', number: '02', title: 'Đo Biến Dạng & Thấm Dột', icon: Activity, Component: UnitStep02Deformation },
  { stepId: 'step-3', number: '03', title: 'Phỏng Vấn Chủ Hộ', icon: User, Component: UnitStep03Interview },
  { stepId: 'step-4', number: '04', title: 'Phòng, Vùng Z & Cấu Kiện E', icon: Layers, Component: UnitStep04RoomsZonesElements },
  { stepId: 'step-5', number: '05', title: 'Khuyết Tật Bề Mặt & Nứt Burland', icon: Award, Component: UnitStep05Burland },
  { stepId: 'step-8', number: '08', title: 'Kết Luận & Đề Xuất Thẩm Định', icon: FileCheck2, Component: UnitStep08Conclusions },
  { stepId: 'step-9', number: '09', selfFramed: true, title: 'Biên Bản Hiện Trường Đã Ký', icon: PenTool, Component: UnitStep09SignaturesAbsentee },
];
