import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  ShieldCheck,
  Eye,
  Check,
  X,
  Lock,
  UserCheck,
  ExternalLink,
  ChevronRight,
  Database,
  Building,
} from 'lucide-react';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errorUtils';
import type { ImportPreviewState } from '../../../components/gis/shared/types';

export interface ZoneOverviewItem {
  zoneCode: string;
  zoneName: string;
  type: 'C&C' | 'POR' | 'ELV' | 'DEP';
  prefix: string;
  slugPrefix: string;
  seq: number;
  zoiBufferMeters: number;
  totalParcelsCount: number;
  approvedParcelsCount: number;
  surveyedParcelsCount: number;
  unSurveyedParcelsCount: number;
  isActive: boolean;
  assignedAdmin: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  serverDataFile: {
    exists: boolean;
    filePath?: string;
    fileSizeBytes?: number;
    parcelsInFile?: number;
  };
}

export interface ZoneAuditResult {
  zoneCode: string;
  totalIncoming: number;
  validParcelsCount: number;
  invalidGeometryCount: number;
  duplicatesOtherZones: Array<{
    mathuadat: string;
    existingZoneId: string;
    existingProjectCode: string;
  }>;
  existingZoneParcelsCount: number;
  existingSurveyedCount: number;
  canImport: boolean;
  isCleanReimport: boolean;
  codePreview: {
    startCode: string;
    endCode: string;
    slugStartCode: string;
    slugEndCode: string;
  };
  sampleParcels: Array<{
    mathuadat: string;
    projectParcelCode: string;
    codeSlug: string;
    soto: string;
    sothua: string;
    dientich: number;
    street: string;
    ward: string;
    district: string;
    latitude: number;
    longitude: number;
    ranhCoords: [number, number][];
  }>;
}

interface Props {
  onOpenMapPreview?: (previewState: ImportPreviewState) => void;
}

export const ZoneIngestionTab: React.FC<Props> = ({ onOpenMapPreview }) => {
  const [zones, setZones] = useState<ZoneOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'C&C' | 'POR' | 'DEP'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HAS_DATA' | 'NO_DATA' | 'SURVEYING'>('ALL');

  // Modal Upload & Audit
  const [targetZone, setTargetZone] = useState<ZoneOverviewItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawParcelsPayload, setRawParcelsPayload] = useState<Record<string, unknown>[] | null>(null);
  const [auditResult, setAuditResult] = useState<ZoneAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [forceReimport, setForceReimport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Tải danh mục 22 Zone từ Backend
  const loadZones = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/admin/zones/overview');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setZones(res.data.data);
      }
    } catch (err: unknown) {
      console.error('[ZoneIngestionTab:loadZones] Lỗi tải danh sách zones:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể kết nối máy chủ để tải thông tin 22 Zone.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  // Tự ẩn thông báo toast sau 5 giây
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  // 2. Xử lý đọc file JSON và gọi Audit API
  const handleFileSelected = (file: File) => {
    setUploadedFile(file);
    setAuditResult(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        const rawObj = json.parcels || json;
        const parcelsArray = (Array.isArray(rawObj) ? rawObj : Object.values(rawObj)) as Record<string, unknown>[];

        if (!Array.isArray(parcelsArray) || parcelsArray.length === 0) {
          setErrorMsg('Tệp JSON không chứa thuộc tính parcels hợp lệ hoặc danh sách thửa đất rỗng.');
          return;
        }

        setRawParcelsPayload(parcelsArray);

        // Gọi Audit API
        if (targetZone) {
          await triggerAudit(targetZone.zoneCode, parcelsArray);
        }
      } catch (err: unknown) {
        console.error('[ZoneIngestionTab:handleFileSelected] Lỗi parse file JSON:', err);
        setErrorMsg('Định dạng tệp JSON không hợp lệ. Vui lòng kiểm tra lại cấu trúc file.');
      }
    };
    reader.readAsText(file);
  };

  const triggerAudit = async (zoneCode: string, parcels: Record<string, unknown>[]) => {
    try {
      setIsAuditing(true);
      setErrorMsg(null);
      const res = await api.post(`/admin/zones/${zoneCode}/audit-data`, { parcels });
      if (res.data?.success) {
        setAuditResult(res.data.data);
      }
    } catch (err: unknown) {
      console.error('[ZoneIngestionTab:triggerAudit] Lỗi thẩm định dữ liệu:', err);
      setErrorMsg(getErrorMessage(err, 'Thẩm định dữ liệu thất bại'));
    } finally {
      setIsAuditing(false);
    }
  };

  // 3. Thực thi nạp CSDL
  const handleExecuteImport = async () => {
    if (!targetZone || !rawParcelsPayload) return;
    try {
      setIsImporting(true);
      setErrorMsg(null);
      const res = await api.post(`/admin/zones/${targetZone.zoneCode}/import-data`, {
        parcels: rawParcelsPayload,
        forceCleanReimport: forceReimport,
      });

      if (res.data?.success) {
        setSuccessToast(`Nạp thành công ${res.data.data.insertedCount} thửa đất cho ${targetZone.zoneCode} [${res.data.data.startCode} -> ${res.data.data.endCode}]!`);
        setTargetZone(null);
        setUploadedFile(null);
        setRawParcelsPayload(null);
        setAuditResult(null);
        await loadZones();
      }
    } catch (err: unknown) {
      console.error('[ZoneIngestionTab:handleExecuteImport] Lỗi nạp dữ liệu:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể nạp dữ liệu vào CSDL'));
    } finally {
      setIsImporting(false);
    }
  };

  // 4. Mở bản đồ xem trước dữ liệu nạp (GIS Preview Layer nét đứt)
  const handleOpenMapWithPreview = () => {
    if (!targetZone || !auditResult || !onOpenMapPreview) return;
    onOpenMapPreview({
      zoneCode: targetZone.zoneCode,
      zoneName: targetZone.zoneName,
      totalIncoming: auditResult.validParcelsCount,
      startCode: auditResult.codePreview.startCode,
      endCode: auditResult.codePreview.endCode,
      parcels: auditResult.sampleParcels.map((p) => ({
        mathuadat: p.mathuadat,
        projectParcelCode: p.projectParcelCode,
        codeSlug: p.codeSlug,
        soto: p.soto,
        sothua: p.sothua,
        dientich: p.dientich,
        street: p.street,
        ward: p.ward,
        district: p.district,
        latitude: p.latitude,
        longitude: p.longitude,
        ranhCoords: p.ranhCoords,
      })),
    });
  };

  // Lọc danh sách hiển thị
  const filteredZones = zones.filter((z) => {
    const matchesSearch =
      z.zoneCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.zoneName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.prefix.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || z.type === typeFilter;

    let matchesStatus = true;
    if (statusFilter === 'HAS_DATA') {
      matchesStatus = z.totalParcelsCount > 0;
    } else if (statusFilter === 'NO_DATA') {
      matchesStatus = z.totalParcelsCount === 0;
    } else if (statusFilter === 'SURVEYING') {
      matchesStatus = z.surveyedParcelsCount > 0;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast thông báo thành công */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-400 hover:text-white cursor-pointer ml-2"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-700 text-xs font-mono font-bold">
              SUPER ADMIN STUDIO
            </span>
            <span className="text-xs text-slate-400">
              Quy chuẩn Metro 2 CRLG-CRSRI-TT
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Layers className="text-purple-400 w-7 h-7" />
            <span>Quản Lý 22 Zone & Nạp Dữ Liệu Địa Chính Toàn Tuyến</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Hỗ trợ kéo thả tải lên file <code className="text-amber-300 font-mono">ban_do_data.json</code>, tự động sinh mã định danh riêng biệt theo từng Zone (<code className="text-cyan-300 font-mono">C&C-04-B-XXXX</code>), xem trước lớp ranh đất nét đứt trên Bản đồ GIS và đồng bộ an toàn lên Cloud.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadZones}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên ga, mã Zone (ZONE_07), prefix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Loại kết cấu */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {(['ALL', 'C&C', 'POR', 'DEP'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === t
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'ALL' ? 'Tất cả loại' : t}
              </button>
            ))}
          </div>

          {/* Trạng thái dữ liệu */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {([
              { key: 'ALL', label: 'Tất cả 22 Zone' },
              { key: 'HAS_DATA', label: 'Đã có dữ liệu' },
              { key: 'NO_DATA', label: 'Chưa có dữ liệu' },
              { key: 'SURVEYING', label: 'Đang khảo sát' },
            ] as const).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatusFilter(s.key)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === s.key
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid 22 Zones Matrix */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Đang tải dữ liệu ma trận 22 Zone...</p>
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
          <Layers className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy Zone phù hợp</h3>
          <p className="text-xs text-slate-500">Thử đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map((z) => {
            const hasData = z.totalParcelsCount > 0;
            const isCAndC = z.type === 'C&C';
            const isPOR = z.type === 'POR';
            const isDEP = z.type === 'DEP';

            return (
              <div
                key={z.zoneCode}
                className={`relative bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                  hasData && z.isActive
                    ? 'border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-b from-emerald-50/20 to-transparent'
                    : hasData && !z.isActive
                    ? 'border-amber-300 dark:border-amber-800/80 bg-gradient-to-b from-amber-50/20 to-transparent'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Top Badge & Code */}
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                        {z.zoneCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                          isCAndC
                            ? 'bg-orange-950 text-orange-300 border-orange-700'
                            : isPOR
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}
                      >
                        {z.type} (STT {String(z.seq).padStart(2, '0')})
                      </span>
                    </div>

                    {/* Status Badge */}
                    {z.totalParcelsCount > 0 ? (
                      z.surveyedParcelsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ĐANG KHẢO SÁT ({z.surveyedParcelsCount}/{z.totalParcelsCount})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          ĐÃ CÓ DỮ LIỆU
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-semibold">
                        CHƯA CÓ DỮ LIỆU
                      </span>
                    )}
                  </div>

                  {/* Title & Name */}
                  <div className="mt-3">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {z.zoneName}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2">
                      <span>Tiền tố mã: <strong className="text-purple-600 dark:text-purple-400">{z.prefix}-B-XXXX</strong></span>
                      <span>•</span>
                      <span>ZOI: <strong>{z.zoiBufferMeters}m</strong></span>
                    </div>
                  </div>

                  {/* Metrics Box */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Thửa trong CSDL</div>
                      <div className="font-bold font-mono text-slate-900 dark:text-white text-sm mt-0.5">
                        {z.totalParcelsCount > 0 ? `${z.totalParcelsCount} thửa` : '0 thửa'}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Đã khảo sát</div>
                      <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                        {z.surveyedParcelsCount} thửa
                      </div>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Chưa khảo sát:</span>
                      <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {z.unSurveyedParcelsCount} thửa
                      </span>
                    </div>
                  </div>

                  {/* Server file notice if detected */}
                  {z.serverDataFile.exists && (
                    <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-[11px] flex items-center justify-between">
                      <span>Phát hiện tệp server:</span>
                      <strong className="font-mono font-bold">
                        {z.serverDataFile.parcelsInFile} thửa
                      </strong>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {z.totalParcelsCount === 0 || z.surveyedParcelsCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetZone(z);
                        setUploadedFile(null);
                        setAuditResult(null);
                        setForceReimport(z.totalParcelsCount > 0);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-purple-900/20 active:scale-95"
                    >
                      <UploadCloud size={15} />
                      <span>{z.totalParcelsCount > 0 ? 'Nạp lại bản đồ' : 'Tải file nạp bản đồ'}</span>
                    </button>
                  ) : (
                    <div className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed select-none">
                      <Lock size={13} />
                      <span>Khóa nạp lại (Đang khảo sát)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: UPLOAD FILE & AUDIT DỮ LIỆU */}
      {/* ========================================================================= */}
      {targetZone && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 font-mono">
                  {targetZone.zoneCode} - {targetZone.type}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Nạp Dữ Liệu Địa Chính: {targetZone.zoneName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTargetZone(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error in modal if any */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Dropzone Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-800/30 hover:bg-purple-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                }}
              />

              <UploadCloud className="w-10 h-10 text-purple-500 mx-auto mb-2" />
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {uploadedFile ? uploadedFile.name : 'Kéo thả hoặc bấm để chọn tệp ban_do_data.json'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Chấp nhận tệp định dạng JSON cấu trúc đo đạc địa chính & quy hoạch chuẩn Metro 2.
              </p>
            </div>

            {/* Quick button to use server file if available */}
            {targetZone.serverDataFile.exists && !uploadedFile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs">
                <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-200">
                  <Database size={15} className="text-cyan-600 shrink-0" />
                  <span>
                    Máy chủ đã có sẵn tệp: <strong>data/{targetZone.zoneCode.replace('ZONE_', 'Zone_')}/ban_do_data.json</strong> ({targetZone.serverDataFile.parcelsInFile} thửa)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsAuditing(true);
                      const res = await api.get(`/parcels/zone-map?zoneId=${targetZone.zoneCode}`);
                      // Hoặc đọc trực tiếp từ static data nếu có
                      alert('Vui lòng chọn tệp từ máy tính để đảm bảo kiểm soát bảo mật client.');
                    } catch (err) {
                      console.error('[ZoneIngestionTab] Lỗi đọc server file:', err);
                    } finally {
                      setIsAuditing(false);
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] cursor-pointer"
                >
                  Chọn Từ Server
                </button>
              </div>
            )}

            {/* Audit Results Panel */}
            {isAuditing && (
              <div className="py-6 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Đang thẩm định dữ liệu & kiểm tra trùng lặp FCFS...</p>
              </div>
            )}

            {auditResult && !isAuditing && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kết quả Thẩm định Dữ liệu (Pre-import Audit):
                  </span>
                  {auditResult.canImport ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ĐẠT CHUẨN NẠP
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                      KHÔNG THỂ NẠP
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 font-semibold">Tổng thửa trong file</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {auditResult.totalIncoming}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-emerald-600 font-semibold">Thửa hợp lệ</div>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">
                      {auditResult.validParcelsCount}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 font-semibold">Trùng zone khác (FCFS)</div>
                    <div className="text-sm font-bold text-amber-600 mt-0.5">
                      {auditResult.duplicatesOtherZones.length} thửa
                    </div>
                  </div>
                </div>

                {/* Mã dự kiến cấp */}
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs">
                  <span className="text-[11px] text-purple-700 dark:text-purple-300">
                    Dải mã công trình dự kiến cấp ({targetZone.prefix}):
                  </span>
                  <div className="font-mono font-bold text-purple-900 dark:text-purple-200 mt-0.5">
                    {auditResult.codePreview.startCode} $\longrightarrow$ {auditResult.codePreview.endCode}
                  </div>
                </div>

                {/* Cảnh báo re-import nếu có */}
                {auditResult.isCleanReimport && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>
                      Zone này đã có {auditResult.existingZoneParcelsCount} thửa cũ (chưa khảo sát). Xác nhận nạp sẽ làm sạch và thay thế toàn bộ danh sách thửa cũ.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTargetZone(null)}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy Bỏ
              </button>

              {auditResult && auditResult.canImport && (
                <>
                  {/* Nút Xem Trước trên Bản Đồ (GIS Preview Layer) */}
                  <button
                    type="button"
                    onClick={handleOpenMapWithPreview}
                    disabled={isImporting}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-900/20 active:scale-95"
                  >
                    <Eye size={14} />
                    <span>Xem Trước Trên Bản Đồ (Nét Đứt)</span>
                  </button>

                  {/* Nút Nạp Trực Tiếp */}
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-900/30 active:scale-95 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang nạp CSDL...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Xác Nhận Nạp Vào CSDL</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}




    </div>
  );
};
