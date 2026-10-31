import {
  Building2,
  Layers,
  Activity,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import type {
  CondoMasterFormState,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { MasterStep1Identification } from './steps/MasterStep1Identification';
import { MasterStep2ScaleFoundation } from './steps/MasterStep2ScaleFoundation';
import { MasterStep3HistoryTilt } from './steps/MasterStep3HistoryTilt';
import { MasterStep4ScopeGisMetro } from './steps/MasterStep4ScopeGisMetro';
import { MasterStep5ScoresSignoff } from './steps/MasterStep5ScoresSignoff';

export const CONDO_MASTER_STEPS: CondoStepRegistryItem<CondoMasterFormState>[] = [
  {
    stepId: 'master-step-1',
    stepNumber: 1,
    title: 'Định Danh Khối Tháp, Ban Quản Lý & Bộ 4 Ảnh P-01..P-04',
    subtitle: 'Thông tin pháp lý tòa nhà chung cư, đại diện Ban Quản Lý và ảnh nhận diện toàn khối tháp',
    navLabel: 'Định danh & Ảnh P01-P04',
    icon: Building2,
    dirtyWatchKeys: [
      'buildingName',
      'officialCadastralCode',
      'houseNumber',
      'street',
      'ward',
      'managementBoardName',
      'managementContactName',
      'managementContactPhone',
      'accessLimitation',
    ],
    Component: MasterStep1Identification,
  },
  {
    stepId: 'master-step-2',
    stepNumber: 2,
    title: 'Quy Mô Tầng/Hầm, Hệ Kết Cấu & Phân Hạng Móng CAT 1..5',
    subtitle: 'Quy mô chiều cao, kết cấu chịu lực chính, hạng móng CAT và hồ sơ bản vẽ hoàn công móng',
    navLabel: 'Quy mô & Hạng móng CAT',
    icon: Layers,
    dirtyWatchKeys: [
      'aboveFloors',
      'undergroundFloors',
      'constructionYear',
      'buildingHeightM',
      'constructionAreaM2',
      'structureSystem',
      'foundationCatScore',
      'foundationDepthM',
      'asBuiltDrawingPhotos',
    ],
    Component: MasterStep2ScaleFoundation,
  },
  {
    stepId: 'master-step-3',
    stepNumber: 3,
    title: 'Lịch Sử Vận Hành BQL & Quan Trắc Lún / Nghiêng Khối Đế',
    subtitle: 'Phỏng vấn lịch sử cải tạo/biến động và đo đạc độ nghiêng tổng thể, lún lệch khối đế',
    navLabel: 'Lịch sử & Lún nghiêng',
    icon: Activity,
    dirtyWatchKeys: ['historyInterview', 'settlementTilt'],
    Component: MasterStep3HistoryTilt,
  },
  {
    stepId: 'master-step-4',
    stepNumber: 4,
    title: 'Phạm Vi Khảo Sát, Cự Ly Tuyến Metro & Mặt Bằng CAD Các Tầng',
    subtitle: 'Khoảng cách tịnh không đến tim hầm/nhà ga Metro, ranh đất GIS và danh mục mặt bằng CAD tầng',
    navLabel: 'Cự ly Metro & CAD tầng',
    icon: Compass,
    dirtyWatchKeys: [
      'metroOffsetDistance',
      'clearanceOffsetDistance',
      'gisMutationConfirmed',
    ],
    Component: MasterStep4ScopeGisMetro,
  },
  {
    stepId: 'master-step-5',
    stepNumber: 5,
    title: 'Ma Trận Chỉ Số Rủi Ro (ECS • VI • BRA), Kết Luận & Chữ Ký BQL',
    subtitle: 'Tổng hợp điểm số kỹ thuật kế thừa cho toàn bộ căn hộ con, kiến nghị quan trắc và chữ ký nghiệm thu',
    navLabel: 'Điểm ECS/VI/BRA & Ký số',
    icon: ShieldCheck,
    dirtyWatchKeys: [
      'ecs',
      'vi',
      'executiveSummary',
      'summaryConclusions',
      'engineeringRecommendations',
      'signatures',
    ],
    Component: MasterStep5ScoresSignoff,
  },
];

