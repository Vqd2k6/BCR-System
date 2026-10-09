import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Upload,
  Square,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Plus,
  Trash2,
  Eye,
  FileCheck,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import { PhotoCaptureInput } from '../../../common/PhotoCaptureInput';
import {
  FloorPlanCadPartitionCanvas,
  type UnitPartitionBox,
} from '../../../canvas/FloorPlanCadPartitionCanvas';
import { api } from '../../../../services/api';

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
  cad_bbox?: { x: number; y: number; width: number; height: number };
  cad_polygon?: { x: number; y: number }[];
  unit_cad_url?: string;
}

interface Props {
  parcel: GisParcel;
  onClose: () => void;
  onUnitsUpdated?: () => void;
}

export const FloorPlanCadManagementModal: React.FC<Props> = ({
  parcel,
  onClose,
  onUnitsUpdated,
}) => {
  const parcelId = parcel.id;
  const projectCode = parcel.projectParcelCode || parcel.project_parcel_code || 'B-XXXXX';

  const [activeFloor, setActiveFloor] = useState<number>(3);
  const [floorName, setFloorName] = useState<string>('Tầng 3');
  const [cadUrl, setCadUrl] = useState<string>('');
  const [applicableFloorsStr, setApplicableFloorsStr] = useState<string>('3, 4, 5, 6, 7, 8');
  const [partitions, setPartitions] = useState<UnitPartitionBox[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [existingFloorPlans, setExistingFloorPlans] = useState<FloorPlanItem[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Tải danh sách floor plans hiện có
  const loadFloorPlans = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/parcels/${parcelId}/floor-plans`);
      if (res.data?.success && res.data.data?.plans) {
        setExistingFloorPlans(res.data.data.plans);
        // Nếu đã có plan cho activeFloor, nạp vào state
        const current = res.data.data.plans.find((p: FloorPlanItem) => p.floor_number === activeFloor);
        if (current) {
          setCadUrl(current.cad_photo_url);
          setFloorName(current.floor_name);
          if (current.applicable_floors) {
            setApplicableFloorsStr(current.applicable_floors.join(', '));
          }
        }
      }
    } catch (_err) {
      console.warn('Chưa có floor plans hoặc lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  // Tải danh sách partitions của activeFloor
  const loadFloorDetails = async (floor: number) => {
    try {
      const res = await api.get(`/parcels/${parcelId}/floor-plans/${floor}`);
      if (res.data?.success) {
        const { plan, units } = res.data.data;
        if (plan) {
          setCadUrl(plan.cad_photo_url);
          setFloorName(plan.floor_name);
          if (plan.applicable_floors) {
            setApplicableFloorsStr(plan.applicable_floors.join(', '));
          }
        }
        if (units && units.length > 0) {
          const boxes: UnitPartitionBox[] = (units as CadUnitItem[])
            .filter((u: CadUnitItem) => Boolean(u.cad_bbox))
            .map((u: CadUnitItem) => ({
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
    } catch (_err) {
      console.warn('Lỗi tải chi tiết tầng');
    }
  };

  useEffect(() => {
    loadFloorPlans();
  }, [parcelId]);

  useEffect(() => {
    loadFloorDetails(activeFloor);
  }, [activeFloor]);

  // Xử lý lưu mặt bằng CAD và phân chia căn hộ
  const handleSaveFloorPlanAndPartitions = async (newPartitions?: UnitPartitionBox[]) => {
    if (!cadUrl) {
      alert('Vui lòng upload ảnh bản vẽ CAD mặt bằng tầng trước khi lưu!');
      return;
    }

    const targetPartitions = newPartitions || partitions;

    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      // 1. Parse danh sách tầng áp dụng
      const applicableFloors = applicableFloorsStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (!applicableFloors.includes(activeFloor)) {
        applicableFloors.push(activeFloor);
      }

      // 2. Lưu floor plan
      const planRes = await api.post(`/parcels/${parcelId}/floor-plans`, {
        floorNumber: activeFloor,
        floorName: floorName || `Tầng ${activeFloor}`,
        applicableFloors,
        cadPhotoUrl: cadUrl,
      });

      const floorPlanId = planRes.data?.data?.plan?.id;

      // 3. Chuẩn bị partitions cho tầng hiện tại và các tầng điển hình nếu áp dụng
      const allFloorPartitions: {
        unitCode: string;
        floorNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        unitCadUrl?: string;
      }[] = [];

      for (const fl of applicableFloors) {
        const mm = String(fl).padStart(2, '0');
        for (const p of targetPartitions) {
          // Trích xuất số phòng nn từ mã căn (VD: 03.05 -> nn = 05)
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

      // 4. Lưu partitions
      await api.post(`/parcels/${parcelId}/floor-plans/partitions`, {
        floorNumber: activeFloor,
        floorPlanId,
        partitions: allFloorPartitions,
      });

      setSaveSuccessMsg(
        `Đã lưu thành công bản vẽ CAD và tự động sinh ${allFloorPartitions.length} căn hộ cho các tầng [${applicableFloors.join(', ')}]!`
      );

      if (onUnitsUpdated) {
        onUnitsUpdated();
      }
      loadFloorPlans();
    } catch (err: unknown) {
      alert(`Lỗi khi lưu phân chia mặt bằng: ${getErrorMessage(err, 'Lỗi mạng')}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100001] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden text-white">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Quản Lý Mặt Bằng Tầng CAD & Chia Cắt Căn Hộ
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-700">
                  {projectCode}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Upload bản vẽ CAD mặt bằng tầng và kéo thả chia cắt các ô căn hộ để tự động import khi khảo sát căn con
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Controls Bar: Chọn tầng, Tên mặt bằng, Dải tầng áp dụng */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-850 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tầng đang thao tác:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={activeFloor}
                  onChange={(e) => setActiveFloor(parseInt(e.target.value, 10) || 1)}
                  className="w-20 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-teal-400 focus:outline-none focus:border-teal-500"
                />
                <span className="text-xs text-slate-400">
                  {existingFloorPlans.some((p) => p.floor_number === activeFloor) ? (
                    <span className="text-emerald-400 font-bold">✓ Đã có CAD</span>
                  ) : (
                    <span className="text-amber-400">Chưa có CAD</span>
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tên mặt bằng / Mô tả:
              </label>
              <input
                type="text"
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="VD: Tầng điển hình 3-8"
                className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Áp dụng dải tầng điển hình:
              </label>
              <input
                type="text"
                value={applicableFloorsStr}
                onChange={(e) => setApplicableFloorsStr(e.target.value)}
                placeholder="VD: 3, 4, 5, 6, 7, 8"
                className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={isSaving || !cadUrl}
                onClick={() => handleSaveFloorPlanAndPartitions()}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition-all active:scale-95"
              >
                {isSaving ? (
                  <span>Đang xử lý & crop ảnh...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Lưu & Đồng Bộ Căn Hộ
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Upload ảnh CAD nếu chưa có */}
          {!cadUrl ? (
            <div className="bg-slate-850 p-6 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Chưa Có Bản Vẽ CAD Mặt Bằng Tầng {activeFloor}</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Vui lòng tải lên ảnh bản vẽ CAD mặt bằng kiến trúc toàn tầng (PNG/JPG/SVG) do Ban Quản Lý tòa nhà hoặc hồ sơ thiết kế cung cấp.
                </p>
              </div>
              <div className="w-full max-w-sm">
                <PhotoCaptureInput
                  value=""
                  onChange={(url) => setCadUrl(url)}
                  label={`Tải lên bản vẽ CAD Tầng ${activeFloor}`}
                  allowPdf={true}
                />
              </div>
            </div>
          ) : (
            /* Interactive Canvas Slicer */
            <div className="flex-1 flex flex-col min-h-[500px] h-[65vh]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 text-teal-400" />
                  Kéo thả chuột trên bản vẽ để tạo ô căn hộ mới theo quy ước <code className="text-teal-300 font-mono">mm.nn</code>.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Bạn có chắc muốn đổi file ảnh bản vẽ CAD khác?')) {
                        setCadUrl('');
                      }
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Đổi file CAD khác
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <FloorPlanCadPartitionCanvas
                  cadPhotoUrl={cadUrl}
                  floorNumber={activeFloor}
                  initialPartitions={partitions}
                  onChangePartitions={setPartitions}
                  onSave={handleSaveFloorPlanAndPartitions}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
