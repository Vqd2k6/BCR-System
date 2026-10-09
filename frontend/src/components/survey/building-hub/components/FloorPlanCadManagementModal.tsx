import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Link as LinkIcon,
  RefreshCw,
  Loader2,
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

interface FloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string;
  cad_photo_url: string;
  applicable_floors?: number[];
}

interface CadUnitItem {
  id: string;
  unit_code: string;
  floor_number?: number;
  cad_bbox?: { x: number; y: number; width: number; height: number };
  cad_polygon?: { x: number; y: number }[];
  unit_cad_url?: string;
}

interface BuildingFloorItem {
  floorNumber: number;
  floorName: string;
  hasCad: boolean;
  cadPhotoUrl?: string;
  applicableFloors?: number[];
  unitCount: number;
  isInherited: boolean;
  inheritedFromFloor?: number;
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

  // Danh sách tầng tùy chỉnh bổ sung bởi người dùng (nếu có tầng hầm hoặc tầng phát sinh)
  const [customFloors, setCustomFloors] = useState<number[]>([]);
  const [newFloorInput, setNewFloorInput] = useState<string>('');
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
  const [cadUrl, setCadUrl] = useState<string>('');
  const [applicableFloors, setApplicableFloors] = useState<number[]>([1]);
  const [partitions, setPartitions] = useState<UnitPartitionBox[]>([]);
  const [isPartitionsValid, setIsPartitionsValid] = useState<boolean>(true);
  const [isTypicalModalOpen, setIsTypicalModalOpen] = useState<boolean>(false);

  // 1. Tải toàn bộ Floor Plans & Units của thửa đất
  const fetchAllFloorData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [plansRes, unitsRes] = await Promise.all([
        api.get(`/parcels/${parcelId}/floor-plans`).catch((err) => {
          console.warn('[FloorPlanCadModal:getFloorPlans] Lỗi nạp floor plans:', err);
          return { data: { data: { plans: [] } } };
        }),
        api.get(`/parcels/${parcelId}/units`).catch((err) => {
          console.warn('[FloorPlanCadModal:getUnits] Lỗi nạp danh sách căn hộ:', err);
          return { data: { data: { units: [] } } };
        }),
      ]);

      const plans: FloorPlanItem[] = plansRes.data?.data?.plans || [];
      const units: CadUnitItem[] = unitsRes.data?.data?.units || [];

      setExistingFloorPlans(plans);
      setAllUnits(units);

      // Nếu đã có plans, tự động chọn tầng đầu tiên có CAD hoặc Tầng 1
      if (plans.length > 0) {
        const first = plans[0];
        setActiveFloor(first.floor_number);
        setCadUrl(first.cad_photo_url);
        setFloorName(first.floor_name);
        setApplicableFloors(first.applicable_floors || [first.floor_number]);
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

  // 2. Tính toán danh sách đầy đủ các tầng của tòa nhà
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

    // Sắp xếp tầng từ cao xuống thấp (Top to Bottom)
    const sortedFloors = Array.from(floorSet).sort((a, b) => b - a);

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

      return {
        floorNumber: flNum,
        floorName: effectivePlan?.floor_name || defaultName,
        hasCad: hasDirectCad || isInherited,
        cadPhotoUrl: effectivePlan?.cad_photo_url,
        applicableFloors: effectivePlan?.applicable_floors,
        unitCount,
        isInherited,
        inheritedFromFloor: isInherited ? sharedPlan?.floor_number : undefined,
      };
    });
  }, [initialFloorCount, existingFloorPlans, customFloors, allUnits]);

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
            setApplicableFloors(plan.applicable_floors || [floorNum]);
          } else {
            // Kiểm tra xem tầng này có đang thừa hưởng từ tầng điển hình nào không
            const sharedPlan = existingFloorPlans.find(
              (p) => p.applicable_floors && p.applicable_floors.includes(floorNum)
            );
            if (sharedPlan) {
              setCadUrl(sharedPlan.cad_photo_url || '');
              setFloorName(`Tầng ${floorNum} (Dùng chung ${sharedPlan.floor_name})`);
              setApplicableFloors(sharedPlan.applicable_floors || [sharedPlan.floor_number]);
            } else {
              setCadUrl('');
              setFloorName(`Tầng ${floorNum}`);
              setApplicableFloors([floorNum]);
            }
          }

          if (units && Array.isArray(units) && units.length > 0) {
            const boxes: UnitPartitionBox[] = (units as CadUnitItem[])
              .filter((u) => Boolean(u.cad_bbox))
              .map((u) => ({
                id: u.id,
                unitCode: u.unit_code,
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
      }
    },
    [parcelId, existingFloorPlans]
  );

  // Chuyển tầng
  const handleSelectFloor = (floorNum: number) => {
    setActiveFloor(floorNum);
    setSaveSuccessMsg('');
    loadActiveFloorDetails(floorNum);
  };

  // Thêm tầng mới vào danh sách
  const handleAddCustomFloor = () => {
    const parsed = parseInt(newFloorInput.trim(), 10);
    if (!isNaN(parsed) && !buildingFloors.some((f) => f.floorNumber === parsed)) {
      setCustomFloors((prev) => [...prev, parsed]);
      setActiveFloor(parsed);
      setNewFloorInput('');
      setShowAddFloorInput(false);
      loadActiveFloorDetails(parsed);
    }
  };

  // Kế thừa CAD từ tầng khác
  const handleCopyCadFromFloor = (sourceFloor: { floorNumber: number; floorName: string; cadPhotoUrl: string }) => {
    setCadUrl(sourceFloor.cadPhotoUrl);
    setFloorName(`Tầng ${activeFloor} (Theo ${sourceFloor.floorName})`);
    // Lấy partitions của tầng nguồn nếu có
    const sourceUnits = allUnits.filter((u) => (u.floor_number ?? 1) === sourceFloor.floorNumber);
    if (sourceUnits.length > 0) {
      const mm = String(activeFloor).padStart(2, '0');
      const copiedBoxes: UnitPartitionBox[] = sourceUnits
        .filter((u) => Boolean(u.cad_bbox))
        .map((u) => {
          const parts = u.unit_code.split('.');
          const nn = parts.length > 1 ? parts[1] : u.unit_code;
          return {
            id: `unit_box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            unitCode: `${mm}.${nn}`,
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
  };

  // 4. Lưu Floor Plan & Đồng bộ Partitions
  const handleSaveFloorPlanAndPartitions = async (newPartitions?: UnitPartitionBox[]) => {
    if (!cadUrl) {
      alert('Vui lòng tải lên bản vẽ CAD cho tầng này trước khi lưu!');
      return;
    }

    if (!isPartitionsValid) {
      alert('Vui lòng kiểm tra lại: Có ô căn hộ đang bị trùng lặp hoặc chưa đặt mã!');
      return;
    }

    const targetPartitions = newPartitions || partitions;
    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const targetApplicableFloors = applicableFloors.includes(activeFloor)
        ? applicableFloors
        : [...applicableFloors, activeFloor].sort((a, b) => a - b);

      // 1. Lưu bản vẽ Floor Plan
      const planRes = await api.post(`/parcels/${parcelId}/floor-plans`, {
        floorNumber: activeFloor,
        floorName: floorName || `Tầng ${activeFloor}`,
        applicableFloors: targetApplicableFloors,
        cadPhotoUrl: cadUrl,
      });

      const floorPlanId = planRes.data?.data?.plan?.id;

      // 2. Chuẩn bị partitions cho tầng gốc và tất cả các tầng điển hình
      const allFloorPartitions: {
        unitCode: string;
        floorNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        unitCadUrl?: string;
      }[] = [];

      for (const fl of targetApplicableFloors) {
        let mm = String(fl).padStart(2, '0');
        if (fl === 0) mm = 'G';
        if (fl < 0) mm = `B${Math.abs(fl)}`;

        for (const p of targetPartitions) {
          const parts = p.unitCode.split('.');
          const nn = parts.length > 1 ? parts[1] : p.unitCode;
          const uCode = `${mm}.${nn}`;

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
        `Đã lưu thành công bản vẽ CAD và đồng bộ ${allFloorPartitions.length} căn hộ cho các tầng [${targetApplicableFloors.join(
          ', '
        )}]!`
      );

      if (onUnitsUpdated) {
        onUnitsUpdated();
      }
      fetchAllFloorData();
    } catch (err: unknown) {
      console.error('[FloorPlanCadModal:handleSaveFloorPlanAndPartitions] Lỗi khi lưu phân chia mặt bằng:', err);
      alert(`Lỗi khi lưu phân chia mặt bằng: ${getErrorMessage(err, 'Lỗi kết nối')}`);
    } finally {
      setIsSaving(false);
    }
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
    <div className="fixed inset-0 z-[100001] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden text-slate-800">
        {/* ========================================================= */}
        {/* 1. Header Studio Bar (Light Theme) */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Quản Lý Bản Vẽ CAD & Phân Chia Mặt Bằng Chung Cư
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {projectCode}
                </span>
                {readOnly && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                    Khảo Sát Viên (Chỉ Đọc)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <span>Quy mô: <strong>{buildingFloors.length} tầng</strong></span>
                <span>•</span>
                <span>Tổng số căn hộ hiện có: <strong className="text-teal-700">{allUnits.length} căn</strong></span>
                <span>•</span>
                <span>
                  Địa chỉ: {[parcel.houseNumber, parcel.street].filter(Boolean).join(' ') || 'Đang cập nhật'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. Main Studio Body: 2-Column Split */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------- */}
          {/* CỘT TRÁI: Floor Navigation Sidebar (Quản lý các tầng) */}
          {/* ------------------------------------------------------- */}
          <div className="w-64 sm:w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                Danh Sách Tầng ({buildingFloors.length})
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowAddFloorInput(!showAddFloorInput)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm tầng</span>
                </button>
              )}
            </div>

            {/* Ô thêm tầng nhanh */}
            {showAddFloorInput && (
              <div className="p-2.5 bg-white border-b border-slate-200 flex items-center gap-2 animate-in slide-in-from-top-2">
                <input
                  type="number"
                  placeholder="Số tầng (VD: 9, -1)"
                  value={newFloorInput}
                  onChange={(e) => setNewFloorInput(e.target.value)}
                  className="flex-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomFloor}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Thêm
                </button>
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
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'border-teal-500 bg-teal-50 text-teal-950 shadow-sm ring-1 ring-teal-400/40'
                          : 'border-slate-200 bg-white hover:bg-slate-100/70 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-teal-900' : 'text-slate-800'}`}>
                          {fl.floorName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {fl.isInherited ? (
                            <span className="text-[10px] text-teal-700 flex items-center gap-0.5 font-medium">
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
                        {fl.unitCount > 0 ? (
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              isActive
                                ? 'bg-teal-700 text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {fl.unitCount} căn
                          </span>
                        ) : null}
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
          </div>

          {/* ------------------------------------------------------- */}
          {/* CỘT PHẢI: Main CAD Workspace cho Active Floor */}
          {/* ------------------------------------------------------- */}
          <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
            {/* Sub-header Bar: Thông tin tầng, tên mặt bằng & Dải tầng áp dụng */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-3">
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
                      onChange={(e) => setFloorName(e.target.value)}
                      placeholder={`Tầng ${activeFloor}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-teal-800 focus:outline-none focus:border-teal-600 w-44 sm:w-56"
                    />
                  )}
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsTypicalModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title="Chọn các tầng có cùng mặt bằng để nhân bản tự động"
                  >
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    <span>Dải tầng dùng chung ({applicableFloors.length} tầng)</span>
                  </button>
                )}
              </div>

              {/* Nút hành động bản vẽ */}
              {!readOnly && cadUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Bạn có chắc muốn đổi file ảnh/PDF bản vẽ CAD khác cho tầng này?')) {
                        setCadUrl('');
                      }
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Đổi file CAD khác
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Bạn có chắc muốn xóa bản vẽ CAD và các ô phân chia của tầng này?')) {
                        setCadUrl('');
                        setPartitions([]);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Xóa CAD tầng này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Thông báo kế thừa nếu tầng này đang là Follower */}
            {currentFloorItem?.isInherited && (
              <div className="px-5 py-2 bg-teal-50 border-b border-teal-200 text-xs text-teal-800 flex items-center justify-between shrink-0">
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
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in shrink-0">
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
                  onUploadSuccess={(url) => setCadUrl(url)}
                  onCopyFromOtherFloor={handleCopyCadFromFloor}
                  otherFloorsWithCad={otherFloorsWithCad}
                  readOnly={readOnly}
                />
              ) : (
                /* ĐÃ CÓ CAD: Hiển thị Interactive Partition Canvas */
                <FloorPlanCadPartitionCanvas
                  cadPhotoUrl={cadUrl}
                  floorNumber={activeFloor}
                  initialPartitions={partitions}
                  onChangePartitions={setPartitions}
                  onValidationChange={setIsPartitionsValid}
                  readOnly={readOnly}
                />
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. Footer Actions Studio (Light Theme) */}
        {/* ========================================================= */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-600 flex items-center gap-2">
            <span>Tầng {activeFloor}: <strong className="text-teal-700 font-mono">{partitions.length} căn</strong></span>
            <span>•</span>
            <span>
              Áp dụng cho dải tầng [{applicableFloors.join(', ')}] $\rightarrow${' '}
              <strong className="text-slate-900 font-mono">{partitions.length * applicableFloors.length} căn hộ con</strong>
            </span>
            {!isPartitionsValid && (
              <span className="ml-2 px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Mã căn bị trùng hoặc trống
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {!readOnly && (
              <button
                type="button"
                disabled={isSaving || !cadUrl || !isPartitionsValid}
                onClick={() => handleSaveFloorPlanAndPartitions()}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                title={!isPartitionsValid ? 'Vui lòng sửa các mã căn bị trùng lặp hoặc để trống trước khi lưu' : undefined}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu & đồng bộ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lưu & Đồng Bộ Toàn Bộ Căn Hộ</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

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
          onConfirm={(selected) => setApplicableFloors(selected)}
          onClose={() => setIsTypicalModalOpen(false)}
        />
      )}
    </div>
  );
};
