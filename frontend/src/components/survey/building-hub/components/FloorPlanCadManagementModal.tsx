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
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export type FloorScope = 'MASTER' | 'UNIT' | 'BOTH';

export const detectDefaultFloorScope = (
  floorNum: number,
  name: string
): { scope: FloorScope; areaType: string } => {
  const lower = name.toLowerCase();
  if (floorNum < 0 || lower.includes('hầm') || lower.includes('basement')) {
    return { scope: 'MASTER', areaType: 'BASEMENT' };
  }
  if (lower.includes('mái') || lower.includes('thượng') || lower.includes('rooftop')) {
    return { scope: 'MASTER', areaType: 'ROOFTOP' };
  }
  if (lower.includes('kỹ thuật') || lower.includes('lánh nạn') || lower.includes('refuge')) {
    return { scope: 'MASTER', areaType: 'TECHNICAL_REFUGE' };
  }
  if (floorNum === 0 || lower.includes('trệt') || lower.includes('sảnh') || lower.includes('lobby')) {
    return { scope: 'BOTH', areaType: 'GROUND_LOBBY' };
  }
  return { scope: 'UNIT', areaType: 'TYPICAL_UNIT' };
};

export const STANDARD_FLOOR_CODE_OPTIONS = [
  { code: 'TYPICAL', label: 'Tầng nổi tiêu chuẩn (F01..F99)', defaultScope: 'BOTH' as FloorScope, defaultArea: 'TYPICAL_UNIT' },
  { code: 'G', label: 'Trệt / Sảnh (G)', defaultScope: 'BOTH' as FloorScope, defaultArea: 'GROUND_LOBBY' },
  { code: 'MEZZ', label: 'Tầng Lửng Trệt (MEZZ)', defaultScope: 'BOTH' as FloorScope, defaultArea: 'MEZZANINE' },
  { code: 'B01', label: 'Tầng Hầm 1 (B01)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'BASEMENT' },
  { code: 'B02', label: 'Tầng Hầm 2 (B02)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'BASEMENT' },
  { code: 'SB', label: 'Tầng Bán Hầm (SB)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'SEMI_BASEMENT' },
  { code: 'TECH', label: 'Tầng Kỹ Thuật (TECH)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'TECHNICAL' },
  { code: 'REF', label: 'Tầng Lánh Nạn (REF)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'REFUGE' },
  { code: 'TUM', label: 'Tầng Tum (TUM)', defaultScope: 'BOTH' as FloorScope, defaultArea: 'TUM' },
  { code: 'TERRACE', label: 'Sân Thượng (TERRACE)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'ROOFTOP' },
  { code: 'ROOF', label: 'Tầng Mái (ROOF)', defaultScope: 'MASTER' as FloorScope, defaultArea: 'ROOFTOP' },
];

export const getDefaultFloorCode = (floorNum: number, floorName?: string): string => {
  const lower = (floorName || '').toLowerCase();
  if (lower.includes('lửng') || lower.includes('mezzanine')) return 'MEZZ';
  if (lower.includes('bán hầm')) return 'SB';
  if (lower.includes('kỹ thuật')) return 'TECH';
  if (lower.includes('lánh nạn')) return 'REF';
  if (lower.includes('tum')) return 'TUM';
  if (lower.includes('sân thượng')) return 'TERRACE';
  if (lower.includes('mái') || lower.includes('roof')) return 'ROOF';
  if (floorNum === 0 || lower.includes('trệt')) return 'G';
  if (floorNum < 0) return `B${String(Math.abs(floorNum)).padStart(2, '0')}`;
  return `F${String(floorNum).padStart(2, '0')}`;
};

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

interface BuildingFloorItem {
  floorNumber: number;
  floorName: string;
  floorCode: string;
  hasCad: boolean;
  cadPhotoUrl?: string;
  applicableFloors?: number[];
  unitCount: number;
  isInherited: boolean;
  inheritedFromFloor?: number;
  scope: FloorScope;
  areaType?: string;
}

interface Props {
  parcel: GisParcel;
  onClose: () => void;
  onUnitsUpdated?: () => void;
  readOnly?: boolean;
}

export const FloorPlanCadManagementModal: React.FC<Props> = ({
  parcel,
  onClose,
  onUnitsUpdated,
  readOnly = false,
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

  // Tầng đang được chọn thao tác
  const [activeFloor, setActiveFloor] = useState<number>(1);
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

      // Nếu đã có plans, tự động chọn tầng đầu tiên có CAD hoặc Tầng 1
      if (plans.length > 0) {
        const first = plans[0];
        setActiveFloor(first.floor_number);
        setCadUrl(first.cad_photo_url);
        setFloorName(first.floor_name);
        setApplicableFloors(first.applicable_floors || [first.floor_number]);
        const detected = detectDefaultFloorScope(first.floor_number, first.floor_name);
        setFloorScope(first.scope || detected.scope);
      }
    } catch (err) {
      console.warn('[FloorPlanCad] Lỗi nạp dữ liệu tòa nhà:', err);
    } finally {
      setIsLoading(false);
    }
  }, [parcelId]);

  useEffect(() => {
    fetchAllFloorData();
  }, [fetchAllFloorData]);

  // 2. Tính toán danh sách đầy đủ các tầng của tòa nhà (Fix bug: Tên tầng không bị gán đè chuỗi parent)
  const buildingFloors = useMemo<BuildingFloorItem[]>(() => {
    const floorSet = new Set<number>();

    // Sinh các tầng từ 1 đến initialFloorCount
    for (let i = 1; i <= Math.max(1, initialFloorCount); i++) {
      floorSet.add(i);
    }

    // Bổ sung các tầng từ existingFloorPlans
    for (const p of existingFloorPlans) {
      floorSet.add(p.floor_number);
      if (p.applicable_floors) {
        p.applicable_floors.forEach((f) => floorSet.add(f));
      }
    }

    // Bổ sung các tầng tùy chỉnh
    customFloors.forEach((f) => floorSet.add(f));

    // Sắp xếp tầng từ cao xuống thấp (Top to Bottom) và loại trừ các tầng đã bị xóa
    const sortedFloors = Array.from(floorSet)
      .filter((f) => !deletedFloorNumbers.includes(f))
      .sort((a, b) => b - a);

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
  }, [initialFloorCount, existingFloorPlans, customFloors, allUnits, activeFloor, partitions, floorScope, deletedFloorNumbers]);

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
            setFloorCode(plan.floor_code || getDefaultFloorCode(floorNum, plan.floor_name || `Tầng ${floorNum}`));
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
              setFloorCode(sharedPlan.floor_code || getDefaultFloorCode(floorNum, defName));
              setApplicableFloors(sharedPlan.applicable_floors || [sharedPlan.floor_number]);
              const detected = detectDefaultFloorScope(floorNum, defName);
              setFloorScope(sharedPlan.scope || detected.scope);
            } else {
              setCadUrl('');
              const defName = floorNum === 0 ? 'Tầng Trệt / G' : floorNum < 0 ? `Hầm B${Math.abs(floorNum)}` : `Tầng ${floorNum}`;
              setFloorName(defName);
              setFloorCode(getDefaultFloorCode(floorNum, defName));
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
            setPartitions([]);
          }
        }
      } catch (err) {
        console.warn(`[FloorPlanCad] Lỗi tải chi tiết Tầng ${floorNum}:`, err);
      } finally {
        setIsFloorDirty(false);
      }
    },
    [parcelId, existingFloorPlans]
  );

  // Chuyển tầng có bảo vệ dữ liệu chưa lưu
  const executeFloorSwitch = (floorNum: number) => {
    if (!buildingFloors.some((f) => f.floorNumber === floorNum)) {
      setCustomFloors((prev) => (prev.includes(floorNum) ? prev : [...prev, floorNum]));
      setNewFloorInput('');
      setShowAddFloorInput(false);
    }
    setActiveFloor(floorNum);
    setIsFloorDirty(false);
    setSaveSuccessMsg('');
    loadActiveFloorDetails(floorNum);
  };

  const handleSelectFloor = (floorNum: number) => {
    if (floorNum === activeFloor) return;
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
        setNewFloorInput('');
        setNewFloorCodeInput('');
        setShowAddFloorInput(false);
        loadActiveFloorDetails(parsed);
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
      const mm = floorCode.trim() || String(activeFloor).padStart(2, '0');
      const copiedBoxes: UnitPartitionBox[] = sourceUnits
        .filter((u) => Boolean(u.cad_bbox))
        .map((u) => {
          const parts = u.unit_code.split('.');
          const nn = parts.length > 1 ? parts[1] : u.unit_code;
          const isMaster = (u.unit_type || 'UNIT') === 'MASTER';
          const prefix = isMaster ? (mm.startsWith('T') ? mm : `T${mm.replace(/^F/i, '')}`) : mm.replace(/^F/i, '');
          return {
            id: `unit_box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            unitCode: `${prefix}.${nn}`,
            partitionType: u.unit_type || 'UNIT',
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

      // 1. Lưu bản vẽ Floor Plan
      const planRes = await api.post(`/parcels/${parcelId}/floor-plans`, {
        floorNumber: activeFloor,
        floorName: floorName || `Tầng ${activeFloor}`,
        floorCode: floorCode.trim() || getDefaultFloorCode(activeFloor, floorName),
        applicableFloors: targetApplicableFloors,
        cadPhotoUrl: cadUrl,
        scope: calculatedScope,
      });

      const floorPlanId = planRes.data?.data?.plan?.id;

      // 2. Chuẩn bị partitions cho tầng gốc và tất cả các tầng điển hình
      const allFloorPartitions: {
        unitCode: string;
        floorNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        unitCadUrl?: string;
        unitType: 'UNIT' | 'MASTER';
      }[] = [];

      for (const fl of targetApplicableFloors) {
        const targetFloorItem = buildingFloors.find((b) => b.floorNumber === fl);
        const mm = fl === activeFloor
          ? (floorCode.trim() || getDefaultFloorCode(fl, floorName))
          : (targetFloorItem?.floorCode || getDefaultFloorCode(fl));

        for (const p of targetPartitions) {
          const parts = p.unitCode.split('.');
          const nn = parts.length > 1 ? parts[1] : p.unitCode;
          const isMaster = (p.partitionType || 'UNIT') === 'MASTER';
          const prefix = isMaster ? (mm.startsWith('T') ? mm : `T${mm.replace(/^F/i, '')}`) : mm.replace(/^F/i, '');
          const uCode = `${prefix}.${nn}`;

          allFloorPartitions.push({
            unitCode: uCode,
            floorNumber: fl,
            bbox: {
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
            },
            unitCadUrl: p.unitCadUrl,
            unitType: p.partitionType || 'UNIT',
          });
        }
      }

      // 3. Lưu partitions vào CSDL
      await api.post(`/parcels/${parcelId}/floor-plans/partitions`, {
        floorNumber: activeFloor,
        floorPlanId,
        partitions: allFloorPartitions,
      });

      setSaveSuccessMsg(
        `Đã lưu thành công bản vẽ CAD và phân chia ${allFloorPartitions.length} vị trí cho dải tầng [${targetApplicableFloors.join(
          ', '
        )}]!`
      );
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
      setSaveSuccessMsg(res.data?.data?.message || `Đã xóa bản vẽ CAD của Tầng ${floorTarget}!`);

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
      setSaveSuccessMsg(res.data?.data?.message || `Đã xóa thành công Tầng ${floorToDelete} khỏi tòa nhà!`);

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
                  <span>Lưu Tầng {activeFloor}</span>
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
          <aside className="w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden z-20">
            {/* Sidebar Header */}
            <div className="p-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50/70">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                Danh Sách Tầng ({buildingFloors.length})
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowAddFloorInput(!showAddFloorInput)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Thêm tầng mới"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm</span>
                </button>
              )}
            </div>

            {/* Ô thêm tầng nhanh kèm Mã Tầng */}
            {showAddFloorInput && (
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Số tầng (VD: 9, 0, -1)"
                    value={newFloorInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewFloorInput(val);
                      if (val.trim() !== '') {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          setNewFloorCodeInput(getDefaultFloorCode(parsed));
                        }
                      }
                    }}
                    className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                  />
                  <input
                    type="text"
                    placeholder="Mã tầng (VD: MEZZ)"
                    value={newFloorCodeInput}
                    onChange={(e) => setNewFloorCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-teal-800 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <select
                    value={
                      STANDARD_FLOOR_CODE_OPTIONS.some((o) => o.code === newFloorCodeInput)
                        ? newFloorCodeInput
                        : /^F\d+$/i.test(newFloorCodeInput)
                        ? 'TYPICAL'
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        if (e.target.value === 'TYPICAL') {
                          const parsed = parseFloat(newFloorInput);
                          const fl = !isNaN(parsed) && parsed > 0 ? parsed : 1;
                          setNewFloorCodeInput(`F${String(fl).padStart(2, '0')}`);
                        } else {
                          setNewFloorCodeInput(e.target.value);
                        }
                      }
                    }}
                    className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 cursor-pointer max-w-[125px]"
                  >
                    <option value="">Gợi ý mẫu...</option>
                    {STANDARD_FLOOR_CODE_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowAddFloorInput(false)}
                      className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomFloor}
                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Danh sách các tầng */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  <span>Đang nạp cấu trúc tòa nhà...</span>
                </div>
              ) : (
                buildingFloors.map((fl) => {
                  const isActive = fl.floorNumber === activeFloor;
                  return (
                    <div
                      key={fl.floorNumber}
                      onClick={() => handleSelectFloor(fl.floorNumber)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'border-teal-500 bg-teal-50/80 text-teal-950 shadow-xs ring-1 ring-teal-400/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-bold truncate ${isActive ? 'text-teal-950' : 'text-slate-800'}`}>
                            {fl.floorName}
                          </span>
                          {/* Mã tầng quy chuẩn */}
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-teal-900 border border-slate-200">
                            {fl.floorCode}
                          </span>
                          {/* Scope badge tự động cập nhật theo bản vẽ */}
                          {fl.scope === 'MASTER' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Master
                            </span>
                          )}
                          {fl.scope === 'UNIT' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                              Unit
                            </span>
                          )}
                          {fl.scope === 'BOTH' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Hỗn hợp
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {fl.isInherited ? (
                            <span className="text-[10px] text-teal-700 flex items-center gap-0.5 font-medium truncate">
                              <LinkIcon className="w-2.5 h-2.5" /> Dùng chung T{fl.inheritedFromFloor}
                            </span>
                          ) : fl.hasCad ? (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              ✓ Có CAD riêng
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Chưa có CAD
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {fl.unitCount > 0 && (
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              isActive
                                ? 'bg-teal-700 text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {fl.unitCount}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isActive ? 'text-teal-700 translate-x-0.5' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
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

          {/* Banner Lưu thành công */}
          {saveSuccessMsg && (
            <div className="mx-4 mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 shrink-0 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
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
                }}
                onCopyFromOtherFloor={handleCopyCadFromFloor}
                otherFloorsWithCad={otherFloorsWithCad}
                readOnly={readOnly}
              />
            ) : (
              /* ĐÃ CÓ CAD: Hiển thị Interactive Partition Canvas */
              <FloorPlanCadPartitionCanvas
                cadPhotoUrl={cadUrl}
                floorNumber={activeFloor}
                floorCode={floorCode}
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
