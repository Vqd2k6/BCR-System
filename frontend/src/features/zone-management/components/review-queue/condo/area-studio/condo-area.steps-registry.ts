import { Award, FileCheck2, Home, Layers, PenTool } from 'lucide-react';
import type {
  CondoAreaFormState,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { AreaStep01Identification } from './steps/AreaStep01Identification';
import { AreaStep04ZonesElements } from './steps/AreaStep04ZonesElements';
import { AreaStep05Burland } from './steps/AreaStep05Burland';
import { AreaStep08Conclusions } from './steps/AreaStep08Conclusions';
import { AreaStep09Signoff } from './steps/AreaStep09Signoff';

// Cùng số bước với Nhà dân; biến dạng, kết cấu, Metro và điểm số kế thừa từ Tòa nhà mẹ
export const CONDO_AREA_STEPS: CondoStepRegistryItem<CondoAreaFormState>[] = [
  { stepId: 'step-1', number: '01', title: 'Nhận Diện & Hiện Trạng Tổng Quan', icon: Home, Component: AreaStep01Identification },
  { stepId: 'step-4', number: '04', title: 'Vùng Z & Cấu Kiện E', icon: Layers, Component: AreaStep04ZonesElements },
  { stepId: 'step-5', number: '05', title: 'Khuyết Tật Bề Mặt & Nứt Burland', icon: Award, Component: AreaStep05Burland },
  { stepId: 'step-8', number: '08', title: 'Kết Luận & Đề Xuất Thẩm Định', icon: FileCheck2, Component: AreaStep08Conclusions },
  { stepId: 'step-9', number: '09', title: 'Biên Bản Hiện Trường Đã Ký', icon: PenTool, Component: AreaStep09Signoff },
];
