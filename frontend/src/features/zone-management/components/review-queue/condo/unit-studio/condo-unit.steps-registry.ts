import {
  Building2,
  UserCheck,
  LayoutGrid,
  ShieldCheck,
} from 'lucide-react';
import type {
  CondoStepRegistryItem,
  CondoUnitFormState,
} from '../types/condo-audit.types';
import { UnitStep1ParentInheritance } from './steps/UnitStep1ParentInheritance';
import { UnitStep2OwnerStatusPhotos } from './steps/UnitStep2OwnerStatusPhotos';
import { UnitStep3RoomsDefectsSag } from './steps/UnitStep3RoomsDefectsSag';
import { UnitStep4BurlandSignatures } from './steps/UnitStep4BurlandSignatures';

export const CONDO_UNIT_STEPS: CondoStepRegistryItem<CondoUnitFormState>[] = [
  {
    stepId: 'unit-step-1',
    stepNumber: 1,
    title: 'Kế Thừa Thông Số Kỹ Thuật Khối Tháp Cha (BUILDING_MASTER)',
    subtitle: 'Đối chiếu quy mô tầng, hệ kết cấu, hạng móng CAT, cự ly Metro và điểm ECS/VI/BRA nền từ tòa nhà gốc',
    navLabel: 'Kế thừa Khối Tháp Cha',
    icon: Building2,
    dirtyWatchKeys: [],
    Component: UnitStep1ParentInheritance,
  },
  {
    stepId: 'unit-step-2',
    stepNumber: 2,
    title: 'Định Danh Chủ Hộ, Hiện Trạng Cửa/Thấm & Ảnh Căn Hộ (P-01 / P-04)',
    subtitle: 'Thông tin chủ sở hữu căn hộ, tình trạng kẹt cửa, thấm nước tầng trên và bộ 2 ảnh nhận diện P-01, P-04',
    navLabel: 'Chủ hộ, Cửa/Thấm & Ảnh',
    icon: UserCheck,
    dirtyWatchKeys: [
      'unitCode',
      'floorNumber',
      'ownerName',
      'ownerPhone',
      'residentRole',
      'occupancyStatus',
      'doorJamming',
      'waterLeakageFromUpperFloor',
    ],
    Component: UnitStep2OwnerStatusPhotos,
  },
  {
    stepId: 'unit-step-3',
    stepNumber: 3,
    title: 'Sơ Đồ Phòng, Hư Hại Nội Bộ (Zones Z / Defects D) & Độ Võng Dầm/Sàn',
    subtitle: 'Mặt bằng bố trí phòng, danh mục vùng hư hại kiến trúc nội bộ căn hộ và kiểm tra độ võng dầm/sàn BTCT',
    navLabel: 'Phòng, Vết nứt & Võng sàn',
    icon: LayoutGrid,
    dirtyWatchKeys: [
      'roomLayoutUrl',
      'roomLayoutNotes',
      'damageZones',
      'beamSagging',
    ],
    Component: UnitStep3RoomsDefectsSag,
  },
  {
    stepId: 'unit-step-4',
    stepNumber: 4,
    title: 'Đánh Giá Burland Căn Hộ, Hồ Sơ Vắng Chủ & Chữ Ký Nghiệm Thu',
    subtitle: 'Tổng hợp cấp độ hư hại Burland, xác thực pháp lý căn hộ vắng chủ (nếu có), ý kiến chủ hộ và chữ ký số',
    navLabel: 'Burland, Vắng chủ & Ký số',
    icon: ShieldCheck,
    dirtyWatchKeys: [
      'burlandSummary',
      'summaryConclusions',
      'engineeringRecommendations',
      'ownerFeedback',
      'signatures',
    ],
    Component: UnitStep4BurlandSignatures,
  },
];

