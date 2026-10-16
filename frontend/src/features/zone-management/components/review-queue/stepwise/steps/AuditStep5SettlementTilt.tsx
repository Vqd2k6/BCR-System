import React from 'react';
import {
  Activity,
  Ruler,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Maximize2,
  Camera,
  Layers,
  HelpCircle,
  RefreshCw,
  Plus,
  Trash2,
  History,
} from 'lucide-react';
import { SETTLEMENT_LEVEL_OPTIONS, TILT_LEVEL_OPTIONS, DATA_SOURCES as PHASE1_DATA_SOURCES } from '../../../../../survey-phase1/components/step1/step1.constants';
import { SAG_LEVEL_OPTIONS } from '../../../../../survey-phase1/constants/levelGuideConstants';
import { AuditPhotoCard } from '../components/AuditPhotoCard';
import type { AuditStepwiseFormState, StepwiseSettlementTilt, PhotoReplaceParams, AuditPhotoActionParams, AuditPhotoHistoryParams, PhotoActionPayload } from '../types';

interface Props {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace?: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
}

export const isDataSourceMatched = (selectedSources: string[], target: string): boolean => {
  if (!Array.isArray(selectedSources)) return false;
  const tNorm = target.toLowerCase().trim();
  return selectedSources.some((s) => {
    if (!s) return false;
    const sNorm = s.toLowerCase().trim();
    return sNorm === tNorm || sNorm.includes(tNorm) || tNorm.includes(sNorm);
  });
};

const DATA_SOURCES_LIST = Array.from(new Set([
  ...PHASE1_DATA_SOURCES,
  'Thước dây / Thước thép',
  'Thước nivo / Quả dọi',
]));

export const AuditStep5SettlementTilt: React.FC<Props> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  isFieldDirty,
  stagedPhotoActions = [],
  onUndoPhotoAction,
}) => {
  const st: StepwiseSettlementTilt = formState.settlementTilt || {};
  const tilt = st.buildingTilt || {};
  const beam = st.beamSagging || {};
  const diff = st.diffSettlement || {};
  const abnormal = st.abnormalCase || {};
  const monitoring = st.needAdditionalMonitoring || { required: false, notes: '' };

  const lDiff = Number(diff.level) || 0;
  const lTilt = Number(tilt.level) || 0;
  const lSag = Number(beam.level) || 0;
  const calculatedE3 = Math.min(4, Math.max(lDiff, lTilt, lSag));

  // Helper tra cứu trạng thái can thiệp ảnh staged
  const getStagedAction = (filter: {
    category?: string;
    targetPhotoId?: string;
    targetPhotoType?: string;
    photoIndex?: number;
    url?: string;
  }) => {
    if (!stagedPhotoActions || stagedPhotoActions.length === 0) return null;
    return stagedPhotoActions.find((a) => {
      if (filter.category && a.category !== filter.category) return false;
      if (filter.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) return false;
      if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
      if (filter.url && a.oldPhotoUrl && a.oldPhotoUrl === filter.url) return true;
      if (filter.photoIndex !== undefined && a.photoIndex !== undefined && a.photoIndex === filter.photoIndex) return true;
      return false;
    });
  };

  // Danh sách ảnh lún chênh
  const diffPhotos: Array<{ url: string; photoCode?: string; notes?: string }> =
    Array.isArray(diff.photos) && diff.photos.length > 0
      ? diff.photos
      : diff.photoUrl
        ? [{ url: diff.photoUrl, photoCode: diff.photoCode || 'SETTLE_01', notes: diff.notes }]
        : [];

  // Danh sách ảnh độ nghiêng
  const tiltPhotos: Array<{ url: string; photoCode?: string; notes?: string }> =
    Array.isArray(tilt.photos) && tilt.photos.length > 0
      ? tilt.photos
      : tilt.photoUrl
        ? [{ url: tilt.photoUrl, photoCode: tilt.photoCode || 'TILT_01', notes: tilt.notes }]
        : [];

  // Danh sách ảnh độ võng dầm
  const beamPhotos: Array<{ url: string; photoCode?: string; notes?: string }> =
    Array.isArray(beam.photos) && beam.photos.length > 0
      ? beam.photos
      : beam.photoUrl
        ? [{ url: beam.photoUrl, photoCode: beam.photoCode || 'SAG_01', notes: beam.notes }]
        : [];

  // Danh sách ảnh ngoại lệ bất thường
  const abnormalPhotos: Array<{ url: string; photoCode?: string; notes?: string }> =
    Array.isArray(abnormal.photos) && abnormal.photos.length > 0
      ? abnormal.photos
      : abnormal.photoUrl
        ? [{ url: abnormal.photoUrl, photoCode: abnormal.photoCode || 'ANOMALY_01', notes: abnormal.notes }]
        : [];

  // Danh sách nguồn xác định dữ liệu
  const dataSources: string[] = Array.isArray(st.dataSource) ? (st.dataSource as string[]) : [];

  const checkDirty = (subKey?: string) => {
    return isFieldDirty ? isFieldDirty('settlementTilt', subKey) : false;
  };

  return (
    <section id="step-2" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 02
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Đo Đạc Biến Dạng, Lún Nghiêng & Quan Trắc Mốc
            </h3>
            <p className="text-[11px] text-slate-500">
              Đo đạc trắc địa độ nghiêng tổng thể 2 phương X/Y, độ chênh lún móng, độ võng dầm kết cấu và hệ thống mốc quan trắc
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Chỉ số E3 = {calculatedE3}/4</span>
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 2.1. Khối 3 thông số biến dạng chính */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Lún chênh lệch */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  1. Lún Chênh Lệch Nền Móng:
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lDiff > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                  Cấp {lDiff}/4
                </span>
              </div>

              {isEditMode ? (
                <select
                  value={diff.level ?? 0}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'diffSettlement', 'Cấp độ lún lệch', {
                      ...diff,
                      level: Number(e.target.value),
                    })
                  }
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                >
                  {SETTLEMENT_LEVEL_OPTIONS.map((opt: { level: number; title: string; desc?: string }) => (
                    <option key={opt.level} value={opt.level}>
                      Cấp {opt.level} - {opt.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {diff.level !== undefined
                    ? `Cấp ${diff.level} (${SETTLEMENT_LEVEL_OPTIONS.find((o: { level: number; title: string; desc?: string }) => o.level === diff.level)?.title || 'Bình thường'})`
                    : 'Không phát hiện lún lệch'}
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Vị trí ghi nhận lún:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={diff.position || ''}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'diffSettlement', 'Vị trí lún lệch', {
                        ...diff,
                        position: e.target.value,
                      })
                    }
                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs mt-0.5"
                    placeholder="Vị trí ghi nhận lún..."
                  />
                ) : (
                  <div className="text-[11px] text-slate-600">
                    {diff.position || 'Không'}
                  </div>
                )}
              </div>
            </div>

            {/* Thư viện ảnh lún chênh */}
            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-slate-500" />
                  <span>Ảnh Lún Chênh / Chân Tường ({diffPhotos.length})</span>
                </span>
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'SETTLEMENT_TILT',
                        targetPhotoType: 'SETTLEMENT_DIFF',
                        targetPhotoId: 'settlementTilt.diffSettlement.photos',
                        photoTitle: 'Bổ sung ảnh lún chênh',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Thêm Ảnh</span>
                  </button>
                )}
              </div>

              {diffPhotos.length > 0 || (stagedPhotoActions?.some((a) => a.action === 'ADD' && a.targetPhotoType === 'SETTLEMENT_DIFF')) ? (
                <div className="grid grid-cols-2 gap-2">
                  {diffPhotos.map((p, pIdx) => {
                    const stagedDiff = getStagedAction({
                      category: 'SETTLEMENT_TILT',
                      targetPhotoType: 'SETTLEMENT_DIFF',
                      targetPhotoId: 'settlementTilt.diffSettlement.photos',
                      photoIndex: pIdx,
                      url: p.url,
                    });
                    return (
                      <AuditPhotoCard
                        key={pIdx}
                        url={stagedDiff?.newPhotoUrl || p.url}
                        photoCode={p.photoCode || `SETTLE_${pIdx + 1}`}
                        title={`Ảnh lún chênh (${p.photoCode || `SETTLE_${pIdx + 1}`})`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="SETTLEMENT_DIFF"
                        targetPhotoId="settlementTilt.diffSettlement.photos"
                        photoIndex={pIdx}
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="amber"
                        optimisticStatus={stagedDiff ? (stagedDiff.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                        onUndoDelete={stagedDiff ? () => onUndoPhotoAction?.(stagedDiff) : undefined}
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    );
                  })}

                  {/* Ảnh lún chênh mới thêm (Optimistic ADD) */}
                  {stagedPhotoActions
                    ?.filter((a) => a.action === 'ADD' && a.targetPhotoType === 'SETTLEMENT_DIFF')
                    .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                    .map((addedUrl, addIdx) => (
                      <AuditPhotoCard
                        key={`added-diff-${addIdx}`}
                        url={addedUrl}
                        photoCode={`Mới`}
                        title={`Ảnh lún chênh mới thêm`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="SETTLEMENT_DIFF"
                        targetPhotoId="settlementTilt.diffSettlement.photos"
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="emerald"
                        optimisticStatus="ADDED"
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-white border border-dashed border-slate-200 text-center space-y-1">
                  <p className="text-[10px] text-slate-400 italic">Chưa có ảnh lún chênh chân tường</p>
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoType: 'SETTLEMENT_DIFF',
                          photoTitle: 'Lịch sử ảnh lún chênh chân tường',
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-700 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem lịch sử và khôi phục ảnh lún chênh đã xóa"
                    >
                      <History className="w-3 h-3 text-sky-600" />
                      <span> Lịch sử / Khôi phục ảnh</span>
                    </button>
                  )}
                </div>
              )}

              {diff.notes && (
                <p className="text-[10px] text-slate-500 italic line-clamp-2">
                  &bull; {diff.notes}
                </p>
              )}
            </div>
          </div>

          {/* 2. Độ nghiêng công trình */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  2. Độ Nghiêng Công Trình:
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lTilt > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                  Cấp {lTilt}/4
                </span>
              </div>

              {isEditMode ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs font-mono font-bold text-slate-600">X:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={tilt.xPermille ?? 0}
                        onChange={(e) =>
                          handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Độ nghiêng X', {
                            ...tilt,
                            xPermille: Number(e.target.value),
                          })
                        }
                        className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-bold font-mono bg-white"
                        placeholder="‰"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs font-mono font-bold text-slate-600">Y:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={tilt.yPermille ?? 0}
                        onChange={(e) =>
                          handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Độ nghiêng Y', {
                            ...tilt,
                            yPermille: Number(e.target.value),
                          })
                        }
                        className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-bold font-mono bg-white"
                        placeholder="‰"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={tilt.direction || ''}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Hướng nghiêng', {
                        ...tilt,
                        direction: e.target.value,
                      })
                    }
                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    placeholder="Hướng nghiêng (VD: Nghiêng về hẻm sau...)"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-xs font-black text-slate-800 font-mono">
                    X: {tilt.xPermille || '0'} ‰ &bull; Y: {tilt.yPermille || '0'} ‰
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Hướng: <strong>{tilt.direction || 'Không ghi nhận hướng nghiêng'}</strong>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-500">
                {tilt.notes || 'Không'}
              </div>
            </div>

            {/* Thư viện ảnh độ nghiêng */}
            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-slate-500" />
                  <span>Ảnh Kiểm Tra Độ Nghiêng ({tiltPhotos.length})</span>
                </span>
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'SETTLEMENT_TILT',
                        targetPhotoType: 'TILT_ANGLE',
                        targetPhotoId: 'settlementTilt.buildingTilt.photos',
                        photoTitle: 'Bổ sung ảnh độ nghiêng',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Thêm Ảnh</span>
                  </button>
                )}
              </div>

              {tiltPhotos.length > 0 || (stagedPhotoActions?.some((a) => a.action === 'ADD' && a.targetPhotoType === 'TILT_ANGLE')) ? (
                <div className="grid grid-cols-2 gap-2">
                  {tiltPhotos.map((p, pIdx) => {
                    const stagedTilt = getStagedAction({
                      category: 'SETTLEMENT_TILT',
                      targetPhotoType: 'TILT_ANGLE',
                      targetPhotoId: 'settlementTilt.buildingTilt.photos',
                      photoIndex: pIdx,
                      url: p.url,
                    });
                    return (
                      <AuditPhotoCard
                        key={pIdx}
                        url={stagedTilt?.newPhotoUrl || p.url}
                        photoCode={p.photoCode || `TILT_${pIdx + 1}`}
                        title={`Ảnh độ nghiêng (${p.photoCode || `TILT_${pIdx + 1}`})`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="TILT_ANGLE"
                        targetPhotoId="settlementTilt.buildingTilt.photos"
                        photoIndex={pIdx}
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="amber"
                        optimisticStatus={stagedTilt ? (stagedTilt.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                        onUndoDelete={stagedTilt ? () => onUndoPhotoAction?.(stagedTilt) : undefined}
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    );
                  })}

                  {/* Ảnh độ nghiêng mới thêm (Optimistic ADD) */}
                  {stagedPhotoActions
                    ?.filter((a) => a.action === 'ADD' && a.targetPhotoType === 'TILT_ANGLE')
                    .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                    .map((addedUrl, addIdx) => (
                      <AuditPhotoCard
                        key={`added-tilt-${addIdx}`}
                        url={addedUrl}
                        photoCode={`Mới`}
                        title={`Ảnh độ nghiêng mới thêm`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="TILT_ANGLE"
                        targetPhotoId="settlementTilt.buildingTilt.photos"
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="emerald"
                        optimisticStatus="ADDED"
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-white border border-dashed border-slate-200 text-center space-y-1">
                  <p className="text-[10px] text-slate-400 italic">Chưa có ảnh nivo / độ nghiêng khối nhà</p>
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoType: 'TILT_MEASUREMENT',
                          photoTitle: 'Lịch sử ảnh nivo / độ nghiêng công trình',
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-700 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem lịch sử và khôi phục ảnh độ nghiêng đã xóa"
                    >
                      <History className="w-3 h-3 text-sky-600" />
                      <span> Lịch sử / Khôi phục ảnh</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Độ võng dầm / bản sàn */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  3. Độ Võng Dầm / Bản Sàn:
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lSag > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                  Cấp {lSag}/4
                </span>
              </div>

              {isEditMode ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={beam.level ?? 0}
                      onChange={(e) =>
                        handleNestedFieldChange('settlementTilt', 'beamSagging', 'Cấp độ võng dầm', {
                          ...beam,
                          level: Number(e.target.value),
                        })
                      }
                      className="flex-1 p-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    >
                      {SAG_LEVEL_OPTIONS.map((opt: { level: number; title: string; desc?: string }) => (
                        <option key={opt.level} value={opt.level}>
                          Cấp {opt.level} - {opt.title}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.5"
                      value={beam.sagMm ?? ''}
                      onChange={(e) =>
                        handleNestedFieldChange('settlementTilt', 'beamSagging', 'Độ võng mm', {
                          ...beam,
                          sagMm: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="w-18 p-1 bg-white border border-slate-300 rounded text-xs font-bold"
                      placeholder="Võng (mm)"
                    />
                  </div>
                  <input
                    type="text"
                    value={beam.position || ''}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'beamSagging', 'Vị trí dầm võng', {
                        ...beam,
                        position: e.target.value,
                      })
                    }
                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                    placeholder="Vị trí dầm (VD: Dầm D2 trục 2-3 Tầng 2)"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {beam.sagMm ? `Võng ${beam.sagMm} mm (Cấp ${beam.level || 0})` : 'Không phát hiện võng'}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Vị trí: <strong>{beam.position || 'Không xác định'}</strong>
                  </div>
                  {beam.description && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">{beam.description}</div>
                  )}
                </div>
              )}
            </div>

            {/* Thư viện ảnh độ võng dầm */}
            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-slate-500" />
                  <span>Ảnh Kiểm Tra Độ Võng Dầm ({beamPhotos.length})</span>
                </span>
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'BEAM_SAGGING',
                        targetPhotoType: 'BEAM_SAGGING',
                        targetPhotoId: 'settlementTilt.beamSagging.photos',
                        photoTitle: 'Bổ sung ảnh độ võng dầm',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Thêm Ảnh</span>
                  </button>
                )}
              </div>

              {beamPhotos.length > 0 || (stagedPhotoActions?.some((a) => a.action === 'ADD' && a.category === 'BEAM_SAGGING')) ? (
                <div className="grid grid-cols-2 gap-2">
                  {beamPhotos.map((p, pIdx) => {
                    const stagedBeam = getStagedAction({
                      category: 'BEAM_SAGGING',
                      targetPhotoType: 'BEAM_SAGGING',
                      targetPhotoId: 'settlementTilt.beamSagging.photos',
                      photoIndex: pIdx,
                      url: p.url,
                    });
                    return (
                      <AuditPhotoCard
                        key={pIdx}
                        url={stagedBeam?.newPhotoUrl || p.url}
                        photoCode={p.photoCode || `SAG_${pIdx + 1}`}
                        title={`Ảnh võng dầm (${p.photoCode || `SAG_${pIdx + 1}`})`}
                        category="BEAM_SAGGING"
                        targetPhotoType="BEAM_SAGGING"
                        targetPhotoId="settlementTilt.beamSagging.photos"
                        photoIndex={pIdx}
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="amber"
                        optimisticStatus={stagedBeam ? (stagedBeam.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                        onUndoDelete={stagedBeam ? () => onUndoPhotoAction?.(stagedBeam) : undefined}
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    );
                  })}

                  {/* Ảnh võng dầm mới thêm (Optimistic ADD) */}
                  {stagedPhotoActions
                    ?.filter((a) => a.action === 'ADD' && a.category === 'BEAM_SAGGING')
                    .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                    .map((addedUrl, addIdx) => (
                      <AuditPhotoCard
                        key={`added-sag-${addIdx}`}
                        url={addedUrl}
                        photoCode={`Mới`}
                        title={`Ảnh võng dầm mới thêm`}
                        category="BEAM_SAGGING"
                        targetPhotoType="BEAM_SAGGING"
                        targetPhotoId="settlementTilt.beamSagging.photos"
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="emerald"
                        optimisticStatus="ADDED"
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-white border border-dashed border-slate-200 text-center space-y-1">
                  <p className="text-[10px] text-slate-400 italic">Chưa có ảnh kiểm tra độ võng dầm</p>
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoType: 'BEAM_SAGGING',
                          photoTitle: 'Lịch sử ảnh độ võng dầm / bản sàn',
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-700 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem lịch sử và khôi phục ảnh võng dầm đã xóa"
                    >
                      <History className="w-3 h-3 text-sky-600" />
                      <span> Lịch sử / Khôi phục ảnh</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-500">
              Chỉ số E3 lấy mức lớn nhất: <strong>max(Lún {lDiff}, Nghiêng {lTilt}, Võng {lSag}) = {calculatedE3}</strong>
            </div>
          </div>
        </div>

        {/* 2.2. TRƯỜNG HỢP NGOẠI LỆ / HIỆN TRẠNG BẤT THƯỜNG KHÁC */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>2.2. Trường Hợp Ngoại LỆ / Hiện Trạng Bất Thường Khác</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {abnormalPhotos.length} ảnh minh chứng
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lưới ảnh ngoại lệ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">
                  Ảnh hiện trường bất thường (Rễ cây nứt hè, hố ga sụt, vách độc lập...):
                </span>
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'SETTLEMENT_TILT',
                        targetPhotoType: 'ABNORMAL_PHOTO',
                        targetPhotoId: 'abnormalPhotos',
                        photoTitle: 'Bổ sung ảnh hiện trạng bất thường',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Thêm Ảnh</span>
                  </button>
                )}
              </div>

              {abnormalPhotos.length > 0 || (stagedPhotoActions?.some((a) => a.action === 'ADD' && (a.targetPhotoType === 'ABNORMAL_PHOTO' || a.targetPhotoType === 'ABNORMAL_CASE'))) ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {abnormalPhotos.map((p, pIdx) => {
                    const stagedAb = getStagedAction({
                      category: 'SETTLEMENT_TILT',
                      targetPhotoId: 'abnormalPhotos',
                      photoIndex: pIdx,
                      url: p.url,
                    });
                    return (
                      <AuditPhotoCard
                        key={pIdx}
                        url={stagedAb?.newPhotoUrl || p.url}
                        photoCode={p.photoCode || `ANOMALY_${pIdx + 1}`}
                        title={`Ảnh ngoại lệ (${p.photoCode || `ANOMALY_${pIdx + 1}`})`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="ABNORMAL_PHOTO"
                        targetPhotoId="abnormalPhotos"
                        photoIndex={pIdx}
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="amber"
                        optimisticStatus={stagedAb ? (stagedAb.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                        onUndoDelete={stagedAb ? () => onUndoPhotoAction?.(stagedAb) : undefined}
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    );
                  })}

                  {/* Ảnh ngoại lệ mới thêm (Optimistic ADD) */}
                  {stagedPhotoActions
                    ?.filter((a) => a.action === 'ADD' && (a.targetPhotoType === 'ABNORMAL_PHOTO' || a.targetPhotoType === 'ABNORMAL_CASE'))
                    .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                    .map((addedUrl, addIdx) => (
                      <AuditPhotoCard
                        key={`added-ab-${addIdx}`}
                        url={addedUrl}
                        photoCode={`Mới`}
                        title={`Ảnh ngoại lệ mới thêm`}
                        category="SETTLEMENT_TILT"
                        targetPhotoType="ABNORMAL_PHOTO"
                        targetPhotoId="abnormalPhotos"
                        isEditMode={isEditMode}
                        aspectRatio="aspect-video"
                        badgeColor="emerald"
                        optimisticStatus="ADDED"
                        onOpenPhotoZoom={onOpenPhotoZoom}
                        onOpenPhotoAction={onOpenPhotoAction}
                        onOpenPhotoHistory={onOpenPhotoHistory}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-dashed border-slate-200 text-center space-y-1.5">
                  <p className="text-xs text-slate-400 italic">Không ghi nhận trường hợp ngoại lệ bất thường tại hiện trường</p>
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoType: 'ABNORMAL_PHOTO',
                          photoTitle: 'Lịch sử ảnh trường hợp bất thường / ngoại lệ',
                        })
                      }
                      className="px-2.5 py-1 rounded bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem lịch sử và khôi phục ảnh bất thường đã xóa"
                    >
                      <History className="w-3.5 h-3.5 text-sky-600" />
                      <span> Lịch sử / Khôi phục ảnh</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Ghi chú ngoại lệ */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600 block">
                Ghi chú chi tiết trường hợp ngoại lệ:
              </span>
              {isEditMode ? (
                <textarea
                  rows={4}
                  value={abnormal.notes || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'abnormalCase', 'Ghi chú ngoại lệ', {
                      ...abnormal,
                      notes: e.target.value,
                    })
                  }
                  placeholder="VD: Rễ cây lớn làm nứt vỉa hè, hố ga thoát nước sát móng bị sụt..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              ) : (
                <p className="text-xs text-slate-700 p-3 bg-white rounded-xl border border-slate-200 min-h-[80px]">
                  {abnormal.notes || 'Không'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2.3. NGUỒN XÁC ĐỊNH DỮ LIỆU NGOẠI QUAN & ĐỘ TIN CẬY */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase">
                2.3. Nguồn Xác Định Dữ Liệu Ngoại Quan & Độ Tin Cậy
              </span>
            </div>
            {isEditMode ? (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-slate-600">Độ tin cậy:</label>
                <select
                  value={st.reliability || 'HIGH'}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'reliability', 'Độ tin cậy dữ liệu', e.target.value)
                  }
                  className="p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                >
                  <option value="HIGH">Cao (Quan trắc máy / Thiết bị chuẩn)</option>
                  <option value="MEDIUM">Trung bình (Thước dây / Mắt thường)</option>
                  <option value="LOW">Thấp (Chủ nhà nhớ khai / Ước lượng)</option>
                </select>
              </div>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                Độ tin cậy: {st.reliability === 'LOW' ? 'Thấp' : st.reliability === 'MEDIUM' ? 'Trung bình' : 'Cao'}
              </span>
            )}
          </div>

          {isEditMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {DATA_SOURCES_LIST.map((src) => {
                const isChecked = isDataSourceMatched(dataSources, src);
                return (
                  <label
                    key={src}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${isChecked ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...dataSources, src]
                          : dataSources.filter((s) => {
                            const sNorm = s.toLowerCase().trim();
                            const srcNorm = src.toLowerCase().trim();
                            return sNorm !== srcNorm && !sNorm.includes(srcNorm) && !srcNorm.includes(sNorm);
                          });
                        handleNestedFieldChange('settlementTilt', 'dataSource', 'Nguồn dữ liệu', updated);
                      }}
                      className="rounded text-emerald-600"
                    />
                    <span>{src}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {dataSources.length > 0 ? (
                dataSources.map((src, sIdx) => (
                  <span
                    key={sIdx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{src}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Quan sát trực tiếp tại hiện trường & Thước laser
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2.4. ĐỀ XUẤT QUAN TRẮC MỐC LÚN NGHIÊNG */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                2.4. Đề Xuất Lắp Đặt Mốc Quan Trắc Lún Nghiêng Chuyên Sâu
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${monitoring.required
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
            >
              {monitoring.required ? '⚠️ CẦN QUAN TRẮC BỔ SUNG' : '✓ KHÔNG YÊU CẦU QUAN TRẮC'}
            </span>
          </div>

          <div className="text-xs">
            {isEditMode ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(monitoring.required)}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'needAdditionalMonitoring', 'Yêu cầu quan trắc', {
                        ...monitoring,
                        required: e.target.checked,
                      })
                    }
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Yêu cầu bố trí mốc quan trắc biến dạng định kỳ trong quá trình thi công</span>
                </label>
                <input
                  type="text"
                  value={monitoring.notes || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'needAdditionalMonitoring', 'Ghi chú quan trắc', {
                      ...monitoring,
                      notes: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  placeholder="Ghi chú chi tiết phương án và vị trí bố trí mốc quan trắc..."
                />
              </div>
            ) : (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700">
                {monitoring.notes || (monitoring.required ? 'Yêu cầu quan trắc lún nghiêng định kỳ.' : 'Không')}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

