import React from 'react';
import { Camera, Maximize2, MapPin, AlertCircle, Compass, ShieldAlert, Building, Navigation, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';
import { OBJECT_GROUPS, ADJACENT_LEFT_RIGHT, ADJACENT_REAR } from '../../../../../survey-phase1/components/step1/step1.constants';
import { USAGE_OPTIONS } from '../../../../../survey-phase1/constants/surveyOptionsConstants';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  data: any;
  handleFieldChange: (key: string, label: string, val: any) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: any) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: any) => void;
}

export const AuditStep1Identification: React.FC<Props> = ({
  isEditMode,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
}) => {
  const sJson = data?.surveyJson || data?.survey_data_json || {};
  const rightPane = data?.rightPane || {};
  const identificationPhotos = rightPane.identificationPhotos || sJson.identificationPhotos || {};

  // Case Type
  const caseType = formState.surveyCaseType || sJson.surveyCaseType || (data.isRefusedOrAbsent ? 'ABSENTEE' : 'NORMAL');

  // P01: Biển số nhà
  const p01Raw = identificationPhotos.photoP01 || sJson.photoP01 || {};
  const p01Url = typeof p01Raw === 'string' ? p01Raw : (p01Raw.url || p01Raw.photoUrl || p01Raw.raw_photo_url || p01Raw.annotated_photo_url || '');

  // P02: Mặt đứng chính diện
  const p02Raw = identificationPhotos.photoP02 || sJson.photoP02 || {};
  const p02Url = typeof p02Raw === 'string' ? p02Raw : (p02Raw.url || p02Raw.photoUrl || p02Raw.raw_photo_url || p02Raw.annotated_photo_url || '');
  const p02PolygonPoints = p02Raw.polygonPoints || sJson.facadeBoundaryGeojson || rightPane.facadeBoundaryGeojson || null;
  const p02FloorSplits = p02Raw.floorSplits || null;

  // P03: Mặt bên / Mặt sau (Ảnh chính + tối đa 2 ảnh bổ sung -> max 3 ảnh P-03)
  const p03Raw = identificationPhotos.photoP03 || sJson.photoP03 || {};
  const p03Url = typeof p03Raw === 'string' ? p03Raw : (p03Raw.url || p03Raw.photoUrl || p03Raw.raw_photo_url || p03Raw.annotated_photo_url || '');
  const p03AdditionalPhotos = Array.isArray(p03Raw.additionalPhotos) ? p03Raw.additionalPhotos : [];

  // P04: Toàn cảnh tuyến phố
  const p04Raw = identificationPhotos.photoP04 || sJson.photoP04 || {};
  const p04Url = typeof p04Raw === 'string' ? p04Raw : (p04Raw.url || p04Raw.photoUrl || p04Raw.raw_photo_url || p04Raw.annotated_photo_url || '');

  // Danh sách ảnh định danh ngoại quan linh hoạt (tối thiểu 4 ảnh, tối đa 6 ảnh)
  const dynamicPhotoList = [
    {
      key: 'photoP01',
      code: 'P-01',
      label: 'Biển số nhà / Tên cơ quan',
      url: p01Url,
      notApplicable: Boolean(p01Raw.notApplicable),
      naReason: p01Raw.naReason,
    },
    {
      key: 'photoP02',
      code: 'P-02',
      label: 'Mặt đứng chính diện (Facade)',
      url: p02Url,
      polygonPoints: p02PolygonPoints,
      floorSplits: p02FloorSplits,
      notApplicable: Boolean(p02Raw.notApplicable),
      naReason: p02Raw.naReason,
    },
    {
      key: 'photoP03',
      code: p03Raw.photoCode || 'P-03_1',
      label: `Mặt bên / sau (${p03Raw.tag || 'Ảnh chính'})`,
      url: p03Url,
      tag: p03Raw.tag || 'Bên hông',
      notApplicable: Boolean(p03Raw.notApplicable),
      naReason: p03Raw.naReason,
    },
    ...p03AdditionalPhotos.map((extra: any, idx: number) => {
      const extraUrl = typeof extra === 'string' ? extra : (extra.url || extra.photoUrl || extra.raw_photo_url || '');
      return {
        key: `photoP03_extra_${idx}`,
        code: extra.photoCode || `P-03_${idx + 2}`,
        label: `Mặt bên / sau (${extra.tag || `Ảnh bổ sung ${idx + 1}`})`,
        url: extraUrl,
        tag: extra.tag || `Bổ sung ${idx + 1}`,
        notApplicable: false,
        isExtra: true,
      };
    }),
    {
      key: 'photoP04',
      code: 'P-04',
      label: 'Toàn cảnh tuyến phố & Không gian',
      url: p04Url,
      notApplicable: Boolean(p04Raw.notApplicable),
      naReason: p04Raw.naReason,
    },
  ];

  // Các ảnh đặc thù theo loại hình khảo sát
  const vacantLandPhotos = sJson.vacantLandPhotos || [];
  const underConstructionPhotos = sJson.underConstructionPhotos || [];

  // Tọa độ GPS & Sai số
  const gpsCoords = formState.gpsCoords || sJson.gpsCoords || formState.coordinates || data.coordinates || {};
  const latDisplay = gpsCoords.latitude ?? gpsCoords.lat;
  const lngDisplay = gpsCoords.longitude ?? gpsCoords.lng;
  const accuracyDisplay = gpsCoords.accuracy;

  // Adjacent Buildings Data
  const adjacent = formState.adjacentBuildings || sJson.adjacentBuildings || {
    left: { details: '', note: '' },
    right: { details: '', note: '' },
    back: { details: '', note: '' },
  };

  const handleAdjacentChange = (side: 'left' | 'right' | 'back', field: 'details' | 'note', value: string) => {
    const updated = {
      ...adjacent,
      [side]: {
        ...(adjacent[side] || {}),
        [field]: value,
      },
    };
    if (handleNestedFieldChange) {
      handleNestedFieldChange('adjacentBuildings', side, `Công trình liền kề (${side})`, updated[side]);
    } else {
      handleFieldChange('adjacentBuildings', 'Công trình liền kề', updated);
    }
  };

  return (
    <section id="step-1" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 01
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Định Danh Công Trình, Ngoại Quan P-01..P-04 & Tiếp Giáp Liền Kề
            </h3>
            <p className="text-[11px] text-slate-500">
              Nhận dạng pháp lý thửa đất, hiện trạng ngoại quan và nguy cơ chèn ép từ công trình lân cận
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {caseType !== 'NORMAL' && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              caseType === 'VACANT_LAND'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : caseType === 'UNDER_CONSTRUCTION'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : caseType === 'ABSENTEE'
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {caseType === 'VACANT_LAND'
                ? 'Đất Trống Chưa XD'
                : caseType === 'UNDER_CONSTRUCTION'
                ? 'Công Trình Đang XD'
                : caseType === 'ABSENTEE'
                ? 'Vắng Mặt Chủ Hộ'
                : 'Chung Cư / Căn Hộ'}
            </span>
          )}
          <Badge variant="default" size="sm">
            Mã Thửa: {formState.projectParcelCode || data.projectParcelCode}
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 1.1. BỘ ẢNH ĐỊNH DANH HIỆN TRƯỜNG (P-01 -> P-04) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-sky-600" />
              <span>1.1. Bộ Ảnh Định Danh Hiện Trường (Gồm {dynamicPhotoList.length} ảnh)</span>
            </span>
            <span className="text-[11px] text-slate-400">Click để soi ảnh &bull; Di chuột để đổi ảnh</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {dynamicPhotoList.map((item) => {
              const url = item.url;
              const hasPolygon = item.key === 'photoP02' && item.polygonPoints && Array.isArray(item.polygonPoints) && item.polygonPoints.length >= 3;

              return (
                <div
                  key={item.key}
                  className="group relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex flex-col h-48 shadow-xs"
                >
                  <div
                    className="flex-1 bg-black/5 relative cursor-pointer overflow-hidden flex items-center justify-center"
                    onClick={() => {
                      if (url) onOpenPhotoZoom(url, `${item.code} - ${item.label}`, item.code);
                    }}
                  >
                    {url ? (
                      <>
                        <img
                          src={url}
                          alt={item.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {/* Lớp phủ đa giác SVG nếu có polygonPoints */}
                        {hasPolygon && (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polygon
                              points={item.polygonPoints.map((p: any) => `${(p.x ?? 0) * 100},${(p.y ?? 0) * 100}`).join(' ')}
                              fill="rgba(16, 185, 129, 0.25)"
                              stroke="#10b981"
                              strokeWidth="2"
                            />
                          </svg>
                        )}
                      </>
                    ) : item.notApplicable ? (
                      <div className="p-2 text-center text-slate-400">
                        <span className="text-xs font-bold block">N/A</span>
                        <span className="text-[10px] italic">{item.naReason || 'Không áp dụng'}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa có ảnh</span>
                    )}

                    {url && (
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-6 h-6 drop-shadow-md" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white font-mono font-bold text-[10px] flex items-center gap-1">
                      <span>{item.code}</span>
                      {hasPolygon && <span className="text-emerald-400 text-[9px]">● Polygon</span>}
                    </div>
                  </div>

                  <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 truncate" title={item.label}>
                      {item.label}
                    </span>
                    {isEditMode && !item.isExtra && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoReplace({
                            targetPhotoType: 'IDENTIFICATION_P',
                            targetPhotoId: item.key,
                            currentPhotoUrl: url,
                            photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                          })
                        }
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                        title="Thay thế ảnh này"
                      >
                        Đổi ảnh
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khối Ảnh Đặc Thù: Đất Trống / Công Trình Đang Xây Dựng */}
        {caseType === 'VACANT_LAND' && vacantLandPhotos.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
            <span className="text-xs font-black uppercase text-amber-900 block">
              Ảnh Hiện Trạng Đất Trống ({vacantLandPhotos.length} ảnh)
            </span>
            {sJson.vacantLandNotes && (
              <p className="text-xs text-slate-700 italic">{sJson.vacantLandNotes}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {vacantLandPhotos.map((vUrl: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => onOpenPhotoZoom(vUrl, `Ảnh đất trống ${idx + 1}`)}
                  className="rounded-lg overflow-hidden border border-amber-200 aspect-4/3 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <img src={vUrl} alt={`Đất trống ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {caseType === 'UNDER_CONSTRUCTION' && underConstructionPhotos.length > 0 && (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <span className="text-xs font-black uppercase text-blue-900 block">
              Ảnh Công Trình Đang Xây Dựng ({underConstructionPhotos.length} ảnh)
            </span>
            {sJson.constructionStageNotes && (
              <p className="text-xs text-slate-700 italic">{sJson.constructionStageNotes}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {underConstructionPhotos.map((uUrl: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => onOpenPhotoZoom(uUrl, `Ảnh xây dựng dở dang ${idx + 1}`)}
                  className="rounded-lg overflow-hidden border border-blue-200 aspect-4/3 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <img src={uUrl} alt={`Xây dựng dở dang ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1.2. THÔNG TIN ĐỊNH DANH CÔNG TRÌNH & ĐỊA CHỈ HÀNH CHÍNH */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Building className="w-4 h-4 text-sky-700" />
            <span className="text-xs font-black uppercase text-slate-800">
              1.2. Thông Tin Định Danh Công Trình & Địa Chỉ Hành Chính
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Tên công trình */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Tên công trình / Tòa nhà
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.buildingName || ''}
                  onChange={(e) => handleFieldChange('buildingName', 'Tên công trình', e.target.value)}
                  placeholder="VD: Nhà ở gia đình / Tòa nhà ABC"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-bold text-slate-800">
                  {formState.buildingName || sJson.buildingName || 'Nhà ở dân dụng'}
                </div>
              )}
            </div>

            {/* Số nhà */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Số nhà / Địa chỉ số *
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.houseNumber || ''}
                  onChange={(e) => handleFieldChange('houseNumber', 'Số nhà', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-black text-slate-900"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-black text-slate-900">
                  {formState.houseNumber || '---'}
                </div>
              )}
            </div>

            {/* Tuyến đường */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Tuyến đường *
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.street || ''}
                  onChange={(e) => handleFieldChange('street', 'Tuyến đường', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800">
                  {formState.street || '---'}
                </div>
              )}
            </div>

            {/* Phường */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Phường / Xã
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ward || ''}
                  onChange={(e) => handleFieldChange('ward', 'Phường/Xã', e.target.value)}
                  placeholder="VD: Phường 5"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800">
                  {formState.ward || sJson.ward || data.ward || 'Phường 5'}
                </div>
              )}
            </div>

            {/* Quận */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Quận / Huyện
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.district || ''}
                  onChange={(e) => handleFieldChange('district', 'Quận/Huyện', e.target.value)}
                  placeholder="VD: Quận Tân Bình"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800">
                  {formState.district || sJson.district || data.district || 'Quận Tân Bình'}
                </div>
              )}
            </div>

            {/* Chủ sở hữu */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Chủ sở hữu / Đại diện *
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ownerName || ''}
                  onChange={(e) => handleFieldChange('ownerName', 'Chủ sở hữu', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-bold text-slate-800">
                  {formState.ownerName || '---'}
                </div>
              )}
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Số điện thoại liên hệ
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ownerPhone || ''}
                  onChange={(e) => handleFieldChange('ownerPhone', 'SĐT chủ hộ', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-mono text-slate-700">
                  {formState.ownerPhone || '---'}
                </div>
              )}
            </div>

            {/* Mã địa chính */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Mã thửa địa chính / Tờ bản đồ
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.officialCadastralCode || ''}
                  onChange={(e) => handleFieldChange('officialCadastralCode', 'Mã địa chính', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-mono text-slate-700">
                  {formState.officialCadastralCode || '---'}
                </div>
              )}
            </div>

            {/* Nhóm công trình */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Nhóm công trình chịu tác động *
              </label>
              {isEditMode ? (
                <select
                  value={formState.objectGroup || 'GENERAL'}
                  onChange={(e) => handleFieldChange('objectGroup', 'Nhóm công trình', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  {OBJECT_GROUPS.map((og: any) => (
                    <option key={og.value} value={og.value}>
                      {og.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                  <Badge variant={formState.objectGroup === 'CRITICAL' ? 'danger' : formState.objectGroup === 'IMPORTANT' ? 'warning' : 'success'}>
                    {OBJECT_GROUPS.find((g: any) => g.value === formState.objectGroup)?.label || 'Nhà dân thông thường'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Công năng sử dụng */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Công năng sử dụng thực tế *
              </label>
              {isEditMode ? (
                <select
                  value={formState.usageFunction || 'Nhà ở gia đình'}
                  onChange={(e) => handleFieldChange('usageFunction', 'Công năng sử dụng', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  {USAGE_OPTIONS.map((u: any) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-1.5 bg-white rounded-lg border border-slate-200 font-bold text-slate-800">
                  {formState.usageFunction || 'Nhà ở gia đình'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1.3. CỰ LY KHÔNG GIAN TRẮC ĐỊA & TỌA ĐỘ GPS TUYẾN METRO 2 */}
        <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-sky-950 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-700" />
              <span>1.3. Cự Ly Không Gian Trắc Địa & Tọa Độ GPS (Tuyến Metro Số 2)</span>
            </span>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300">
              Có thể bù sai số GPS thủ công
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Khoảng cách đến tim tuyến */}
            <div className="p-3 bg-white rounded-xl border border-sky-200">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Khoảng cách đến tim hầm Metro (m) *
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={formState.metroOffsetDistance || ''}
                  onChange={(e) => handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-sky-300 rounded-lg text-xs font-black text-sky-900"
                  placeholder="VD: 14.5"
                />
              ) : (
                <div className="text-base font-black text-sky-800 font-mono">
                  {formState.metroOffsetDistance ? `${formState.metroOffsetDistance} m` : '---'}
                </div>
              )}
              <span className="text-[10px] text-slate-400 block mt-0.5">Khoảng cách đo đạc tới tim</span>
            </div>

            {/* Khoảng cách ranh GPMB */}
            <div className="p-3 bg-white rounded-xl border border-sky-200">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Khoảng cách ranh GPMB (m)
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={formState.clearanceOffsetDistance || ''}
                  onChange={(e) => handleFieldChange('clearanceOffsetDistance', 'Cự ly ranh GPMB', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-sky-300 rounded-lg text-xs font-bold text-slate-800"
                  placeholder="VD: 5.2"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.clearanceOffsetDistance ? `${formState.clearanceOffsetDistance} m` : '---'}
                </div>
              )}
              <span className="text-[10px] text-slate-400 block mt-0.5">Khoảng cách tới mốc GPMB</span>
            </div>

            {/* Lý trình thi công */}
            <div className="p-3 bg-white rounded-xl border border-sky-200">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Lý trình thi công (Chainage)
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.chainage || ''}
                  onChange={(e) => handleFieldChange('chainage', 'Lý trình', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-sky-300 rounded-lg text-xs font-bold text-slate-800"
                  placeholder="VD: Km 0+450"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.chainage || '---'}
                </div>
              )}
              <span className="text-[10px] text-slate-400 block mt-0.5">Vị trí dọc tuyến hầm</span>
            </div>

            {/* Tọa độ GPS */}
            <div className="p-3 bg-white rounded-xl border border-sky-200">
              <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-sky-600" />
                <span>Tọa độ GPS thực địa</span>
              </label>
              <div className="text-xs font-mono font-bold text-slate-800">
                {latDisplay ? `${Number(latDisplay).toFixed(6)}, ${Number(lngDisplay).toFixed(6)}` : '10.792410, 106.711520'}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Độ chính xác: ±{accuracyDisplay || 3.5}m
              </span>
            </div>
          </div>
        </div>

        {/* 1.4. CÔNG TRÌNH LIỀN KỀ THEO CÁC HƯỚNG & ADJACENT RISK RADAR */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase text-slate-800">
                1.4. Công Trình Liền Kề Theo Các Hướng (Adjacent Structures)
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Căn cứ tính chỉ số nhạy cảm V6</span>
            </span>
          </div>

          {/* SƠ ĐỒ TRỰC QUAN 2.5D: ADJACENT RISK RADAR */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Sơ Đồ Tiếp Giáp 3 Chiều Không Gian (Adjacent Risk Radar)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center text-xs">
              {/* Phía sau */}
              <div className="md:col-span-3 p-2 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Phía Sau (Rear / Back)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.back?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.back?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.back.note}"</span>
                )}
              </div>

              {/* Bên trái */}
              <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bên Trái (Left)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.left?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.left?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.left.note}"</span>
                )}
              </div>

              {/* Thửa đất khảo sát ở giữa */}
              <div className="p-3 bg-sky-100 rounded-lg border-2 border-sky-400 flex flex-col items-center justify-center shadow-xs">
                <span className="text-[10px] font-black text-sky-800 uppercase">Thửa Đang Khảo Sát</span>
                <span className="font-black text-sky-950 font-mono">
                  [{formState.projectParcelCode || data.projectParcelCode || 'THỬA HIỆN TẠI'}]
                </span>
                <span className="text-[11px] font-bold text-sky-900 mt-0.5">
                  {formState.houseNumber} {formState.street}
                </span>
              </div>

              {/* Bên phải */}
              <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bên Phải (Right)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.right?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.right?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.right.note}"</span>
                )}
              </div>

              {/* Mặt đường chính */}
              <div className="md:col-span-3 p-1.5 bg-slate-200/70 rounded-md border border-slate-300 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                ▲ Mặt Tiền Tuyến Đường / Tuyến Phố Chính ▲
              </div>
            </div>
          </div>

          {/* Form nhập/sửa hiện trạng tiếp giáp 3 phía */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bên Trái */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Bên Trái (Theo hướng toà nhà) *
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.left?.details || ''}
                    onChange={(e) => handleAdjacentChange('left', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng bên trái ---</option>
                    {ADJACENT_LEFT_RIGHT.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.left?.note || ''}
                    onChange={(e) => handleAdjacentChange('left', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết bên trái (khe lún, tường chung...)"
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.left?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.left?.note || 'Không có ghi chú bên trái.'}
                  </div>
                </div>
              )}
            </div>

            {/* Bên Phải */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Bên Phải (Theo hướng toà nhà) *
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.right?.details || ''}
                    onChange={(e) => handleAdjacentChange('right', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng bên phải ---</option>
                    {ADJACENT_LEFT_RIGHT.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.right?.note || ''}
                    onChange={(e) => handleAdjacentChange('right', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết bên phải..."
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.right?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.right?.note || 'Không có ghi chú bên phải.'}
                  </div>
                </div>
              )}
            </div>

            {/* Phía Sau */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Phía Sau Tiếp Giáp *
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.back?.details || ''}
                    onChange={(e) => handleAdjacentChange('back', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng phía sau ---</option>
                    {ADJACENT_REAR.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.back?.note || ''}
                    onChange={(e) => handleAdjacentChange('back', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết phía sau (hẻm, nhà kề...)"
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.back?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.back?.note || 'Không có ghi chú phía sau.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
