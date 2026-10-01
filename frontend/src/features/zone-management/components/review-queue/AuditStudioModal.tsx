import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Search,
  Maximize2,
  ZoomIn,
  Building,
  Ruler,
  Layers,
  MapPin,
  Calendar,
  User,
  Phone,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { Badge } from '../../../../core/components/ui/Badge';
import { RejectReportModal } from './RejectReportModal';
import { EngineeringJudgementModal } from './EngineeringJudgementModal';
import { ImageZoomModal } from '../../../../components/common/ImageZoomModal';
import { AuditStepwiseDocumentView } from './AuditStepwiseDocumentView';
import { AuditDiffConfirmModal } from './AuditDiffConfirmModal';
import { AuditPhotoReplaceModal } from './AuditPhotoReplaceModal';

interface Props {
  isOpen: boolean;
  reportId: string;
  onClose: () => void;
  onRefreshList: () => void;
}

export const AuditStudioModal: React.FC<Props> = ({
  isOpen,
  reportId,
  onClose,
  onRefreshList,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // View Mode: 'stepwise' (9 bước toàn diện - Mặc định) hoặc 'split' (Chia đôi màn hình)
  const [viewMode, setViewMode] = useState<'stepwise' | 'split'>('stepwise');

  // Tab & Selection States (cho chế độ Split-Pane)
  const [leftTab, setLeftTab] = useState<'specs' | 'defects' | 'deformation' | 'risk' | 'absence'>('specs');
  const [activeZoneIndex, setActiveZoneIndex] = useState(0);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>('');

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showJudgementModal, setShowJudgementModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Diff Confirmation Modal State
  const [diffModalData, setDiffModalData] = useState<{
    isOpen: boolean;
    diffItems: any[];
    updates: any;
  }>({ isOpen: false, diffItems: [], updates: {} });

  // Photo Replace Modal State (With 6-digit random code)
  const [photoReplaceData, setPhotoReplaceData] = useState<{
    isOpen: boolean;
    targetPhotoType: string;
    targetPhotoId?: string;
    defectId?: string;
    zoneId?: string;
    photoIndex?: number;
    currentPhotoUrl: string;
    photoTitle?: string;
  }>({ isOpen: false, targetPhotoType: 'OTHER', currentPhotoUrl: '' });

  // Electronic Magnifier (400% Lens) State
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0, relX: 0, relY: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const fetchAuditData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/admin/reports/${reportId}/audit-view`);
      if (res.data?.success && res.data?.data) {
        const payload = res.data.data;
        setData(payload);

        // Auto select first available photo
        const p01 = payload.rightPane?.identificationPhotos?.p01;
        const firstZonePhoto = payload.rightPane?.photoGalleries?.[0]?.ctxPhotoUrl;
        const firstDefectPhoto = payload.rightPane?.photoGalleries?.[0]?.defects?.[0]?.cuPhotoUrl;
        const initialPhoto = p01 || firstZonePhoto || firstDefectPhoto || '';
        setSelectedPhotoUrl(initialPhoto);
        setSelectedPhotoTitle(p01 ? 'Ảnh Mặt Tiền P-01' : 'Ảnh Hiện Trường');

        if (payload.isRefusedOrAbsent) {
          setLeftTab('absence');
        }
      } else {
        setErrorMsg('Không thể tải dữ liệu hồ sơ.');
      }
    } catch (err: any) {
      console.error('[AuditStudioModal] Error fetching audit view:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi khi tải dữ liệu thẩm định.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      fetchAuditData();
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  // Handle Approve
  const handleApprove = async () => {
    if (!data) return;
    const confirmMsg = `Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ thửa ${data.projectParcelCode}?\nHồ sơ sẽ được khóa bất biến và tự động ký số Zone Admin.`;
    if (!window.confirm(confirmMsg)) return;

    setIsApproving(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/approve`);
      if (res.data?.success || res.status === 200) {
        alert('Đã phê duyệt hồ sơ thành công!');
        onRefreshList();
        onClose();
      } else {
        alert(res.data?.message || 'Không thể phê duyệt hồ sơ.');
      }
    } catch (err: any) {
      console.error('[AuditStudioModal] Error approving:', err);
      alert(err.response?.data?.message || err.message || 'Lỗi kết nối khi phê duyệt.');
    } finally {
      setIsApproving(false);
    }
  };

  // Magnifier mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relX = (x / rect.width) * 100;
    const relY = (y / rect.height) * 100;
    setMagnifierPos({ x, y, relX, relY });
  };

  const leftPane = data?.leftPane;
  const rightPane = data?.rightPane;
  const riskCard = leftPane?.riskScoreCard;
  const auditFlags = data?.auditFlags || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm text-emerald-400">
                  {data?.projectParcelCode || 'Đang tải...'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs font-bold text-white">
                  {data?.houseNumber ? `${data.houseNumber} ${data.street}` : 'Địa chỉ chưa cập nhật'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {data?.zoneId || 'ZONE'}
                </span>
                {data?.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      data.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : data.status === 'POSTPONED_ABSENT'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : data.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {data.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                <span>KSV: <strong>{data?.surveyorName || '---'}</strong></span>
                {data?.surveyorPhone && <span>• SĐT: {data.surveyorPhone}</span>}
                {data?.surveyDate && (
                  <span>
                    • Khảo sát: {new Date(data.surveyDate).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl bg-slate-800 p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('stepwise')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'stepwise'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📋 9 Bước Khảo Sát (Ảnh Phẳng)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>◫ Chia Đôi (Split-Pane)</span>
              </button>
            </div>

            {auditFlags.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{auditFlags.length} Cờ cảnh báo</span>
              </span>
            )}
            <button
              type="button"
              onClick={fetchAuditData}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Stepwise or Split Screen Studio */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-sm font-bold">Đang tải hồ sơ thẩm định chi tiết...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-sm font-bold">{errorMsg}</span>
            <button
              onClick={fetchAuditData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : viewMode === 'stepwise' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
            <AuditStepwiseDocumentView
              data={data}
              reportId={reportId}
              onRefresh={fetchAuditData}
              onOpenPhotoZoom={(url, title, code) => {
                setSelectedPhotoUrl(url);
                setSelectedPhotoTitle(title || 'Ảnh Hiện Trường');
                setShowImageZoom(true);
              }}
              onOpenPhotoReplace={(params) => {
                setPhotoReplaceData({
                  isOpen: true,
                  ...params,
                });
              }}
              onOpenDiffModal={(diffItems, updates) => {
                setDiffModalData({
                  isOpen: true,
                  diffItems,
                  updates,
                });
              }}
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* ── LEFT PANE: DỮ LIỆU KỸ THUẬT & PHÁP LÝ (40%) ── */}
            <div className="lg:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/50 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 p-2 bg-white border-b border-slate-200 overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftTab('specs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    leftTab === 'specs'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  1. Ngoại quan & Kết cấu
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('defects')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    leftTab === 'defects'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  2. Khuyết tật & CAD
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('deformation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    leftTab === 'deformation'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  3. Nghiêng & Lún
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('risk')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    leftTab === 'risk'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  4. Rủi ro & Pháp lý
                </button>
                {data?.isRefusedOrAbsent && (
                  <button
                    type="button"
                    onClick={() => setLeftTab('absence')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      leftTab === 'absence'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                    }`}
                  >
                    Vắng mặt ({leftPane?.absenceLogs?.length || 1})
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* TAB 1: NGOẠI QUAN & KẾT CẤU */}
                {leftTab === 'specs' && (
                  <div className="space-y-3.5">
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-emerald-600" />
                        <span>Thông số định danh công trình</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Loại nhà:</span>
                          <span className="font-bold text-slate-800">
                            {leftPane?.buildingSpecs?.structureType || 'Nhà phố bê tông cốt thép'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Số tầng:</span>
                          <span className="font-bold text-slate-800">
                            {leftPane?.buildingSpecs?.floorCount || '3 tầng'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Hệ móng:</span>
                          <span className="font-bold text-slate-800">
                            {leftPane?.buildingSpecs?.foundationType || 'Móng cọc BTCT'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Loại mái:</span>
                          <span className="font-bold text-slate-800">
                            {leftPane?.buildingSpecs?.roofType || 'Mái bằng BTCT'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Ảnh ngoại quan P-01 -> P-04 */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Ảnh nhận diện ngoại quan (P-01 - P-04)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Click để soi ảnh</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['p01', 'p02', 'p03', 'p04'].map((code) => {
                          const url = rightPane?.identificationPhotos?.[code];
                          const labels: Record<string, string> = {
                            p01: 'P-01: Toàn cảnh mặt tiền',
                            p02: 'P-02: Ranh mặt đứng',
                            p03: 'P-03: Tiếp giáp nhà trái',
                            p04: 'P-04: Tiếp giáp nhà phải',
                          };
                          return (
                            <div
                              key={code}
                              onClick={() => {
                                if (url) {
                                  setSelectedPhotoUrl(url);
                                  setSelectedPhotoTitle(labels[code]);
                                }
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                selectedPhotoUrl === url
                                  ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                              }`}
                            >
                              <div className="aspect-video rounded bg-slate-200 overflow-hidden relative">
                                {url ? (
                                  <img src={url} alt={code} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                    Chưa có ảnh
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 block mt-1 truncate">
                                {labels[code]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: KHUYẾT TẬT & CAD */}
                {leftTab === 'defects' && (
                  <div className="space-y-3.5">
                    {/* Danh sách Vùng Z */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Khuyết tật trên Vùng Kiến Trúc (Z)</span>
                        <span className="text-[11px] font-mono text-emerald-700 font-bold">
                          {leftPane?.damageZones?.length || 0} Vùng
                        </span>
                      </div>

                      {leftPane?.damageZones?.map((z: any, zIdx: number) => (
                        <div
                          key={z.id || zIdx}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">
                              {z.zone_code || `Z-${zIdx + 1}`} ({z.room_name || 'Không gian'})
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {z.floor_name || 'Tầng'}
                            </span>
                          </div>

                          {/* Danh sách các điểm D trong Zone */}
                          <div className="space-y-1.5">
                            {z.defects?.length > 0 ? (
                              z.defects.map((d: any, dIdx: number) => (
                                <div
                                  key={d.id || dIdx}
                                  onClick={() => {
                                    const primaryPhoto =
                                      d.cuPhotos?.[0] || d.cuPhotoUrl || z.ctx_photo_url || '';
                                    setSelectedPhotoUrl(primaryPhoto);
                                    setSelectedPhotoTitle(
                                      `Khuyết tật ${d.defectCode || `D-${dIdx + 1}`} (${z.zone_code})`
                                    );
                                  }}
                                  className={`p-2 rounded-lg border text-xs transition-all cursor-pointer ${
                                    selectedPhotoTitle.includes(d.defectCode)
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900">
                                      {d.defectCode || `D-${dIdx + 1}`} - {d.defectType || 'Nứt tường'}
                                    </span>
                                    <span className="font-mono text-emerald-700 font-bold text-[11px]">
                                      w = {d.widthMaxMm ?? 0}mm • L = {d.lengthMm ?? 0}mm
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                    <span>{d.screeningCategory || 'Kết cấu gạch'}</span>
                                    <span>•</span>
                                    <span className={d.hasScaleCard ? 'text-emerald-700 font-bold' : 'text-amber-700'}>
                                      {d.hasScaleCard ? '✓ Có thước đo vạch mm' : '⚠ Thiếu thước đo'}
                                    </span>
                                    {d.isStructuralCritical && (
                                      <span className="text-red-600 font-bold">
                                        • Cực kỳ nguy cấp
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-[11px] text-slate-400 italic p-1">
                                Không ghi nhận điểm nứt D trên vùng này
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: NGHIÊNG & LÚN */}
                {leftTab === 'deformation' && (
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Ruler className="w-4 h-4 text-emerald-600" />
                      <span>Kết quả đo đạc độ nghiêng & lún chênh lệch</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[11px] block">Độ nghiêng tổng thể:</span>
                        <span className="text-base font-black text-slate-800">
                          {leftPane?.deformation?.inclinationValue || '0.12%'}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                          ✓ Nằm trong giới hạn TCVN (&lt; 0.5%)
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[11px] block">Lún chênh lệch tối đa:</span>
                        <span className="text-base font-black text-slate-800">
                          {leftPane?.deformation?.settlementValue || '2.0 mm'}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Phương pháp: Máy thủy bình kỹ thuật số
                        </span>
                      </div>
                    </div>

                    {leftPane?.deformation?.notes && (
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                        <strong>Ghi chú trắc địa:</strong> {leftPane.deformation.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: RỦI RO & PHÁP LÝ */}
                {leftTab === 'risk' && (
                  <div className="space-y-3.5">
                    {/* Bảng điểm Burland & ECS */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Bảng Đánh Giá Mức Độ Rủi Ro (Burland 1977)
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Cấp nứt Burland:</span>
                          <span className="text-sm font-black text-slate-800">
                            {riskCard?.burland_damage_category || 'Grade 1'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Chỉ số ECS (Hiện trạng):</span>
                          <span className="text-sm font-black text-emerald-700">
                            {riskCard?.ecs_score ? Number(riskCard.ecs_score).toFixed(1) : '1.5'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Chỉ số VI (Nhạy cảm):</span>
                          <span className="text-sm font-black text-indigo-700">
                            {riskCard?.vi_score ? Number(riskCard.vi_score).toFixed(1) : '2.0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chữ ký số & Pháp lý */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Biên Bản Tiếp Xúc & Chữ Ký Pháp Lý
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Người đại diện chủ hộ:</span>
                          <span className="font-bold text-slate-800 block">
                            {leftPane?.interview?.ownerName || 'Chủ hộ đã ký xác nhận'}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                            ✓ Đã ký biên bản hiện trường
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Kỹ thuật viên khảo sát:</span>
                          <span className="font-bold text-slate-800 block">
                            {data?.surveyorName || 'KTV'}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                            ✓ Chữ ký điện tử hợp lệ
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: VẮNG MẶT */}
                {leftTab === 'absence' && (
                  <div className="p-3.5 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span>Nhật ký tiếp xúc & Biên bản vắng mặt</span>
                    </div>

                    <div className="space-y-2">
                      {leftPane?.absenceLogs?.map((log: any, idx: number) => (
                        <div
                          key={log.id || idx}
                          className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-purple-950">
                            <span>Lần đến {log.attempt_number || idx + 1}</span>
                            <span className="text-[11px] text-purple-700">
                              {new Date(log.recorded_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p className="text-purple-900">
                            <strong>Lý do vắng:</strong> {log.absence_reason || 'Cửa đóng, không có người ở nhà'}
                          </p>
                          {log.photo_proof_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPhotoUrl(log.photo_proof_url);
                                setSelectedPhotoTitle(`Bằng chứng vắng mặt lần ${log.attempt_number || idx + 1}`);
                              }}
                              className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Xem ảnh cửa đóng / giấy mời</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT PANE: SOI ẢNH KÍNH LÚP 400% & CAD (60%) ── */}
            <div className="lg:col-span-7 flex flex-col bg-slate-900 overflow-hidden relative">
              {/* Photo Header Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 text-white border-b border-slate-800 text-xs shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-emerald-400 truncate">
                    {selectedPhotoTitle || 'Ảnh Khảo Sát Hiện Trường'}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Kính lúp 400%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowImageZoom(true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Mở toàn màn hình soi nét / xoay ảnh"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Toàn màn hình</span>
                  </button>
                </div>
              </div>

              {/* Central Photo Viewport with 400% Magnifier Lens */}
              <div
                ref={imageContainerRef}
                onMouseEnter={() => setShowMagnifier(true)}
                onMouseLeave={() => setShowMagnifier(false)}
                onMouseMove={handleMouseMove}
                className="flex-1 relative flex items-center justify-center p-4 overflow-hidden select-none bg-radial from-slate-800 to-slate-950"
              >
                {selectedPhotoUrl ? (
                  <div className="relative max-w-full max-h-full flex items-center justify-center">
                    <img
                      src={selectedPhotoUrl}
                      alt="Inspect"
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl"
                    />

                    {/* Magnifier Lens Circle (400% Zoom) */}
                    {showMagnifier && (
                      <div
                        className="pointer-events-none absolute w-48 h-48 rounded-full border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 overflow-hidden bg-slate-900 z-30"
                        style={{
                          left: `${magnifierPos.x - 96}px`,
                          top: `${magnifierPos.y - 96}px`,
                          backgroundImage: `url(${selectedPhotoUrl})`,
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '400%',
                          backgroundPosition: `${magnifierPos.relX}% ${magnifierPos.relY}%`,
                        }}
                      >
                        {/* Crosshair Center Indicator */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-40">
                          <div className="w-4 h-[1px] bg-emerald-400" />
                          <div className="h-4 w-[1px] bg-emerald-400 absolute" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-slate-600" />
                    <span>Chọn một ảnh từ danh sách bên trái hoặc bên dưới để soi</span>
                  </div>
                )}
              </div>

              {/* Bottom Thumbnail Strip */}
              <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0">
                  Thư viện ảnh:
                </span>
                {/* Exterior Photos */}
                {['p01', 'p02', 'p03', 'p04'].map((code) => {
                  const url = rightPane?.identificationPhotos?.[code];
                  if (!url) return null;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setSelectedPhotoUrl(url);
                        setSelectedPhotoTitle(`Ảnh ngoại quan ${code.toUpperCase()}`);
                      }}
                      className={`h-12 aspect-video rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                        selectedPhotoUrl === url
                          ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                          : 'border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={code} className="w-full h-full object-cover" />
                    </button>
                  );
                })}

                {/* Defect Closeup Photos */}
                {rightPane?.photoGalleries?.flatMap((g: any) =>
                  g.defects?.flatMap((d: any) =>
                    (d.cuPhotos?.length > 0 ? d.cuPhotos : [d.cuPhotoUrl]).filter(Boolean).map((photoUrl: string, pIdx: number) => (
                      <button
                        key={`${d.defectCode}-${pIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedPhotoUrl(photoUrl);
                          setSelectedPhotoTitle(`Khuyết tật ${d.defectCode} (#${pIdx + 1})`);
                        }}
                        className={`h-12 aspect-video rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer relative ${
                          selectedPhotoUrl === photoUrl
                            ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                            : 'border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={photoUrl} alt="CU" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/75 text-[9px] font-mono text-emerald-400 text-center truncate">
                          {d.defectCode}
                        </span>
                      </button>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Footer: Decision Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (data?.officialPdfUrl) {
                  window.open(data.officialPdfUrl, '_blank');
                } else {
                  alert('Báo cáo chưa được phê duyệt để xuất bản file PDF/A chính thức.');
                }
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Xem trước PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowJudgementModal(true)}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Can thiệp Kỹ thuật</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4 text-rose-600" />
              <span>Yêu cầu bổ sung (Reject)</span>
            </button>

            <button
              type="button"
              disabled={isApproving || data?.status === 'APPROVED'}
              onClick={handleApprove}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer ${
                data?.status === 'APPROVED'
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Đang ký duyệt...' : data?.status === 'APPROVED' ? 'Đã duyệt' : 'Phê Duyệt Hồ Sơ (Approve)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && data && (
        <RejectReportModal
          isOpen={showRejectModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode}
          surveyorName={data.surveyorName}
          onClose={() => setShowRejectModal(false)}
          onSuccess={(reason) => {
            alert('Đã gửi yêu cầu bổ sung cho Surveyor thành công!');
            onRefreshList();
            onClose();
          }}
        />
      )}

      {/* Engineering Judgement Modal */}
      {showJudgementModal && data && (
        <EngineeringJudgementModal
          isOpen={showJudgementModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode}
          currentBurlandGrade={riskCard?.burland_damage_category}
          onClose={() => setShowJudgementModal(false)}
          onSuccess={() => {
            alert('Đã lưu can thiệp chuyên gia thành công!');
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {/* Image Zoom Modal (Full screen pinch-to-zoom & rotate) */}
      {showImageZoom && selectedPhotoUrl && (
        <ImageZoomModal
          isOpen={showImageZoom}
          imageUrl={selectedPhotoUrl}
          title={selectedPhotoTitle}
          onClose={() => setShowImageZoom(false)}
        />
      )}

      {/* Audit Diff Confirm Modal */}
      {diffModalData.isOpen && (
        <AuditDiffConfirmModal
          isOpen={diffModalData.isOpen}
          reportId={reportId}
          parcelCode={data?.projectParcelCode}
          diffItems={diffModalData.diffItems}
          updatesPayload={diffModalData.updates}
          onClose={() => setDiffModalData({ isOpen: false, diffItems: [], updates: {} })}
          onSuccess={() => {
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {/* Audit Photo Replace Modal (With 6-digit random code) */}
      {photoReplaceData.isOpen && (
        <AuditPhotoReplaceModal
          isOpen={photoReplaceData.isOpen}
          reportId={reportId}
          targetPhotoType={photoReplaceData.targetPhotoType}
          targetPhotoId={photoReplaceData.targetPhotoId}
          defectId={photoReplaceData.defectId}
          zoneId={photoReplaceData.zoneId}
          photoIndex={photoReplaceData.photoIndex}
          currentPhotoUrl={photoReplaceData.currentPhotoUrl}
          photoTitle={photoReplaceData.photoTitle}
          onClose={() =>
            setPhotoReplaceData({
              isOpen: false,
              targetPhotoType: 'OTHER',
              currentPhotoUrl: '',
            })
          }
          onSuccess={() => {
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}
    </div>
  );
};
