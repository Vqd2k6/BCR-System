import {
  MapPin,
  Camera,
  AlertTriangle,
  HardHat,
  ShieldCheck,
} from 'lucide-react';
import type {
  CondoAreaFormState,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { AreaStep1CadLocation } from './steps/AreaStep1CadLocation';
import { AreaStep2OverviewCropped } from './steps/AreaStep2OverviewCropped';
import { AreaStep3DamageZones } from './steps/AreaStep3DamageZones';
import { AreaStep4StructuralElements } from './steps/AreaStep4StructuralElements';
import { AreaStep5BurlandSignoff } from './steps/AreaStep5BurlandSignoff';

export const CONDO_AREA_STEPS: CondoStepRegistryItem<CondoAreaFormState>[] = [
  {
    stepId: 'area-step-1',
    stepNumber: 1,
    title: 'Định Danh Khu Vực Chung & Tọa Độ Khoanh Vùng Mặt Bằng CAD',
    subtitle: 'Thông tin khu vực kỹ thuật/hành lang dùng chung, trạng thái tiếp cận và vùng BBox trên CAD tầng',
    navLabel: 'Định danh & BBox CAD',
    icon: MapPin,
    dirtyWatchKeys: [
      'areaName',
      'areaCategory',
      'floorNumber',
      'locationDescription',
      'accessStatus',
      'lockedReason',
      'boundingBox',
    ],
    Component: AreaStep1CadLocation,
  },
  {
    stepId: 'area-step-2',
    stepNumber: 2,
    title: 'Ảnh Toàn Cảnh Không Gian Chung & Trích Xuất Mặt Bằng Cắt Vùng',
    subtitle: 'Bộ ảnh tổng thể khu vực dùng chung và bản vẽ CAD cắt phóng to vùng khảo sát (Cropped CAD)',
    navLabel: 'Ảnh toàn cảnh & Cropped CAD',
    icon: Camera,
    dirtyWatchKeys: ['overviewPhotos', 'croppedCadUrl'],
    Component: AreaStep2OverviewCropped,
  },
  {
    stepId: 'area-step-3',
    stepNumber: 3,
    title: 'Vùng Hư Hại Kiến Trúc & Chi Tiết Khuyết Tật (Zones Z / Defects D)',
    subtitle: 'Quản lý CRUD vùng hư hại kiến trúc (tường xây, trần, sàn hoàn thiện) và vết nứt có thước đo',
    navLabel: 'Hư hại Kiến trúc (Z / D)',
    icon: AlertTriangle,
    dirtyWatchKeys: ['damageZones'],
    Component: AreaStep3DamageZones,
  },
  {
    stepId: 'area-step-4',
    stepNumber: 4,
    title: 'Cấu Kiện Chịu Lực Chính (Structural Elements E-01..E-n)',
    subtitle: 'Kiểm định chuyên sâu cột BTCT, vách lõi thang, dầm chuyển, sê-nô và khuyết tật kết cấu chính',
    navLabel: 'Cấu kiện chịu lực (E)',
    icon: HardHat,
    dirtyWatchKeys: ['structuralElements'],
    Component: AreaStep4StructuralElements,
  },
  {
    stepId: 'area-step-5',
    stepNumber: 5,
    title: 'Đánh Giá Burland Khu Vực Chung, Kết Luận & Chữ Ký Nghiệm Thu',
    subtitle: 'Tổng hợp cấp độ hư hại Burland (Grade 0..5), nhận định kỹ sư thẩm định và chữ ký đại diện BQL',
    navLabel: 'Burland & Ký nghiệm thu',
    icon: ShieldCheck,
    dirtyWatchKeys: [
      'burlandSummary',
      'summaryConclusions',
      'engineeringRecommendations',
      'signatures',
    ],
    Component: AreaStep5BurlandSignoff,
  },
];

