import {
  Activity,
  FileCheck2,
  Hash,
  Home,
  Layers,
  MapPin,
  PenTool,
  User,
} from 'lucide-react';
import type {
  CondoMasterFormState,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { MasterStep02Deformation, MasterStep08Conclusions } from './steps/MasterHouseStepAdapters';
import { MasterStep01Identification } from './steps/MasterStep01Identification';
import { MasterStep03StructureInterview } from './steps/MasterStep03StructureInterview';
import { MasterStep04FloorPlans } from './steps/MasterStep04FloorPlans';
import { MasterStep06MetroGis } from './steps/MasterStep06MetroGis';
import { MasterStep07Scores } from './steps/MasterStep07Scores';
import { MasterStep09Signoff } from './steps/MasterStep09Signoff';

// Cùng số bước với Nhà dân; Bước 05 Burland thuộc hồ sơ Khu vực dùng chung và Căn hộ con
export const CONDO_MASTER_STEPS: CondoStepRegistryItem<CondoMasterFormState>[] = [
  { stepId: 'step-1', number: '01', title: 'Nhận Diện & Hiện Trạng Tổng Quan', icon: Home, Component: MasterStep01Identification },
  { stepId: 'step-2', number: '02', title: 'Đo Biến Dạng & Lún Nghiêng', icon: Activity, selfFramed: true, Component: MasterStep02Deformation },
  { stepId: 'step-3', number: '03', title: 'Kết Cấu & Phỏng Vấn', icon: User, Component: MasterStep03StructureInterview },
  { stepId: 'step-4', number: '04', title: 'Mặt Bằng Các Tầng', icon: Layers, Component: MasterStep04FloorPlans },
  { stepId: 'step-6', number: '06', title: 'Tương Quan Metro & Đột Biến GIS', icon: MapPin, Component: MasterStep06MetroGis },
  { stepId: 'step-7', number: '07', title: 'Bảng Điểm Kỹ Thuật ECS & VI', icon: Hash, Component: MasterStep07Scores },
  { stepId: 'step-8', number: '08', title: 'Kết Luận & Đề Xuất Thẩm Định', icon: FileCheck2, selfFramed: true, Component: MasterStep08Conclusions },
  { stepId: 'step-9', number: '09', title: 'Biên Bản Hiện Trường Đã Ký', icon: PenTool, selfFramed: true, Component: MasterStep09Signoff },
];
