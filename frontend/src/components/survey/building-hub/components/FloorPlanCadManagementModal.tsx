import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Link as LinkIcon,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  Save,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import { CadBlueprintUploader } from './CadBlueprintUploader';
import { TypicalFloorsSelectorModal } from './TypicalFloorsSelectorModal';
import {
  FloorPlanCadPartitionCanvas,
  type UnitPartitionBox,
} from '../../../canvas/FloorPlanCadPartitionCanvas';
import { generateNextPartitionCode } from '../../../../core/utils/codeFormattingUtils';
import {
  deriveBuildingFloorNumbers,
  detectDefaultFloorScope,
  getDefaultFloorCode,
  STANDARD_FLOOR_CODE_OPTIONS,
  type FloorScope,
} from '../../../../core/utils/floorUtils';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import confetti from 'canvas-confetti';

export type { FloorScope };
export { detectDefaultFloorScope, getDefaultFloorCode, STANDARD_FLOOR_CODE_OPTIONS };

interface FloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string;
  floor_code?: string;
  cad_photo_url: string;
  applicable_floors?: number[];
  scope?: FloorScope;
  area_type?: string;
}

interface CadUnitItem {
  id: string;
  unit_code: string;
  floor_number?: number;
  cad_bbox?: { x: number; y: number; width: number; height: number };
  cad_polygon?: { x: number; y: number }[];
  unit_cad_url?: string;
  unit_type?: 'UNIT' | 'MASTER';
  status?: string;
  phase1_report_id?: string | null;
  phase2_report_id?: string | null;
}

import {
  FloorPlanCadSidebar,
  type BuildingFloorItem,
} from './FloorPlanCadSidebar';

export type { BuildingFloorItem };

interface Props {
  parcel: GisParcel;
  onClose: () => void;
  onUnitsUpdated?: () => void;
  readOnly?: boolean;
  initialFloor?: number;
}

export const FloorPlanCadManagementModal: React.FC<Props> = ({
  parcel,
  onClose,
  onUnitsUpdated,
  readOnly = false,
  initialFloor,
}) => {
  const parcelId = parcel.id;
  const projectCode = parcel.projectParcelCode || parcel.project_parcel_code || 'B-XXXXX';
  const initialFloorCount = parcel.floorCount || parcel.floor_count || 5;

  // Thu phóng sidebar danh sách tầng để tối ưu diện tích vẽ CAD
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Danh sách tầng tùy chỉnh bổ sung bởi người dùng
  const [customFloors, setCustomFloors] = useState<number[]>([]);
  const [newFloorInput, setNewFloorInput] = useState<string>('');
  const [newFloorCodeInput, setNewFloorCodeInput] = useState<string>('');
  const [showAddFloorInput, setShowAddFloorInput] = useState<boolean>(false);

  // Dữ liệu từ API
  const [existingFloorPlans, setExistingFloorPlans] = useState<FloorPlanItem[]>([]);
  const [allUnits, setAllUnits] = useState<CadUnitItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Tự động ẩn thông báo thành công sau 4 giây (Auto-dismiss timer)
  useEffect(() => {
    if (!saveSuccessMsg) return;
    const timer = setTimeout(() => {
      setSaveSuccessMsg('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [saveSuccessMsg]);

  // Kích hoạt pháo hoa chúc mừng và hiển thị thông báo thành công
  const triggerSuccessFeedback = useCallback((msg: string) => {
    setSaveSuccessMsg(msg);
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.15 },
        zIndex: 100005,
      });
    } catch (_err) {}
  }, []);

  // Tầng đang được chọn thao tác
  const [activeFloor, setActiveFloor] = useState<number>(initialFloor !== undefined ? initialFloor : 1);
  const [floorName, setFloorName] = useState<string>('Tầng 1');
  const [floorCode, setFloorCode] = useState<string>('F01');
  const [cadUrl, setCadUrl] = useState<string>('');
  const [applicableFloors, setApplicableFloors] = useState<number[]>([1]);
  const [floorScope, setFloorScope] = useState<FloorScope>('UNIT');
  const [partitions, setPartitions] = useState<UnitPartitionBox[]>([]);
  const [isPartitionsValid, setIsPartitionsValid] = useState<boolean>(true);
  const [isTypicalModalOpen, setIsTypicalModalOpen] = useState<boolean>(false);

  // Quản lý trạng thái chưa lưu (Unsaved Changes Guard)
  const [isFloorDirty, setIsFloorDirty] = useState<boolean>(false);
  const [pendingFloorSwitch, setPendingFloorSwitch] = useState<number | null>(null);
  const [showUnsavedConfirmModal, setShowUnsavedConfirmModal] = useState<boolean>(false);
  const [deletedFloorNumbers, setDeletedFloorNumbers] = useState<number[]>(
    parcel.deletedFloors || parcel.deleted_floors || []
  );

  // 1. Tải toàn bộ Floor Plans & Units của thửa đất
  const fetchAllFloorData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [plansRes, unitsRes, parcelRes] = await Promise.all([
        api.get(`/parcels/${parcelId}/floor-plans`).catch((err) => {
          console.warn('[FloorPlanCadModal:getFloorPlans] Lỗi nạp floor plans:', err);
          return { data: { data: { plans: [] } } };
        }),
        api.get(`/parcels/${parcelId}/units`).catch((err) => {
          console.warn('[FloorPlanCadModal:getUnits] Lỗi nạp danh sách căn hộ:', err);
          return { data: { data: { units: [] } } };
        }),
        api.get(`/parcels/${parcelId}`).catch((err) => {
          console.warn('[FloorPlanCadModal:getParcel] Lỗi nạp thông tin thửa:', err);
          return { data: { data: null } };
        }),
      ]);

      const plans: FloorPlanItem[] = plansRes.data?.data?.plans || [];
      const units: CadUnitItem[] = unitsRes.data?.data?.units || [];
      const latestDeleted = parcelRes.data?.data?.deleted_floors;
      if (Array.isArray(latestDeleted)) {
        setDeletedFloorNumbers(latestDeleted);
      }

      setExistingFloorPlans(plans);
      setAllUnits(units);

      // Ưu tiên tầng initialFloor (nếu được truyền từ Hub), nếu không thì chọn tầng có plan đầu tiên hoặc Tầng 1
      let targetFloorNum = initialFloor !== undefined ? initialFloor : (plans.length > 0 ? plans[0].floor_number : 1);

      // QUAN TRỌNG: Nếu initialFloor được chỉ định, không fallback về plans[0] để tránh cướp tầng
      const directPlan = plans.find((p) => p.floor_number === targetFloorNum);
      const sharedPlan = plans.find((p) => p.floor_number !== targetFloorNum && p.applicable_floors && p.applicable_floors.includes(targetFloorNum));
      const targetPlan = directPlan || sharedPlan || (initialFloor === undefined && plans.length > 0 ? plans[0] : null);

      if (targetPlan) {
        const effectiveFloorNum = directPlan ? directPlan.floor_number : targetFloorNum;
        targetFloorNum = effectiveFloorNum;
        setActiveFloor(effectiveFloorNum);
        setCadUrl(targetPlan.cad_photo_url || '');
        const defName = effectiveFloorNum === 0 ? 'Tầng Trệt / G' : effectiveFloorNum < 0 ? `Hầm B${Math.abs(effectiveFloorNum)}` : `Tầng ${effectiveFloorNum}`;
        const effName = directPlan?.floor_name || defName;
        setFloorName(effName);
        const assignedCode = directPlan?.floor_code || getDefaultFloorCode(effectiveFloorNum, effName);
        setFloorCode(assignedCode);
        setApplicableFloors(targetPlan.applicable_floors || [effectiveFloorNum]);
        const detected = detectDefaultFloorScope(effectiveFloorNum, effName);
        setFloorScope(targetPlan.scope || detected.scope);
      } else {
        setActiveFloor(targetFloorNum);
        const defName = targetFloorNum === 0 ? 'Tầng Trệt / G' : targetFloorNum < 0 ? `Hầm B${Math.abs(targetFloorNum)}` : `Tầng ${targetFloorNum}`;
        setCadUrl('');
        setFloorName(defName);
        setFloorCode(getDefaultFloorCode(targetFloorNum, defName));
        setApplicableFloors([targetFloorNum]);
        const detected = detectDefaultFloorScope(targetFloorNum, defName);
        setFloorScope(detected.scope);
      }

      // Khởi tạo ngay danh sách partitions cho tầng đang active từ allUnits
      const floorUnits = units.filter((u) => (u.floor_number ?? 1) === targetFloorNum);
      if (floorUnits.length > 0) {
        const boxes: UnitPartitionBox[] = floorUnits
          .filter((u) => Boolean(u.cad_bbox))
          .map((u) => ({
            id: u.id,
            unitCode: u.unit_code,
            partitionType: u.unit_type || 'UNIT',
            x: u.cad_bbox?.x ?? 0,
            y: u.cad_bbox?.y ?? 0,
            width: u.cad_bbox?.width ?? 0,
            height: u.cad_bbox?.height ?? 0,
            polygon: u.cad_polygon || undefined,
            unitCadUrl: u.unit_cad_url || undefined,
          }));
        setPartitions(boxes);
      } else {
        setPartitions([]);
      }
    } catch (err) {
      console.warn('[FloorPlanCad] Lỗi nạp dữ liệu tòa nhà:', err);
    } finally {
      setIsLoading(false);
    }
  }, [parcelId, initialFloor]);

  useEffect(() => {
    fetchAllFloorData();
  }, [fetchAllFloorData]);

  // 2. Tính toán danh sách đầy đủ các tầng của tòa nhà (Đồng bộ Single Source of Truth với Hub)
  const buildingFloors = useMemo<BuildingFloorItem[]>(() => {
    const sortedFloors = deriveBuildingFloorNumbers({
      floorPlans: existingFloorPlans,
      units: allUnits, // Đã bổ sung allUnits: Khắc phục triệt để lỗi thiếu tầng so với Hub!
      customFloors,
      deletedFloors: deletedFloorNumbers,
    });

    return sortedFloors.map((flNum) => {
      // Tìm plan riêng của tầng
      const directPlan = existingFloorPlans.find((p) => p.floor_number === flNum);

      // Nếu không có plan riêng, kiểm tra xem có tầng nào dùng chung cho tầng này không
      const sharedPlan = existingFloorPlans.find(
        (p) => p.floor_number !== flNum && p.applicable_floors && p.applicable_floors.includes(flNum)
      );

      const hasDirectCad = Boolean(directPlan?.cad_photo_url);
      const isInherited = !hasDirectCad && Boolean(sharedPlan?.cad_photo_url);

      const effectivePlan = directPlan || sharedPlan;
      const unitCount = allUnits.filter((u) => (u.floor_number ?? 1) === flNum).length;

      let defaultName = `Tầng ${flNum}`;
      if (flNum === 0) defaultName = 'Tầng Trệt / G';
      if (flNum < 0) defaultName = `Hầm B${Math.abs(flNum)}`;

      // QUAN TRỌNG: Tên hiển thị của tầng phải là tên riêng hoặc tên mặc định của chính tầng này, KHÔNG lấy chuỗi của tầng nguồn
      const floorDisplayName = directPlan?.floor_name || defaultName;
      const effectiveFloorCode = directPlan?.floor_code || getDefaultFloorCode(flNum, floorDisplayName);

      // Tính scope tự động: Nếu tầng này đang active thì ưu tiên scope từ các partitions hiện tại
      let effectiveScope: FloorScope = 'UNIT';
      if (flNum === activeFloor && partitions.length > 0) {
        const hasUnit = partitions.some((p) => (p.partitionType || 'UNIT') === 'UNIT');
        const hasMaster = partitions.some((p) => p.partitionType === 'MASTER');
        effectiveScope = hasUnit && hasMaster ? 'BOTH' : hasMaster ? 'MASTER' : 'UNIT';
      } else if (flNum === activeFloor) {
        effectiveScope = floorScope;
      } else if (effectivePlan?.scope) {
        effectiveScope = effectivePlan.scope;
      } else {
        effectiveScope = detectDefaultFloorScope(flNum, floorDisplayName).scope;
      }

      return {
        floorNumber: flNum,
        floorName: floorDisplayName,
        floorCode: effectiveFloorCode,
        hasCad: hasDirectCad || isInherited,
        cadPhotoUrl: effectivePlan?.cad_photo_url,
        applicableFloors: effectivePlan?.applicable_floors,
        unitCount,
        isInherited,
        inheritedFromFloor: isInherited ? sharedPlan?.floor_number : undefined,
        scope: effectiveScope,
      };
    });
  }, [existingFloorPlans, customFloors, allUnits, activeFloor, partitions, floorScope, deletedFloorNumbers]);

  // 3. Tải chi tiết tầng đang chọn (partitions & CAD)
  const loadActiveFloorDetails = useCallback(
    async (floorNum: number) => {
      try {
        const res = await api.get(`/parcels/${parcelId}/floor-plans/${floorNum}`);
        if (res.data?.success) {
          const { plan, units } = res.data.data;
          if (plan) {
            setCadUrl(plan.cad_photo_url || '');
            setFloorName(plan.floor_name || `Tầng ${floorNum}`);
            const assignedCode = plan.floor_code || getDefaultFloorCode(floorNum, plan.floor_name || `Tầng ${floorNum}`);
            setFloorCode(assignedCode);
            setApplicableFloors(plan.applicable_floors || [floorNum]);
            const detected = detectDefaultFloorScope(floorNum, plan.floor_name || `Tầng ${floorNum}`);
            setFloorScope(plan.scope || detected.scope);
          } else {
            // Kiểm tra xem tầng này có đang thừa hưởng từ tầng điển hình nào không
            const sharedPlan = existingFloorPlans.find(
              (p) => p.applicable_floors && p.applicable_floors.includes(floorNum)
            );
            if (sharedPlan) {
              setCadUrl(sharedPlan.cad_photo_url || '');
              const defName = floorNum === 0 ? 'Tầng Trệt / G' : floorNum < 0 ? `Hầm B${Math.abs(floorNum)}` : `Tầng ${floorNum}`;
              setFloorName(defName);
              const assignedCode = sharedPlan.floor_code || getDefaultFloorCode(floorNum, defName);
              setFloorCode(assignedCode);
              setApplicableFloors(sharedPlan.applicable_floors || [sharedPlan.floor_number]);
              const detected = detectDefaultFloorScope(floorNum, defName);
              setFloorScope(sharedPlan.scope || detected.scope);
            } else {
              setCadUrl('');
              const defName = floorNum === 0 ? 'Tầng Trệt / G' : floorNum < 0 ? `Hầm B${Math.abs(floorNum)}` : `Tầng ${floorNum}`;
              setFloorName(defName);
              const existingFloorInfo = buildingFloors.find((b) => b.floorNumber === floorNum);
              const assignedCode = existingFloorInfo?.floorCode || getDefaultFloorCode(floorNum, defName);
              setFloorCode(assignedCode);
              setApplicableFloors([floorNum]);
              const detected = detectDefaultFloorScope(floorNum, defName);
              setFloorScope(detected.scope);
            }
          }

          if (units && Array.isArray(units) && units.length > 0) {
            const boxes: UnitPartitionBox[] = (units as CadUnitItem[])
              .filter((u) => Boolean(u.cad_bbox))
              .map((u) => ({
                id: u.id,
                unitCode: u.unit_code,
                partitionType: u.unit_type || 'UNIT',
                x: u.cad_bbox?.x ?? 0,
                y: u.cad_bbox?.y ?? 0,
                width: u.cad_bbox?.width ?? 0,
                height: u.cad_bbox?.height ?? 0,
                polygon: u.cad_polygon || undefined,
                unitCadUrl: u.unit_cad_url || undefined,
              }));
            setPartitions(boxes);
          } else {
            const fallbackUnits = allUnits.filter((u) => (u.floor_number ?? 1) === floorNum && Boolean(u.cad_bbox));
            if (fallbackUnits.length > 0) {
              setPartitions(fallbackUnits.map((u) => ({
                id: u.id,
                unitCode: u.unit_code,
                partitionType: u.unit_type || 'UNIT',
                x: u.cad_bbox?.x ?? 0,
                y: u.cad_bbox?.y ?? 0,
                width: u.cad_bbox?.width ?? 0,
                height: u.cad_bbox?.height ?? 0,
                polygon: u.cad_polygon || undefined,
                unitCadUrl: u.unit_cad_url || undefined,
              })));
            } else {
              setPartitions([]);
            }
          }
        }
      } catch (err) {
        console.warn(`[FloorPlanCad] Lỗi tải chi tiết Tầng ${floorNum}:`, err);
      } finally {
        setIsFloorDirty(false);
      }
    },
    [parcelId, existingFloorPlans, buildingFloors, allUnits]
  );

  // Chuyển tầng có bảo vệ dữ liệu chưa lưu và pre-cache partitions
  const executeFloorSwitch = (floorNum: number) => {
    if (!buildingFloors.some((f) => f.floorNumber === floorNum)) {
      setCustomFloors((prev) => (prev.includes(floorNum) ? prev : [...prev, floorNum]));
      setNewFloorInput('');
      setShowAddFloorInput(false);
    }
    setActiveFloor(floorNum);
    setIsFloorDirty(false);
    setSaveSuccessMsg('');

    // Pre-cache thông tin tầng từ buildingFloors để giao diện không bị giật
    const floorInfo = buildingFloors.find((f) => f.floorNumber === floorNum);
    if (floorInfo) {
      setFloorName(floorInfo.floorName);
      setFloorCode(floorInfo.floorCode);
      setCadUrl(floorInfo.cadPhotoUrl || '');
      setFloorScope(floorInfo.scope);
    }
    const cachedBoxes = allUnits
      .filter((u) => (u.floor_number ?? 1) === floorNum && Boolean(u.cad_bbox))
      .map((u) => ({
        id: u.id,
        unitCode: u.unit_code,
        partitionType: u.unit_type || 'UNIT',
        x: u.cad_bbox?.x ?? 0,
        y: u.cad_bbox?.y ?? 0,
        width: u.cad_bbox?.width ?? 0,
        height: u.cad_bbox?.height ?? 0,
        polygon: u.cad_polygon || undefined,
        unitCadUrl: u.unit_cad_url || undefined,
      }));
    if (cachedBoxes.length > 0) {
      setPartitions(cachedBoxes);
    }

    loadActiveFloorDetails(floorNum);
  };

  const handleSelectFloor = (floorNum: number) => {
    if (floorNum === activeFloor) {
      if (partitions.length === 0) {
        loadActiveFloorDetails(floorNum);
      }
      return;
    }
    if (isFloorDirty) {
      setPendingFloorSwitch(floorNum);
      setShowUnsavedConfirmModal(true);
      return;
    }
    executeFloorSwitch(floorNum);
  };

  // Safe Close guard
  const handleSafeClose = () => {
    if (isFloorDirty) {
      setPendingFloorSwitch(-9999); // Flag close
      setShowUnsavedConfirmModal(true);
      return;
    }
    onClose();
  };

  // Thêm tầng mới vào danh sách
  const handleAddCustomFloor = () => {
    const parsed = parseInt(newFloorInput.trim(), 10);
    if (!isNaN(parsed)) {
      // Phục hồi tầng nếu trước đó nằm trong danh sách đã xóa
      setDeletedFloorNumbers((prev) => prev.filter((f) => f !== parsed));
      if (!buildingFloors.some((f) => f.floorNumber === parsed)) {
        if (isFloorDirty) {
          setPendingFloorSwitch(parsed);
          setShowUnsavedConfirmModal(true);
          return;
        }
        setCustomFloors((prev) => (prev.includes(parsed) ? prev : [...prev, parsed]));
        setActiveFloor(parsed);
        const assignedCode = newFloorCodeInput.trim() || getDefaultFloorCode(parsed);
        setFloorCode(assignedCode);
        const defName = parsed === 0 ? 'Tầng Trệt / G' : parsed < 0 ? `Hầm B${Math.abs(parsed)}` : `Tầng ${parsed}`;
        setFloorName(defName);
        setCadUrl('');
        setPartitions([]);
        setNewFloorInput('');
        setNewFloorCodeInput('');
        setShowAddFloorInput(false);
      }
    }
  };

  // Kế thừa CAD từ tầng khác
  const handleCopyCadFromFloor = (sourceFloor: { floorNumber: number; floorName: string; cadPhotoUrl: string }) => {
    setCadUrl(sourceFloor.cadPhotoUrl);
    setFloorName(`Tầng ${activeFloor} (Theo ${sourceFloor.floorName})`);
    // Lấy partitions của tầng nguồn nếu có
    const sourceUnits = allUnits.filter((u) => (u.floor_number ?? 1) === sourceFloor.floorNumber);
    if (sourceUnits.length > 0) {
      const currentPool = [
        ...allUnits.map((u) => ({
          unitCode: u.unit_code,
          partitionType: (u.unit_type || 'UNIT') as 'UNIT' | 'MASTER',
        })),
      ];

      const copiedBoxes: UnitPartitionBox[] = sourceUnits
        .filter((u) => Boolean(u.cad_bbox))
        .map((u) => {
          const uType: 'UNIT' | 'MASTER' = u.unit_type || 'UNIT';
          let newCode = '';
          if (/^[UM][-_]\d+$/i.test(u.unit_code.trim())) {
            newCode = generateNextPartitionCode(currentPool, uType);
          } else {
            const mm = floorCode.trim() || getDefaultFloorCode(activeFloor);
            const parts = u.unit_code.split('.');
            const nn = parts.length > 1 ? parts[1] : u.unit_code;
            const prefix = uType === 'MASTER' ? (mm.startsWith('T') ? mm : `T${mm.replace(/^F/i, '')}`) : mm.replace(/^F/i, '');
            newCode = `${prefix}.${nn}`;
          }
          currentPool.push({ unitCode: newCode, partitionType: uType });

          return {
            id: `unit_box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            unitCode: newCode,
            partitionType: uType,
            x: u.cad_bbox?.x ?? 0,
            y: u.cad_bbox?.y ?? 0,
            width: u.cad_bbox?.width ?? 0,
            height: u.cad_bbox?.height ?? 0,
            polygon: u.cad_polygon || undefined,
            unitCadUrl: u.unit_cad_url || undefined,
          };
        });
      setPartitions(copiedBoxes);
    }
    setIsFloorDirty(true);
  };

  // 4. Lưu Floor Plan & Đồng bộ Partitions (Hỗ trợ phân loại Unit & Master)
  const handleSaveFloorPlanAndPartitions = async (newPartitions?: UnitPartitionBox[]) => {
    if (!cadUrl) {
      alert('Vui lòng tải lên bản vẽ CAD cho tầng này trước khi lưu!');
      return false;
    }

    if (!isPartitionsValid) {
      alert('Vui lòng kiểm tra lại: Có ô căn hộ/khu vực đang bị trùng lặp hoặc chưa đặt mã!');
      return false;
    }

    const targetPartitions = newPartitions || partitions;
    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const targetApplicableFloors = applicableFloors.includes(activeFloor)
        ? applicableFloors
        : [...applicableFloors, activeFloor].sort((a, b) => a - b);

      // Tự động tính toán scope chính xác từ danh sách partition
      const hasUnit = targetPartitions.some((p) => (p.partitionType || 'UNIT') === 'UNIT');
      const hasMaster = targetPartitions.some((p) => p.partitionType === 'MASTER');
      const calculatedScope: FloorScope = (hasUnit && hasMaster) ? 'BOTH' : hasMaster ? 'MASTER' : hasUnit ? 'UNIT' : floorScope;

      // 1. Chuẩn bị partitions cho tầng gốc và tất cả các tầng điển hình
      const allFloorPartitions: {
        unitCode: string;
        floorNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        unitCadUrl?: string;
        unitType: 'UNIT' | 'MASTER';
      }[] = [];

      // Pool theo dõi các mã đã sử dụng trong toàn bộ tòa nhà
      const allocatedUnitsPool: Array<{ unitCode: string; partitionType: 'UNIT' | 'MASTER' }> = [
        ...allUnits
          .filter((u) => !targetApplicableFloors.includes(u.floor_number ?? 1))
          .map((u) => ({
            unitCode: u.unit_code,
            partitionType: (u.unit_type || 'UNIT') as 'UNIT' | 'MASTER',
          })),
      ];

      // Đưa các partition của tầng active vào trước (giữ nguyên 100% mã do người dùng đặt)
      for (const p of targetPartitions) {
        const uType: 'UNIT' | 'MASTER' = p.partitionType || 'UNIT';
        allFloorPartitions.push({
          unitCode: p.unitCode.trim(),
          floorNumber: activeFloor,
          bbox: {
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
          },
          unitCadUrl: p.unitCadUrl,
          unitType: uType,
        });
        allocatedUnitsPool.push({
          unitCode: p.unitCode.trim(),
          partitionType: uType,
        });
      }

      // Xử lý các tầng khác trong dải tầng điển hình (nếu có)
      const otherFloors = targetApplicableFloors.filter((fl) => fl !== activeFloor).sort((a, b) => a - b);
      for (const fl of otherFloors) {
        const existingOnFl = allUnits.filter((u) => (u.floor_number ?? 1) === fl);

        for (let i = 0; i < targetPartitions.length; i++) {
          const p = targetPartitions[i];
          const uType: 'UNIT' | 'MASTER' = p.partitionType || 'UNIT';

          // Nếu tầng này đã có căn hộ thứ i tương ứng và đã được khảo sát -> giữ nguyên mã của căn đó
          const matchedExisting = existingOnFl[i];
          let assignedCode = '';

          if (matchedExisting && matchedExisting.status && matchedExisting.status !== 'NOT_SURVEYED') {
            assignedCode = matchedExisting.unit_code;
          } else if (/^[UM][-_]\d+$/i.test(p.unitCode.trim())) {
            // Tịnh tiến mã tiếp theo theo chuẩn U-XXX hoặc M-XXX toàn tòa
            assignedCode = generateNextPartitionCode(allocatedUnitsPool, uType);
          } else {
            // Trường hợp mã cũ có tiền tố tầng dạng mm.nn
            const targetFloorItem = buildingFloors.find((b) => b.floorNumber === fl);
            const mm = targetFloorItem?.floorCode || getDefaultFloorCode(fl);
            const parts = p.unitCode.split('.');
            let nn = parts.length > 1 ? parts[1] : p.unitCode;
            if (uType === 'MASTER' && /^M\d+$/i.test(nn)) {
              nn = nn.replace(/^M/i, '');
            }
            const prefix = uType === 'MASTER' ? (mm.startsWith('T') ? mm : `T${mm.replace(/^F/i, '')}`) : mm.replace(/^F/i, '');
            assignedCode = `${prefix}.${nn}`;
          }

          allFloorPartitions.push({
            unitCode: assignedCode,
            floorNumber: fl,
            bbox: {
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
            },
            unitCadUrl: p.unitCadUrl,
            unitType: uType,
          });

          allocatedUnitsPool.push({
            unitCode: assignedCode,
            partitionType: uType,
          });
        }
      }

      // 2. Lưu đồng bộ nguyên tử (Atomic Sync) bản vẽ Floor Plan và tất cả partitions trong 1 Transaction duy nhất
      await api.post(`/parcels/${parcelId}/floor-plans/atomic-sync`, {
        floorNumber: activeFloor,
        floorPlan: {
          floorNumber: activeFloor,
          floorName: floorName || `Tầng ${activeFloor}`,
          floorCode: floorCode.trim() || getDefaultFloorCode(activeFloor, floorName),
          applicableFloors: targetApplicableFloors,
          cadPhotoUrl: cadUrl,
          scope: calculatedScope,
        },
        partitions: allFloorPartitions,
      });

      const successMessage = allFloorPartitions.length > 0
        ? `Đã lưu thành công bản vẽ CAD và phân chia ${allFloorPartitions.length} vị trí cho dải tầng [${targetApplicableFloors.join(
            ', '
          )}]!`
        : `Đã lưu thành công bản vẽ CAD ${floorName || `Tầng ${activeFloor}`}! Bạn có thể sử dụng công cụ để kéo vẽ ô phân chia căn hộ hoặc khu vực bất kỳ lúc nào.`;

      triggerSuccessFeedback(successMessage);
      setIsFloorDirty(false);

      if (onUnitsUpdated) {
        onUnitsUpdated();
      }
      fetchAllFloorData();
      return true;
    } catch (err: unknown) {
      console.error('[FloorPlanCadModal:handleSaveFloorPlanAndPartitions] Lỗi khi lưu phân chia mặt bằng:', err);
      alert(`Lỗi khi lưu phân chia mặt bằng: ${getErrorMessage(err, 'Lỗi kết nối')}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Căn hộ đã hoặc đang khảo sát trên tầng đang active
  const surveyedUnitsOnActiveFloor = useMemo(() => {
    return allUnits.filter(
      (u) =>
        (u.floor_number ?? 1) === activeFloor &&
        (Boolean(u.phase1_report_id) || (Boolean(u.status) && u.status !== 'NOT_SURVEYED'))
    );
  }, [allUnits, activeFloor]);
  const hasSurveyedUnits = surveyedUnitsOnActiveFloor.length > 0;

  // 5. Xóa bản vẽ CAD của tầng (Clear CAD Blueprint) - Cho phép làm mới CAD mà bảo toàn 100% hồ sơ khảo sát
  const handleClearCadOnly = async () => {
    const confirmed = window.confirm(
      `⚠️ BẠN CÓ CHẮC MUỐN XÓA BẢN VẼ CAD TẦNG ${activeFloor}?\n\n` +
      `• Bản vẽ CAD và các ô phân vùng CAD của Tầng ${activeFloor} sẽ được xóa để bạn tải lại file CAD mới.\n` +
      (hasSurveyedUnits
        ? `• ĐẶC BIỆT: ${surveyedUnitsOnActiveFloor.length} căn hộ đã khảo sát (${surveyedUnitsOnActiveFloor.map((u) => u.unit_code).slice(0, 3).join(', ')}) VẪN ĐƯỢC BẢO TOÀN NGUYÊN VẸN 100% trong CSDL.\n`
        : `• Tầng ${activeFloor} vẫn tồn tại trong tòa nhà, chỉ làm mới bản vẽ.\n`) +
      `\nTiếp tục xóa bản vẽ CAD?`
    );
    if (!confirmed) return;

    try {
      setIsSaving(true);
      const floorTarget = activeFloor;
      const res = await api.delete(`/parcels/${parcelId}/floor-plans/${floorTarget}?mode=CLEAR_CAD`);
      setCadUrl('');
      setPartitions([]);
      setIsFloorDirty(false);
      triggerSuccessFeedback(res.data?.data?.message || `Đã xóa bản vẽ CAD của Tầng ${floorTarget}!`);

      if (onUnitsUpdated) {
        onUnitsUpdated();
      }
      await fetchAllFloorData();
    } catch (err: unknown) {
      console.error('[FloorPlanCadModal:handleClearCadOnly] Lỗi khi xóa bản vẽ CAD:', err);
      alert(`Không thể xóa bản vẽ CAD: ${getErrorMessage(err, 'Lỗi kết nối máy chủ')}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Xóa vĩnh viễn cả Tầng khỏi Tòa Nhà (Delete Entire Floor) - CHỈ CHO PHÉP KHI CHƯA CÓ CĂN NÀO KHẢO SÁT
  const handleDeleteEntireFloor = async () => {
    if (hasSurveyedUnits) {
      alert(
        `❌ KHÔNG THỂ XÓA TẦNG ${activeFloor} KHỎI TÒA NHÀ!\n\n` +
        `Tầng này đang có ${surveyedUnitsOnActiveFloor.length} căn hộ (${surveyedUnitsOnActiveFloor.map((u) => u.unit_code).slice(0, 5).join(', ')}) đã hoặc đang được khảo sát hiện trường mang tính pháp lý bồi thường Metro 2.\n\n` +
        `👉 Nếu bạn muốn đổi bản vẽ hoặc chia lại các căn hộ, vui lòng dùng nút "Xóa Bản Vẽ CAD" để làm mới mà vẫn bảo toàn 100% hồ sơ khảo sát.`
      );
      return;
    }

    const confirmed = window.confirm(
      `🗑️ CẢNH BÁO XÓA HOÀN TOÀN TẦNG ${activeFloor} KHỎI TÒA NHÀ!\n\n` +
      `• Tầng ${activeFloor} sẽ bị xóa khỏi cấu trúc tòa nhà.\n` +
      `• Toàn bộ bản vẽ CAD và các căn hộ nháp của tầng này sẽ được dọn sạch.\n` +
      `• Các tầng khác (ví dụ Tầng ${activeFloor + 1}, Tầng ${activeFloor - 1}) vẫn GIỮ NGUYÊN số tầng, TUYỆT ĐỐI không bị dồn số.\n` +
      `• Bạn có thể thêm lại tầng này bất kỳ lúc nào bằng nút "Thêm tầng mới".\n\n` +
      `Bạn có chắc chắn muốn xóa Tầng ${activeFloor}?`
    );
    if (!confirmed) return;

    try {
      setIsSaving(true);
      const floorToDelete = activeFloor;
      const res = await api.delete(`/parcels/${parcelId}/floor-plans/${floorToDelete}?mode=DELETE_FLOOR`);
      setCadUrl('');
      setPartitions([]);
      setIsFloorDirty(false);
      setCustomFloors((prev) => prev.filter((f) => f !== floorToDelete));
      setDeletedFloorNumbers((prev) => [...prev, floorToDelete]);
      triggerSuccessFeedback(res.data?.data?.message || `Đã xóa thành công Tầng ${floorToDelete} khỏi tòa nhà!`);

      if (onUnitsUpdated) {
        onUnitsUpdated();
      }
      await fetchAllFloorData();

      // Tự động chuyển sang tầng hợp lệ còn lại sau khi xóa
      const remainingFloors = buildingFloors.filter(
        (f) => f.floorNumber !== floorToDelete && !deletedFloorNumbers.includes(f.floorNumber)
      );
      if (remainingFloors.length > 0) {
        const nextFloor = remainingFloors[0].floorNumber;
        setActiveFloor(nextFloor);
        loadActiveFloorDetails(nextFloor);
      }
    } catch (err: unknown) {
      console.error('[FloorPlanCadModal:handleDeleteEntireFloor] Lỗi khi xóa tầng:', err);
      alert(`Không thể xóa tầng: ${getErrorMessage(err, 'Lỗi kết nối máy chủ')}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler xử lý xác nhận thoát/chuyển khi có thay đổi chưa lưu
  const handleSaveAndProceed = async () => {
    const success = await handleSaveFloorPlanAndPartitions();
    if (success) {
      setShowUnsavedConfirmModal(false);
      if (pendingFloorSwitch === -9999) {
        onClose();
      } else if (pendingFloorSwitch !== null) {
        executeFloorSwitch(pendingFloorSwitch);
        setPendingFloorSwitch(null);
      }
    }
  };

  const handleDiscardAndProceed = () => {
    setShowUnsavedConfirmModal(false);
    setIsFloorDirty(false);
    if (pendingFloorSwitch === -9999) {
      onClose();
    } else if (pendingFloorSwitch !== null) {
      executeFloorSwitch(pendingFloorSwitch);
      setPendingFloorSwitch(null);
    }
  };

  const handleCancelSwitch = () => {
    setShowUnsavedConfirmModal(false);
    setPendingFloorSwitch(null);
  };

  // Tìm tầng hiện tại trong buildingFloors
  const currentFloorItem = buildingFloors.find((f) => f.floorNumber === activeFloor);

  // Danh sách các tầng khác đã có CAD để gợi ý kế thừa
  const otherFloorsWithCad = useMemo(() => {
    return buildingFloors
      .filter((f) => f.floorNumber !== activeFloor && f.hasCad && f.cadPhotoUrl)
      .map((f) => ({
        floorNumber: f.floorNumber,
        floorName: f.floorName,
        cadPhotoUrl: f.cadPhotoUrl!,
        unitCount: f.unitCount,
      }));
  }, [buildingFloors, activeFloor]);

  return (
    <div className="fixed inset-0 z-[100001] bg-slate-100 flex flex-col w-screen h-screen overflow-hidden text-slate-800 animate-in fade-in duration-100 select-none">
      {/* ========================================================= */}
      {/* 1. Header Studio Bar (Full Width, Compact & Modern) */}
      {/* ========================================================= */}
      <header className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title={isSidebarOpen ? 'Thu gọn danh sách tầng để vẽ rộng hơn' : 'Mở danh sách tầng'}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4 text-teal-600" />}
          </button>

          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-200">
            <Building2 className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              Studio CAD Phân Chia Mặt Bằng Chung Cư
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {projectCode}
              </span>
            </h2>
            <span className="hidden md:inline text-xs text-slate-400">•</span>
            <span className="hidden md:inline text-xs text-slate-500">
              {[parcel.houseNumber, parcel.street].filter(Boolean).join(' ') || 'Đang cập nhật địa chỉ'}
            </span>
          </div>
        </div>

        {/* Nút hành động chính */}
        <div className="flex items-center gap-2">
          {isFloorDirty && (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Chưa lưu thay đổi
            </span>
          )}

          {!readOnly && (
            <button
              type="button"
              disabled={isSaving || !cadUrl || !isPartitionsValid}
              onClick={() => handleSaveFloorPlanAndPartitions()}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title={!isPartitionsValid ? 'Sửa các vị trí trùng trước khi lưu' : undefined}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu {floorName || (floorCode ? `Tầng ${floorCode}` : `Tầng ${activeFloor}`)}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleSafeClose}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            title="Đóng Studio CAD"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. Main Studio Body: Collapsible Left Sidebar + Workspace */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* ------------------------------------------------------- */}
        {/* CỘT TRÁI: Floor Navigation Sidebar (Thu gọn được) */}
        {/* ------------------------------------------------------- */}
        {isSidebarOpen && (
          <FloorPlanCadSidebar
            buildingFloors={buildingFloors}
            activeFloor={activeFloor}
            isLoading={isLoading}
            readOnly={readOnly}
            showAddFloorInput={showAddFloorInput}
            setShowAddFloorInput={setShowAddFloorInput}
            newFloorInput={newFloorInput}
            setNewFloorInput={setNewFloorInput}
            newFloorCodeInput={newFloorCodeInput}
            setNewFloorCodeInput={setNewFloorCodeInput}
            onSelectFloor={handleSelectFloor}
            onAddCustomFloor={handleAddCustomFloor}
          />
        )}

        {/* ------------------------------------------------------- */}
        {/* CỘT PHẢI: Main CAD Workspace cho Active Floor (Full Real Estate) */}
        {/* ------------------------------------------------------- */}
        <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
          {/* Sub-header Bar: Tên mặt bằng, Dải tầng & Nút Xóa Tầng (Đã BỎ PHÂN LOẠI) */}
          <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Tên mặt bằng:</span>
                {readOnly ? (
                  <span className="text-xs font-bold text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                    {floorName}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={floorName}
                    onChange={(e) => {
                      setFloorName(e.target.value);
                      setIsFloorDirty(true);
                    }}
                    placeholder={`Tầng ${activeFloor}`}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-teal-800 focus:outline-none focus:border-teal-600 w-36 sm:w-44"
                  />
                )}
              </div>

              {/* Mã tầng (Floor Code) - Nhập trực tiếp hoặc chọn mẫu */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Mã tầng:</span>
                {readOnly ? (
                  <span className="text-xs font-mono font-bold text-teal-900 px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200">
                    {floorCode}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={floorCode}
                      onChange={(e) => {
                        setFloorCode(e.target.value.toUpperCase());
                        setIsFloorDirty(true);
                      }}
                      placeholder="VD: MEZZ, B01"
                      className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-teal-900 focus:outline-none focus:border-teal-600 w-20 text-center"
                      title="Mã tầng quy ước chuẩn (VD: MEZZ, B01, G, F08, TECH, ROOF)"
                    />
                    <select
                      value={
                        STANDARD_FLOOR_CODE_OPTIONS.some((o) => o.code === floorCode)
                          ? floorCode
                          : /^F\d+$/i.test(floorCode)
                          ? 'TYPICAL'
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          if (e.target.value === 'TYPICAL') {
                            const fl = activeFloor > 0 ? activeFloor : 1;
                            setFloorCode(`F${String(fl).padStart(2, '0')}`);
                            setFloorScope('BOTH');
                          } else {
                            setFloorCode(e.target.value);
                            const opt = STANDARD_FLOOR_CODE_OPTIONS.find((o) => o.code === e.target.value);
                            if (opt) {
                              setFloorScope(opt.defaultScope);
                            }
                          }
                          setIsFloorDirty(true);
                        }
                      }}
                      className="px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-[11px] text-slate-600 focus:outline-none focus:border-teal-600 cursor-pointer"
                      title="Chọn nhanh từ danh mục tầng chuẩn"
                    >
                      <option value="">-- Mẫu --</option>
                      {STANDARD_FLOOR_CODE_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Phạm vi tầng (Auto-detect & editable) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Phạm vi:</span>
                {readOnly ? (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                      floorScope === 'MASTER'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : floorScope === 'BOTH'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {floorScope === 'MASTER' ? '🏢 Toà mẹ (Master)' : floorScope === 'BOTH' ? '🔄 Hỗn hợp' : '🏠 Căn hộ con (Unit)'}
                  </span>
                ) : (
                  <select
                    value={floorScope}
                    onChange={(e) => {
                      setFloorScope(e.target.value as FloorScope);
                      setIsFloorDirty(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
                  >
                    <option value="UNIT">🏠 Căn hộ con (Unit)</option>
                    <option value="MASTER">🏢 Toà mẹ / Dùng chung (Master)</option>
                    <option value="BOTH">🔄 Hỗn hợp (Master + Unit)</option>
                  </select>
                )}
              </div>

              {/* Dải tầng dùng chung */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setIsTypicalModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Chọn các tầng có cùng mặt bằng để nhân bản tự động"
                >
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Dải tầng dùng chung ({applicableFloors.length} tầng)</span>
                </button>
              )}
            </div>

            {/* Các hành động trên tầng: Xóa CAD & XÓA TẦNG */}
            {!readOnly && (
              <div className="flex items-center gap-2">
                {hasSurveyedUnits && (
                  <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shadow-2xs">
                    <span>⚠️</span>
                    <span>{surveyedUnitsOnActiveFloor.length} căn đã khảo sát</span>
                  </span>
                )}

                {cadUrl && (
                  <button
                    type="button"
                    onClick={handleClearCadOnly}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title="Xóa bản vẽ CAD để tải lại hoặc chia lại căn hộ (Bảo toàn 100% hồ sơ khảo sát)"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Xóa bản vẽ CAD</span>
                  </button>
                )}

                {/* Nút XÓA TẦNG KHỎI TÒA NHÀ (Tính năng mới theo yêu cầu) */}
                <button
                  type="button"
                  onClick={handleDeleteEntireFloor}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    hasSurveyedUnits
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                  title={
                    hasSurveyedUnits
                      ? 'Không thể xóa tầng vì đang có căn hộ đã khảo sát mang tính pháp lý'
                      : 'Xóa hoàn toàn tầng này khỏi tòa nhà (Không làm dồn số các tầng khác)'
                  }
                >
                  <Trash2 className={`w-3.5 h-3.5 ${hasSurveyedUnits ? 'text-slate-400' : 'text-rose-600'}`} />
                  <span>Xóa tầng này</span>
                </button>
              </div>
            )}
          </div>

          {/* Thông báo thừa hưởng nếu tầng này đang dùng chung mặt bằng */}
          {currentFloorItem?.isInherited && (
            <div className="px-4 py-1.5 bg-teal-50 border-b border-teal-200 text-xs text-teal-800 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-teal-600" />
                Tầng {activeFloor} đang dùng chung mặt bằng và phân chia từ{' '}
                <strong className="text-teal-950 font-bold">Tầng {currentFloorItem.inheritedFromFloor}</strong>.
              </span>
              <button
                type="button"
                onClick={() => handleSelectFloor(currentFloorItem.inheritedFromFloor!)}
                className="text-xs text-teal-700 hover:text-teal-900 underline font-bold cursor-pointer"
              >
                Chuyển sang Tầng {currentFloorItem.inheritedFromFloor} để sửa gốc
              </button>
            </div>
          )}

          {/* Banner Lưu thành công với pháo hoa & tự động ẩn */}
          {saveSuccessMsg && (
            <div className="mx-4 mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shrink-0 animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="truncate">{saveSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessMsg('')}
                className="text-emerald-600 hover:text-emerald-900 p-1 rounded-md hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
                title="Đóng thông báo"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Không gian hiển thị Canvas hoặc Uploader */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {!cadUrl ? (
              /* CHƯA CÓ CAD: Hiển thị bộ tải bản vẽ chuyên dụng */
              <CadBlueprintUploader
                floorNumber={activeFloor}
                floorName={floorName}
                floorCode={floorCode}
                buildingCode={projectCode}
                onUploadSuccess={(url) => {
                  setCadUrl(url);
                  setIsFloorDirty(true);
                  triggerSuccessFeedback(`Đã tải lên bản vẽ CAD cho ${floorName}! Hãy vẽ phân chia các vị trí.`);
                }}
                onCopyFromOtherFloor={handleCopyCadFromFloor}
                otherFloorsWithCad={otherFloorsWithCad}
                readOnly={readOnly}
              />
            ) : (
              /* ĐÃ CÓ CAD: Hiển thị Interactive Partition Canvas */
              <FloorPlanCadPartitionCanvas
                key={`canvas_fl_${activeFloor}_${cadUrl ? encodeURIComponent(cadUrl).slice(-16) : 'none'}`}
                cadPhotoUrl={cadUrl}
                floorNumber={activeFloor}
                floorCode={floorCode}
                projectParcelCode={projectCode}
                initialPartitions={partitions}
                onChangePartitions={(newParts) => {
                  setPartitions(newParts);
                  setIsFloorDirty(true);
                  // Cập nhật scope tự động nếu cần
                  const hasUnit = newParts.some((p) => (p.partitionType || 'UNIT') === 'UNIT');
                  const hasMaster = newParts.some((p) => p.partitionType === 'MASTER');
                  if (hasUnit && hasMaster) setFloorScope('BOTH');
                  else if (hasMaster) setFloorScope('MASTER');
                  else if (hasUnit) setFloorScope('UNIT');
                }}
                onValidationChange={setIsPartitionsValid}
                readOnly={readOnly}
                allBuildingUnits={allUnits}
              />
            )}
          </div>
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. Modal xác nhận Unsaved Changes Guard */}
      {/* ========================================================= */}
      {showUnsavedConfirmModal && (
        <div className="fixed inset-0 z-[100005] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-md w-full flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bạn có thay đổi chưa lưu trên Tầng {activeFloor}!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các ô phân chia hoặc thông tin mặt bằng vừa vẽ chưa được lưu vào hệ thống.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelSwitch}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Ở lại tầng này
              </button>
              <button
                type="button"
                onClick={handleDiscardAndProceed}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Bỏ qua thay đổi
              </button>
              <button
                type="button"
                onClick={handleSaveAndProceed}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu & Chuyển</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chọn dải tầng điển hình */}
      {isTypicalModalOpen && (
        <TypicalFloorsSelectorModal
          isOpen={isTypicalModalOpen}
          baseFloorNumber={activeFloor}
          baseFloorName={floorName}
          allBuildingFloors={buildingFloors.map((f) => ({
            floorNumber: f.floorNumber,
            floorName: f.floorName,
            hasOwnCad: f.hasCad && !f.isInherited,
          }))}
          currentApplicableFloors={applicableFloors}
          onConfirm={(selected) => {
            setApplicableFloors(selected);
            setIsFloorDirty(true);
          }}
          onClose={() => setIsTypicalModalOpen(false)}
        />
      )}
    </div>
  );
};
